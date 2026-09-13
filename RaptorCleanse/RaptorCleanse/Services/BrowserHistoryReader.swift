import Foundation
import SQLite3
import Darwin

/// Counts visits only. No visited URLs, page titles, cookies or bookmark rows are requested.
/// Immutable URI mode prevents SQLite creating browser WAL/shared-memory sidecars.
/// A nonempty WAL/journal is never ignored: the count is unavailable until the browser settles.
enum BrowserHistoryReader {
    private struct Sidecar: Equatable { let suffix: String; let snapshot: FileSnapshot? }
    private struct SourceState: Equatable { let database: FileSnapshot; let sidecars: [Sidecar] }
    private enum ReadError: Error { case busy, unsupported, invalid, sqlite(Int32) }

    static func readCount(at url: URL, browser: BrowserKind, authorizedRoots: [URL]) -> BrowserHistorySummary {
        guard BrowserDiscovery.hasPermission(for: url, roots: authorizedRoots) else {
            return BrowserHistorySummary(count: nil, state: .permissionRequired, message: "Allow browser access to inspect history counts.")
        }
        do {
            let before = try sourceState(url, roots: authorizedRoots)
            let count = try countVisits(url, browser: browser)
            let after = try sourceState(url, roots: authorizedRoots)
            guard before == after else { throw ReadError.busy }
            return BrowserHistorySummary(count: count, state: .available,
                                         message: "\(count.formatted()) recorded visits. This count excludes private browsing.")
        } catch ReadError.busy {
            return busySummary
        } catch ReadError.unsupported {
            return BrowserHistorySummary(count: nil, state: .unsupported, message: "This history database format is not supported. Use the browser’s history controls.")
        } catch ReadError.sqlite(let code) {
            switch code & 0xff {
            case SQLITE_BUSY, SQLITE_LOCKED, SQLITE_INTERRUPT: return busySummary
            case SQLITE_PERM, SQLITE_AUTH, SQLITE_READONLY:
                return BrowserHistorySummary(count: nil, state: .permissionRequired, message: "macOS denied this history read. You can still clear history in the browser.")
            default: return BrowserHistorySummary(count: nil, state: .unreadable, message: "History could not be read safely. Use the browser’s history controls.")
            }
        } catch {
            let error = error as NSError
            if error.domain == NSPOSIXErrorDomain && [Int(ENOENT), Int(ENOTDIR)].contains(error.code) {
                return BrowserHistorySummary(count: nil, state: .missing, message: "No history database found for this profile.")
            }
            if (error.domain == NSPOSIXErrorDomain && [Int(EACCES), Int(EPERM)].contains(error.code)) ||
               (error.domain == NSCocoaErrorDomain && error.code == NSFileReadNoPermissionError) {
                return BrowserHistorySummary(count: nil, state: .permissionRequired, message: "macOS denied this history read. You can still clear history in the browser.")
            }
            return BrowserHistorySummary(count: nil, state: .unreadable, message: "History could not be read safely. Use the browser’s history controls.")
        }
    }

    private static var busySummary: BrowserHistorySummary {
        BrowserHistorySummary(count: nil, state: .busy, message: "Quit the browser, then refresh to count recent history. Its history controls are still available.")
    }

    private static func sourceState(_ url: URL, roots: [URL]) throws -> SourceState {
        try BrowserDiscovery.validateReadLocation(url, roots: roots, isDirectory: false)
        let database = SafetyPolicy.snapshot(try SafetyPolicy.metadata(url))
        // Bounded metadata inspection; no copies of browsing data are written to disk.
        guard database.byteCount >= 100, database.byteCount <= 2_147_483_648 else { throw ReadError.invalid }
        var sidecars: [Sidecar] = []
        for suffix in ["-wal", "-journal", "-shm"] {
            let sidecar = URL(fileURLWithPath: url.path + suffix)
            do {
                let info = try SafetyPolicy.metadata(sidecar)
                try BrowserDiscovery.validateReadLocation(sidecar, roots: roots, isDirectory: false)
                let snapshot = SafetyPolicy.snapshot(info)
                if suffix != "-shm" && snapshot.byteCount > 0 { throw ReadError.busy }
                sidecars.append(Sidecar(suffix: suffix, snapshot: snapshot))
            } catch {
                let nsError = error as NSError
                if nsError.domain == NSPOSIXErrorDomain && nsError.code == Int(ENOENT) {
                    sidecars.append(Sidecar(suffix: suffix, snapshot: nil))
                } else { throw error }
            }
        }
        return SourceState(database: database, sidecars: sidecars)
    }

