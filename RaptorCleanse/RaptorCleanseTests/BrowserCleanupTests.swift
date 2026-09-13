import Foundation
import SQLite3
import XCTest

/// Clearing browsing data is the only irreversible thing this app does, and the
/// part most likely to do it wrong is the time bound: every browser counts time
/// from a different epoch. These tests run the real delete statements against
/// synthetic databases, so a wrong cutoff fails here rather than on someone's
/// real history.
///
/// Nothing here touches a real browser profile or the user's Trash.
final class BrowserCleanupTests: XCTestCase {
    private var fixtureRoot: URL!
    private let manager = FileManager.default

    override func setUpWithError() throws {
        fixtureRoot = SafetyPolicy.userHomeDirectory.appendingPathComponent(
            "RaptorCleanseCleanupTests-\(UUID().uuidString)", isDirectory: true
        )
        try manager.createDirectory(at: fixtureRoot, withIntermediateDirectories: false)
    }

    override func tearDownWithError() throws {
        if let fixtureRoot, manager.fileExists(atPath: fixtureRoot.path) {
            try manager.removeItem(at: fixtureRoot)
        }
        fixtureRoot = nil
    }

    // MARK: - Epoch conversions

    func testChromiumUsesMicrosecondsSince1601() {
        // 11,644,473,600 seconds separate 1601-01-01 from 1970-01-01.
        XCTAssertEqual(BrowserTimestamp.chromium(from: Date(timeIntervalSince1970: 0)), 11_644_473_600_000_000)
        // 2024-01-01T00:00:00Z
        XCTAssertEqual(BrowserTimestamp.chromium(from: Date(timeIntervalSince1970: 1_704_067_200)), 13_348_540_800_000_000)
    }

    func testFirefoxUsesMicrosecondsSince1970() {
        XCTAssertEqual(BrowserTimestamp.firefox(from: Date(timeIntervalSince1970: 0)), 0)
        XCTAssertEqual(BrowserTimestamp.firefox(from: Date(timeIntervalSince1970: 1_704_067_200)), 1_704_067_200_000_000)
    }

    func testSafariUsesSecondsSince2001() {
        XCTAssertEqual(BrowserTimestamp.safari(from: Date(timeIntervalSince1970: 978_307_200)), 0, accuracy: 0.001)
        XCTAssertEqual(BrowserTimestamp.safari(from: Date(timeIntervalSince1970: 1_704_067_200)), 725_760_000, accuracy: 0.001)
    }

    /// A later moment must always convert to a larger number, or a "last hour"
    /// bound would select the wrong side of the comparison.
    func testConversionsIncreaseWithTime() {
        let earlier = Date(timeIntervalSince1970: 1_700_000_000)
        let later = Date(timeIntervalSince1970: 1_700_003_600)
        XCTAssertLessThan(BrowserTimestamp.chromium(from: earlier), BrowserTimestamp.chromium(from: later))
        XCTAssertLessThan(BrowserTimestamp.firefox(from: earlier), BrowserTimestamp.firefox(from: later))
        XCTAssertLessThan(BrowserTimestamp.safari(from: earlier), BrowserTimestamp.safari(from: later))
    }

    // MARK: - Time ranges

    func testAllTimeHasNoCutoffAndOtherRangesDo() {
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        XCTAssertNil(BrowserTimeRange.allTime.cutoff(from: now))
        XCTAssertEqual(BrowserTimeRange.lastHour.cutoff(from: now), now.addingTimeInterval(-3_600))
        XCTAssertEqual(BrowserTimeRange.last24Hours.cutoff(from: now), now.addingTimeInterval(-86_400))
        XCTAssertEqual(BrowserTimeRange.last7Days.cutoff(from: now), now.addingTimeInterval(-604_800))
        XCTAssertEqual(BrowserTimeRange.last4Weeks.cutoff(from: now), now.addingTimeInterval(-2_419_200))
    }

