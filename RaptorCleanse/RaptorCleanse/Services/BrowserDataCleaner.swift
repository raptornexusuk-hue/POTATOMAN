import Foundation
import SQLite3
import AppKit

/// Removes browsing data in place. This is the only part of the app that writes
/// to a browser's own databases, and the only irreversible operation it performs.
///
/// Three rules make that survivable:
///
///  1. The browser must be fully quit. A running browser holds its databases and
///     would also rewrite whatever was removed.
///  2. Every database is copied before it is touched. On success the copy goes to
///     Trash, so a mistake is recoverable; on failure the original is put back.
///  3. Time bounds come from `BrowserTimestamp`, whose conversions are covered by
///     tests. Each browser stores time against a different epoch, and a wrong
///     conversion would silently delete far more than was asked for.
enum BrowserDataCleaner {
    private static let backupSuffix = ".raptorcleanse-backup"

    enum CleanerError: LocalizedError {
        case browserRunning(String)
        case protectedByMacOS(String)
        case notACacheFolder(String)
        case sqlite(String)

        var errorDescription: String? {
            switch self {
            case .browserRunning(let name): return "Quit \(name) fully with ⌘Q, then clear again."
            case .protectedByMacOS(let name): return "macOS protects \(name)'s data from other apps. Use its own privacy controls."
            case .notACacheFolder(let name): return "\(name) is not a recognised browser cache folder."
            case .sqlite(let message): return message
            }
        }
    }

    // MARK: - Entry point

    static func clear(targets: [BrowserClearTarget],
                      selection: BrowserClearSelection,
                      range: BrowserTimeRange,
                      runningBrowserIDs: Set<String>,
                      now: Date = Date()) -> BrowserClearReport {
        var report = BrowserClearReport(startedAt: now, range: range, selection: selection)
        guard !selection.isEmpty else { return report }
        let cutoff = range.cutoff(from: now)

        for target in targets {
            var outcome = BrowserClearOutcome(id: target.id,
                                              browserName: target.browserName,
                                              profileName: target.profileName)

            // A running browser would both block the write and immediately
            // rewrite anything removed.
            let liveIDs = Set(NSWorkspace.shared.runningApplications.compactMap(\.bundleIdentifier))
            let running = target.browser.bundleIdentifiers.contains {
                runningBrowserIDs.contains($0) || liveIDs.contains($0)
            }
            if running {
                outcome.skipped.append(CleanerError.browserRunning(target.browserName).localizedDescription)
                report.outcomes.append(outcome)
                continue
            }

            // Safari's store lives behind macOS privacy protection. Rather than
            // fail obscurely, say so and leave its own controls as the route.
            if target.browser == .safari {
                if selection.history || selection.cookies {
                    outcome.skipped.append(CleanerError.protectedByMacOS("Safari").localizedDescription)
                }
                if selection.cache {
                    applyCache(&outcome, target: target, cutoff: cutoff)
                }
                report.outcomes.append(outcome)
                continue
            }

            if selection.history {
                let result = clearOne(label: "history", url: target.historyURL, target: target) { url in
                    target.browser == .firefox
                        ? try clearFirefoxHistory(at: url, cutoff: cutoff)
                        : try clearChromiumHistory(at: url, cutoff: cutoff)
                }
                record(result, into: &outcome, as: \.historyRowsRemoved)
            }

            if selection.cookies {
                let result = clearOne(label: "cookies", url: target.cookiesURL, target: target) { url in
                    target.browser == .firefox
                        ? try clearFirefoxCookies(at: url, cutoff: cutoff)
                        : try clearChromiumCookies(at: url, cutoff: cutoff)
                }
                record(result, into: &outcome, as: \.cookieRowsRemoved)
            }

            if selection.cache {
                applyCache(&outcome, target: target, cutoff: cutoff)
            }

            report.outcomes.append(outcome)
        }
        return report
    }

    private enum StepResult {
        case removed(Int)
        case skipped(String)
        case failed(String)
    }

    /// Runs one database operation behind a backup and reports what happened,
    /// leaving the caller to record it against the right field.
    private static func clearOne(label: String,
                                 url: URL?,
                                 target: BrowserClearTarget,
                                 work: (URL) throws -> Int) -> StepResult {
        guard let url, FileManager.default.fileExists(atPath: url.path) else {
            return .skipped("No \(label) database for \(target.browserName) · \(target.profileName).")
        }
        do {
            return .removed(try withBackup(of: url) { try work(url) })
        } catch {
            return .failed("\(target.browserName) \(target.profileName) \(label): \(error.localizedDescription)")
        }
    }