    private static func countVisits(_ url: URL, browser: BrowserKind) throws -> Int {
        var components = URLComponents(url: url.standardizedFileURL, resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "mode", value: "ro"), URLQueryItem(name: "immutable", value: "1")]
        guard let uri = components?.url?.absoluteString else { throw ReadError.invalid }
        var database: OpaquePointer?
        let result = sqlite3_open_v2(uri, &database, SQLITE_OPEN_READONLY | SQLITE_OPEN_URI | SQLITE_OPEN_FULLMUTEX, nil)
        defer { if let database { sqlite3_close(database) } }
        guard result == SQLITE_OK, let database else { throw ReadError.sqlite(result) }
        guard sqlite3_db_readonly(database, "main") == 1 else { throw ReadError.invalid }
        sqlite3_busy_timeout(database, 250)
        // Extension loading is disabled by default on this fresh connection.
        // Keep that default; the optional extension API is absent from some Apple SDKs.
        guard sqlite3_exec(database, "PRAGMA query_only=ON; PRAGMA trusted_schema=OFF;", nil, nil, nil) == SQLITE_OK else {
            throw ReadError.sqlite(sqlite3_errcode(database))
        }
        let deadline = UnsafeMutablePointer<TimeInterval>.allocate(capacity: 1)
        deadline.initialize(to: Date().timeIntervalSinceReferenceDate + 2)
        defer { sqlite3_progress_handler(database, 0, nil, nil); deadline.deinitialize(count: 1); deadline.deallocate() }
        sqlite3_progress_handler(database, 10_000, { context in
            guard let context else { return 1 }
            return Date().timeIntervalSinceReferenceDate >= context.assumingMemoryBound(to: TimeInterval.self).pointee ? 1 : 0
        }, deadline)

        let table: String
        let requiredColumns: Set<String>
        switch browser {
        case .safari: table = "history_visits"; requiredColumns = ["id", "history_item", "visit_time"]
        case .firefox: table = "moz_historyvisits"; requiredColumns = ["id", "place_id", "visit_date"]
        default: table = "visits"; requiredColumns = ["id", "url", "visit_time"]
        }
        // Only a real, known history table can be queried, never views or virtual tables.
        var schema: OpaquePointer?
        let schemaSQL = "SELECT sql FROM sqlite_schema WHERE type='table' AND name=?1"
        guard sqlite3_prepare_v2(database, schemaSQL, -1, &schema, nil) == SQLITE_OK else { throw ReadError.sqlite(sqlite3_errcode(database)) }
        defer { sqlite3_finalize(schema) }
        let bindResult = table.withCString { sqlite3_bind_text(schema, 1, $0, -1, unsafeBitCast(-1, to: sqlite3_destructor_type.self)) }
        guard bindResult == SQLITE_OK else { throw ReadError.sqlite(bindResult) }
        let schemaStep = sqlite3_step(schema)
        if schemaStep == SQLITE_DONE { throw ReadError.unsupported }
        guard schemaStep == SQLITE_ROW, let definition = sqlite3_column_text(schema, 0) else { throw ReadError.sqlite(sqlite3_errcode(database)) }
        guard !String(cString: definition).uppercased().contains("VIRTUAL TABLE") else { throw ReadError.unsupported }

        var columnStatement: OpaquePointer?
        guard sqlite3_prepare_v2(database, "PRAGMA table_info(\"\(table)\")", -1, &columnStatement, nil) == SQLITE_OK else { throw ReadError.sqlite(sqlite3_errcode(database)) }
        defer { sqlite3_finalize(columnStatement) }
        var columns: Set<String> = []
        var columnStep = sqlite3_step(columnStatement)
        while columnStep == SQLITE_ROW {
            if let name = sqlite3_column_text(columnStatement, 1) { columns.insert(String(cString: name)) }
            columnStep = sqlite3_step(columnStatement)
        }
        guard columnStep == SQLITE_DONE else { throw ReadError.sqlite(columnStep) }
        guard requiredColumns.isSubset(of: columns) else { throw ReadError.unsupported }

        var statement: OpaquePointer?
        // `table` is selected only from the three constants above.
        guard sqlite3_prepare_v2(database, "SELECT COUNT(*) FROM \"\(table)\"", -1, &statement, nil) == SQLITE_OK else { throw ReadError.sqlite(sqlite3_errcode(database)) }
        defer { sqlite3_finalize(statement) }
        let step = sqlite3_step(statement)
        guard step == SQLITE_ROW else { throw ReadError.sqlite(step) }
        let count = sqlite3_column_int64(statement, 0)
        guard let result = Int(exactly: count), result >= 0 else { throw ReadError.invalid }
        return result
    }
}