    func testSelectionSummaryNamesOnlyWhatIsSelected() {
        XCTAssertEqual(BrowserClearSelection(history: true, cookies: false, cache: false).summary, "history")
        XCTAssertEqual(BrowserClearSelection(history: true, cookies: false, cache: true).summary, "history and cache")
        XCTAssertEqual(BrowserClearSelection(history: true, cookies: true, cache: true).summary,
                       "history, cookies and sign-ins and cache")
        XCTAssertTrue(BrowserClearSelection(history: false, cookies: false, cache: false).isEmpty)
    }

    // MARK: - Chromium history

    func testChromiumHistoryRemovesOnlyVisitsInRange() throws {
        let now = Date()
        let recent = now.addingTimeInterval(-600)       // 10 minutes ago
        let old = now.addingTimeInterval(-7 * 86_400)   // a week ago
        let database = fixtureRoot.appendingPathComponent("History")
        try makeChromiumHistory(at: database, recent: recent, old: old)

        let removed = try BrowserDataCleaner.clearChromiumHistory(at: database, cutoff: now.addingTimeInterval(-3_600))

        XCTAssertEqual(removed, 1, "only the visit inside the last hour should go")
        XCTAssertEqual(try scalar(database, "SELECT COUNT(*) FROM visits"), 1)
        XCTAssertEqual(try scalar(database, "SELECT COUNT(*) FROM urls"), 1, "the page left with no visits should go too")
        XCTAssertEqual(try scalar(database, "SELECT COUNT(*) FROM urls WHERE url = 'https://old.example'"), 1)
    }

    func testChromiumHistoryAllTimeRemovesEverything() throws {
        let now = Date()
        let database = fixtureRoot.appendingPathComponent("History")
        try makeChromiumHistory(at: database, recent: now.addingTimeInterval(-600), old: now.addingTimeInterval(-7 * 86_400))

        let removed = try BrowserDataCleaner.clearChromiumHistory(at: database, cutoff: nil)

        XCTAssertEqual(removed, 2)
        XCTAssertEqual(try scalar(database, "SELECT COUNT(*) FROM visits"), 0)
        XCTAssertEqual(try scalar(database, "SELECT COUNT(*) FROM urls"), 0)
    }

    func testChromiumCookiesRemoveOnlyThoseCreatedInRange() throws {
        let now = Date()
        let database = fixtureRoot.appendingPathComponent("Cookies")
        try exec(database, """
            CREATE TABLE cookies(creation_utc INTEGER NOT NULL, host_key TEXT NOT NULL, name TEXT, value TEXT);
            INSERT INTO cookies VALUES(\(BrowserTimestamp.chromium(from: now.addingTimeInterval(-600))), 'recent.example', 'a', '1');
            INSERT INTO cookies VALUES(\(BrowserTimestamp.chromium(from: now.addingTimeInterval(-7 * 86_400))), 'old.example', 'b', '2');
            """)

        let removed = try BrowserDataCleaner.clearChromiumCookies(at: database, cutoff: now.addingTimeInterval(-3_600))

        XCTAssertEqual(removed, 1)
        XCTAssertEqual(try scalar(database, "SELECT COUNT(*) FROM cookies WHERE host_key = 'old.example'"), 1)
    }

    // MARK: - Firefox history

    func testFirefoxHistoryRemovesOnlyVisitsInRange() throws {
        let now = Date()
        let database = fixtureRoot.appendingPathComponent("places.sqlite")
        try makeFirefoxPlaces(at: database, now: now)

        let removed = try BrowserDataCleaner.clearFirefoxHistory(at: database, cutoff: now.addingTimeInterval(-3_600))

        XCTAssertEqual(removed, 2, "both recent visits are inside the hour")
        XCTAssertEqual(try scalar(database, "SELECT COUNT(*) FROM moz_historyvisits"), 1)
        XCTAssertEqual(try scalar(database, "SELECT COUNT(*) FROM moz_places WHERE url = 'https://old.example'"), 1)
    }