    private static func record(_ result: StepResult, into outcome: inout BrowserClearOutcome, as field: WritableKeyPath<BrowserClearOutcome, Int?>) {
        switch result {
        case .removed(let count): outcome[keyPath: field] = (outcome[keyPath: field] ?? 0) + count
        case .skipped(let note): outcome.skipped.append(note)
        case .failed(let note): outcome.failures.append(note)
        }
    }

    private static func applyCache(_ outcome: inout BrowserClearOutcome, target: BrowserClearTarget, cutoff: Date?) {
        var trashed = 0
        for cache in target.cachePaths {
            do {
                trashed += try trashCacheFiles(in: cache, modifiedAtOrAfter: cutoff)
            } catch {
                outcome.failures.append("\(outcome.browserName) cache: \(error.localizedDescription)")
            }
        }
        outcome.cacheFilesTrashed = (outcome.cacheFilesTrashed ?? 0) + trashed
    }

    // MARK: - Backup

    /// Copy the database aside, run the work, then move the copy to Trash so it
    /// stays recoverable. If the work throws, the original is put back first.
    static func withBackup<T>(of url: URL, perform work: () throws -> T) throws -> T {
        let manager = FileManager.default
        let backup = URL(fileURLWithPath: url.path + backupSuffix)
        if manager.fileExists(atPath: backup.path) { try? manager.removeItem(at: backup) }

        // Fold any write-ahead log into the main file first, so the single file
        // that gets copied is a complete database.
        try? checkpoint(url)
        try manager.copyItem(at: url, to: backup)

        do {
            let result = try work()
            // Recoverable rather than gone: the copy goes to Trash, not /dev/null.
            try? manager.trashItem(at: backup, resultingItemURL: nil)
            return result
        } catch {
            // Put the original back exactly as it was, then clear the copy away.
            _ = try? manager.replaceItemAt(url, withItemAt: backup)
            try? manager.removeItem(at: backup)
            throw error
        }
    }

    // MARK: - SQLite

    private static func open(_ url: URL, readOnly: Bool = false) throws -> OpaquePointer {
        var handle: OpaquePointer?
        let flags = readOnly ? SQLITE_OPEN_READONLY : SQLITE_OPEN_READWRITE
        let status = sqlite3_open_v2(url.path, &handle, flags | SQLITE_OPEN_FULLMUTEX, nil)
        guard status == SQLITE_OK, let handle else {
            if let handle { sqlite3_close(handle) }
            throw CleanerError.sqlite("Could not open the database (SQLite \(status)).")
        }
        sqlite3_busy_timeout(handle, 2_000)
        return handle
    }

    private static func checkpoint(_ url: URL) throws {
        let handle = try open(url)
        defer { sqlite3_close(handle) }
        sqlite3_exec(handle, "PRAGMA wal_checkpoint(TRUNCATE);", nil, nil, nil)
    }

    /// Runs one statement. Tables differ between browser versions, so a missing
    /// table is treated as nothing to do rather than as a failure.
    @discardableResult
    private static func run(_ handle: OpaquePointer, _ sql: String, bind cutoff: Int64? = nil) throws -> Int {
        var statement: OpaquePointer?
        let prepared = sqlite3_prepare_v2(handle, sql, -1, &statement, nil)
        defer { sqlite3_finalize(statement) }
        if prepared != SQLITE_OK {
            let message = String(cString: sqlite3_errmsg(handle))
            if message.lowercased().contains("no such table") || message.lowercased().contains("no such column") { return 0 }
            throw CleanerError.sqlite(message)
        }
        if let cutoff { sqlite3_bind_int64(statement, 1, cutoff) }
        let step = sqlite3_step(statement)
        guard step == SQLITE_DONE || step == SQLITE_ROW else {
            throw CleanerError.sqlite(String(cString: sqlite3_errmsg(handle)))
        }
        return Int(sqlite3_changes(handle))
    }

    /// Everything or nothing: a partial delete would leave orphaned rows behind.
    private static func inTransaction(_ url: URL, _ body: (OpaquePointer) throws -> Int) throws -> Int {
        let handle = try open(url)
        defer { sqlite3_close(handle) }
        guard sqlite3_exec(handle, "BEGIN IMMEDIATE;", nil, nil, nil) == SQLITE_OK else {
            throw CleanerError.sqlite("The database is in use. Quit the browser and try again.")
        }
        do {
            let changed = try body(handle)
            guard sqlite3_exec(handle, "COMMIT;", nil, nil, nil) == SQLITE_OK else {
                throw CleanerError.sqlite(String(cString: sqlite3_errmsg(handle)))
            }
            sqlite3_exec(handle, "PRAGMA wal_checkpoint(TRUNCATE);", nil, nil, nil)
            return changed
        } catch {
            sqlite3_exec(handle, "ROLLBACK;", nil, nil, nil)
            throw error
        }
    }