    /// Firefox counts bookmark references in `foreign_count`. Clearing history
    /// must never remove a bookmarked page, even with no visits left.
    func testFirefoxHistoryKeepsBookmarkedPages() throws {
        let now = Date()
        let database = fixtureRoot.appendingPathComponent("places.sqlite")
        try makeFirefoxPlaces(at: database, now: now)

        try BrowserDataCleaner.clearFirefoxHistory(at: database, cutoff: nil)

        XCTAssertEqual(try scalar(database, "SELECT COUNT(*) FROM moz_historyvisits"), 0)
        XCTAssertEqual(try scalar(database, "SELECT COUNT(*) FROM moz_places WHERE url = 'https://bookmarked.example'"), 1)
        XCTAssertEqual(try scalar(database, "SELECT COUNT(*) FROM moz_places"), 1, "only the bookmark survives")
    }

    /// Surviving pages must not keep counters for visits that no longer exist.
    func testFirefoxHistoryResetsCountersOnSurvivingPages() throws {
        let now = Date()
        let database = fixtureRoot.appendingPathComponent("places.sqlite")
        try makeFirefoxPlaces(at: database, now: now)

        try BrowserDataCleaner.clearFirefoxHistory(at: database, cutoff: nil)

        XCTAssertEqual(try scalar(database, "SELECT visit_count FROM moz_places WHERE url = 'https://bookmarked.example'"), 0)
    }

    func testFirefoxCookiesRemoveOnlyThoseCreatedInRange() throws {
        let now = Date()
        let database = fixtureRoot.appendingPathComponent("cookies.sqlite")
        try exec(database, """
            CREATE TABLE moz_cookies(id INTEGER PRIMARY KEY, creationTime INTEGER, host TEXT, name TEXT);
            INSERT INTO moz_cookies VALUES(1, \(BrowserTimestamp.firefox(from: now.addingTimeInterval(-600))), 'recent.example', 'a');
            INSERT INTO moz_cookies VALUES(2, \(BrowserTimestamp.firefox(from: now.addingTimeInterval(-7 * 86_400))), 'old.example', 'b');
            """)

        let removed = try BrowserDataCleaner.clearFirefoxCookies(at: database, cutoff: now.addingTimeInterval(-3_600))

        XCTAssertEqual(removed, 1)
        XCTAssertEqual(try scalar(database, "SELECT COUNT(*) FROM moz_cookies WHERE host = 'old.example'"), 1)
    }

    // MARK: - Missing tables and failure handling

    /// Table names differ between browser versions. A database without the table
    /// is nothing to do, not a crash.
    func testMissingTablesAreToleratedRatherThanThrowing() throws {
        let database = fixtureRoot.appendingPathComponent("Empty")
        try exec(database, "CREATE TABLE meta(key TEXT, value TEXT);")
        XCTAssertEqual(try BrowserDataCleaner.clearChromiumHistory(at: database, cutoff: nil), 0)
        XCTAssertEqual(try BrowserDataCleaner.clearChromiumCookies(at: database, cutoff: nil), 0)
    }

    /// If the work throws, the original must be exactly as it was. This exercises
    /// the restore path only, which removes its copy rather than using Trash.
    func testBackupRestoresTheOriginalWhenWorkFails() throws {
        let file = fixtureRoot.appendingPathComponent("History")
        try Data("original".utf8).write(to: file)

        struct Boom: Error {}
        XCTAssertThrowsError(try BrowserDataCleaner.withBackup(of: file) {
            try Data("corrupted".utf8).write(to: file)
            throw Boom()
        })

        XCTAssertEqual(try String(contentsOf: file, encoding: .utf8), "original")
        XCTAssertFalse(manager.fileExists(atPath: file.path + ".raptorcleanse-backup"),
                       "the working copy must not be left behind")
    }

    /// Only recognised cache leaves may be emptied; an arbitrary folder is refused.
    func testCacheClearingRefusesFoldersThatAreNotBrowserCaches() {
        XCTAssertThrowsError(try BrowserDataCleaner.trashCacheFiles(in: fixtureRoot, modifiedAtOrAfter: nil))
    }

    // MARK: - Fixtures