    // MARK: - Per-browser clearing

    /// Chromium keeps visits in `visits` and pages in `urls`. Removing visits in
    /// range and then the pages left with no visits matches what the browser's
    /// own "Clear browsing data" does.
    @discardableResult
    static func clearChromiumHistory(at url: URL, cutoff: Date?) throws -> Int {
        let bound = cutoff.map(BrowserTimestamp.chromium) ?? 0
        return try inTransaction(url) { handle in
            let removed = try run(handle, "DELETE FROM visits WHERE visit_time >= ?1;", bind: bound)
            try run(handle, "DELETE FROM visit_source WHERE id NOT IN (SELECT id FROM visits);")
            try run(handle, "DELETE FROM urls WHERE id NOT IN (SELECT url FROM visits);")
            try run(handle, "DELETE FROM keyword_search_terms WHERE url_id NOT IN (SELECT id FROM urls);")
            try run(handle, "DELETE FROM segment_usage WHERE time_slot >= ?1;", bind: bound)
            try run(handle, "DELETE FROM segments WHERE url_id NOT IN (SELECT id FROM urls);")
            return removed
        }
    }

    @discardableResult
    static func clearChromiumCookies(at url: URL, cutoff: Date?) throws -> Int {
        let bound = cutoff.map(BrowserTimestamp.chromium) ?? 0
        return try inTransaction(url) { handle in
            try run(handle, "DELETE FROM cookies WHERE creation_utc >= ?1;", bind: bound)
        }
    }

    /// Firefox pages carry `foreign_count`, which counts bookmark references.
    /// Only pages with no remaining visits *and* no bookmark are removed, so
    /// clearing history never silently removes a bookmark.
    @discardableResult
    static func clearFirefoxHistory(at url: URL, cutoff: Date?) throws -> Int {
        let bound = cutoff.map(BrowserTimestamp.firefox) ?? 0
        return try inTransaction(url) { handle in
            let removed = try run(handle, "DELETE FROM moz_historyvisits WHERE visit_date >= ?1;", bind: bound)
            try run(handle, """
                DELETE FROM moz_places
                 WHERE foreign_count = 0
                   AND id NOT IN (SELECT DISTINCT place_id FROM moz_historyvisits);
                """)
            // Keep the surviving pages' counters honest, or Firefox shows visit
            // counts for visits that no longer exist.
            try run(handle, """
                UPDATE moz_places
                   SET visit_count = (SELECT COUNT(*) FROM moz_historyvisits WHERE place_id = moz_places.id),
                       last_visit_date = (SELECT MAX(visit_date) FROM moz_historyvisits WHERE place_id = moz_places.id);
                """)
            return removed
        }
    }

    @discardableResult
    static func clearFirefoxCookies(at url: URL, cutoff: Date?) throws -> Int {
        let bound = cutoff.map(BrowserTimestamp.firefox) ?? 0
        return try inTransaction(url) { handle in
            try run(handle, "DELETE FROM moz_cookies WHERE creationTime >= ?1;", bind: bound)
        }
    }

    // MARK: - Cache

    /// Cache files go to Trash rather than being deleted, so a mistake here costs
    /// nothing but disk space until Trash is emptied.
    @discardableResult
    static func trashCacheFiles(in directory: URL, modifiedAtOrAfter cutoff: Date?) throws -> Int {
        let manager = FileManager.default
        guard SafetyPolicy.browserCacheRootKind(for: directory) != nil else {
            throw CleanerError.notACacheFolder(directory.lastPathComponent)
        }
        try SafetyPolicy.validateRoot(directory)
        let rootSnapshot = SafetyPolicy.snapshot(try SafetyPolicy.metadata(directory))
        guard let walker = manager.enumerator(at: directory, includingPropertiesForKeys: [.contentModificationDateKey],
                                              options: [.skipsPackageDescendants], errorHandler: { _, _ in true }) else {
            return 0
        }
        var trashed = 0
        var inspected = 0
        while let entry = walker.nextObject() as? URL {
            inspected += 1
            if inspected > 50_000 { break }
            do {
                try SafetyPolicy.validateScopedEntry(entry, root: directory, rootSnapshot: rootSnapshot)
                let info = try SafetyPolicy.metadata(entry)
                guard (info.st_mode & S_IFMT) == S_IFREG else { continue }
                if let cutoff {
                    let modified = Date(timeIntervalSince1970: TimeInterval(info.st_mtimespec.tv_sec))
                    guard modified >= cutoff else { continue }
                }
                try manager.trashItem(at: entry, resultingItemURL: nil)
                trashed += 1
            } catch {
                continue
            }
        }
        return trashed
    }
}