    private func makeChromiumHistory(at url: URL, recent: Date, old: Date) throws {
        try exec(url, """
            CREATE TABLE urls(id INTEGER PRIMARY KEY, url LONGVARCHAR, title LONGVARCHAR,
                              visit_count INTEGER DEFAULT 0, typed_count INTEGER DEFAULT 0,
                              last_visit_time INTEGER NOT NULL, hidden INTEGER DEFAULT 0);
            CREATE TABLE visits(id INTEGER PRIMARY KEY, url INTEGER NOT NULL, visit_time INTEGER NOT NULL,
                                from_visit INTEGER, transition INTEGER DEFAULT 0 NOT NULL);
            INSERT INTO urls VALUES(1, 'https://recent.example', 'Recent', 1, 0, \(BrowserTimestamp.chromium(from: recent)), 0);
            INSERT INTO urls VALUES(2, 'https://old.example', 'Old', 1, 0, \(BrowserTimestamp.chromium(from: old)), 0);
            INSERT INTO visits VALUES(1, 1, \(BrowserTimestamp.chromium(from: recent)), 0, 0);
            INSERT INTO visits VALUES(2, 2, \(BrowserTimestamp.chromium(from: old)), 0, 0);
            """)
    }

    private func makeFirefoxPlaces(at url: URL, now: Date) throws {
        let recent = BrowserTimestamp.firefox(from: now.addingTimeInterval(-600))
        let old = BrowserTimestamp.firefox(from: now.addingTimeInterval(-7 * 86_400))
        try exec(url, """
            CREATE TABLE moz_places(id INTEGER PRIMARY KEY, url LONGVARCHAR, title LONGVARCHAR,
                                    visit_count INTEGER DEFAULT 0, last_visit_date INTEGER,
                                    foreign_count INTEGER DEFAULT 0 NOT NULL);
            CREATE TABLE moz_historyvisits(id INTEGER PRIMARY KEY, from_visit INTEGER, place_id INTEGER,
                                           visit_date INTEGER, visit_type INTEGER);
            INSERT INTO moz_places VALUES(1, 'https://recent.example', 'Recent', 1, \(recent), 0);
            INSERT INTO moz_places VALUES(2, 'https://old.example', 'Old', 1, \(old), 0);
            INSERT INTO moz_places VALUES(3, 'https://bookmarked.example', 'Saved', 1, \(recent), 1);
            INSERT INTO moz_historyvisits VALUES(1, 0, 1, \(recent), 1);
            INSERT INTO moz_historyvisits VALUES(2, 0, 2, \(old), 1);
            INSERT INTO moz_historyvisits VALUES(3, 0, 3, \(recent), 1);
            """)
    }

    // MARK: - SQLite helpers

    private func exec(_ url: URL, _ sql: String) throws {
        var handle: OpaquePointer?
        guard sqlite3_open_v2(url.path, &handle, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE, nil) == SQLITE_OK,
              let handle else {
            throw NSError(domain: "BrowserCleanupTests", code: 1, userInfo: [NSLocalizedDescriptionKey: "could not create \(url.lastPathComponent)"])
        }
        defer { sqlite3_close(handle) }
        var error: UnsafeMutablePointer<CChar>?
        guard sqlite3_exec(handle, sql, nil, nil, &error) == SQLITE_OK else {
            let message = error.map { String(cString: $0) } ?? "unknown SQLite error"
            sqlite3_free(error)
            throw NSError(domain: "BrowserCleanupTests", code: 2, userInfo: [NSLocalizedDescriptionKey: message])
        }
    }

    private func scalar(_ url: URL, _ sql: String) throws -> Int {
        var handle: OpaquePointer?
        guard sqlite3_open_v2(url.path, &handle, SQLITE_OPEN_READONLY, nil) == SQLITE_OK, let handle else {
            throw NSError(domain: "BrowserCleanupTests", code: 3, userInfo: [NSLocalizedDescriptionKey: "could not read \(url.lastPathComponent)"])
        }
        defer { sqlite3_close(handle) }
        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }
        guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK,
              sqlite3_step(statement) == SQLITE_ROW else {
            throw NSError(domain: "BrowserCleanupTests", code: 4, userInfo: [NSLocalizedDescriptionKey: "query failed: \(sql)"])
        }
        return Int(sqlite3_column_int64(statement, 0))
    }
}
