import XCTest
import Foundation
import SQLite3

final class BrowserTests: XCTestCase {
    private var folder: URL!

    override func setUpWithError() throws {
        folder = FileManager.default.temporaryDirectory.resolvingSymlinksInPath().appendingPathComponent("RaptorBrowserTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    }
    override func tearDownWithError() throws {
        if let folder { try FileManager.default.removeItem(at: folder) }
    }

    private func database(_ name: String = "History", statements: String) throws -> URL {
        let url = folder.appendingPathComponent(name)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        var database: OpaquePointer?
        guard sqlite3_open_v2(url.path, &database, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE, nil) == SQLITE_OK else { throw CocoaError(.fileWriteUnknown) }
        defer { sqlite3_close(database) }
        guard sqlite3_exec(database, statements, nil, nil, nil) == SQLITE_OK else { throw CocoaError(.fileWriteUnknown) }
        return url
    }

    private let chromeSQL = "CREATE TABLE visits(id INTEGER PRIMARY KEY, url INTEGER, visit_time INTEGER); INSERT INTO visits VALUES(1, 1, 100), (2, 1, 200), (3, 2, 300);"

    func testChromiumCountsVisitRowsWithoutChangingDatabaseOrCreatingSidecars() throws {
        let url = try database(statements: chromeSQL)
        let before = try Data(contentsOf: url)
        let names = try FileManager.default.contentsOfDirectory(atPath: folder.path)
        let summary = BrowserHistoryReader.readCount(at: url, browser: .chrome, authorizedRoots: [folder])
        XCTAssertEqual(summary.count, 3)
        XCTAssertEqual(summary.state, .available)
        XCTAssertEqual(try Data(contentsOf: url), before)
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: folder.path).sorted(), names.sorted())
    }

    func testSQLiteURIHandlesSpacesQuestionMarksAndHashesInFilename() throws {
        let url = try database("History #1? sample", statements: chromeSQL)
        let summary = BrowserHistoryReader.readCount(at: url, browser: .brave, authorizedRoots: [folder])
        XCTAssertEqual(summary.state, .available)
        XCTAssertEqual(summary.count, 3)
    }

    func testFirefoxCountsVisitsAndLeavesBookmarksByteForByteUnchanged() throws {
        let url = try database("places.sqlite", statements: "CREATE TABLE moz_historyvisits(id INTEGER PRIMARY KEY, place_id INTEGER, visit_date INTEGER); INSERT INTO moz_historyvisits VALUES(1, 2, 100); CREATE TABLE moz_places(id INTEGER, url TEXT); INSERT INTO moz_places VALUES(2, 'https://example.invalid'); CREATE TABLE moz_bookmarks(id INTEGER, fk INTEGER, title TEXT); INSERT INTO moz_bookmarks VALUES(1, 2, 'Keep this bookmark');")
        let before = try Data(contentsOf: url)
        let summary = BrowserHistoryReader.readCount(at: url, browser: .firefox, authorizedRoots: [folder])
        XCTAssertEqual(summary.count, 1)
        XCTAssertEqual(summary.state, .available)
        XCTAssertEqual(try Data(contentsOf: url), before)
    }

    func testSafariCountsHistoryVisits() throws {
        let url = try database("History.db", statements: "CREATE TABLE history_visits(id INTEGER PRIMARY KEY, history_item INTEGER, visit_time REAL); INSERT INTO history_visits VALUES(1, 10, 100), (2, 10, 200);")
        XCTAssertEqual(BrowserHistoryReader.readCount(at: url, browser: .safari, authorizedRoots: [folder]).count, 2)
    }

    func testEmptySupportedHistoryIsDistinctFromUnavailable() throws {
        let url = try database(statements: "CREATE TABLE visits(id INTEGER PRIMARY KEY, url INTEGER, visit_time INTEGER);")
        let summary = BrowserHistoryReader.readCount(at: url, browser: .chrome, authorizedRoots: [folder])
        XCTAssertEqual(summary.state, .available)
        XCTAssertEqual(summary.count, 0)
    }

    func testMissingAndUnauthorizedHistoryAreNeverReportedAsZero() {
        let url = folder.appendingPathComponent("missing")
        let missing = BrowserHistoryReader.readCount(at: url, browser: .chrome, authorizedRoots: [folder])
        XCTAssertEqual(missing.state, .missing)
        XCTAssertNil(missing.count)
        let unauthorized = BrowserHistoryReader.readCount(at: url, browser: .chrome, authorizedRoots: [])
        XCTAssertEqual(unauthorized.state, .permissionRequired)
        XCTAssertNil(unauthorized.count)
    }

    func testUnrecognisedSchemaAndViewAreNotReadAsHistory() throws {
        let unknown = try database("unknown", statements: "CREATE TABLE other(id INTEGER);")
        XCTAssertEqual(BrowserHistoryReader.readCount(at: unknown, browser: .chrome, authorizedRoots: [folder]).state, .unsupported)
        let view = try database("view", statements: "CREATE TABLE data(id INTEGER, url INTEGER, visit_time INTEGER); CREATE VIEW visits AS SELECT * FROM data;")
        let summary = BrowserHistoryReader.readCount(at: view, browser: .chrome, authorizedRoots: [folder])
        XCTAssertEqual(summary.state, .unsupported)
        XCTAssertNil(summary.count)
    }

    func testCorruptDatabaseIsNotReportedAsZero() throws {
        let url = folder.appendingPathComponent("corrupt")
        try Data(repeating: 0x51, count: 4_096).write(to: url)
        let summary = BrowserHistoryReader.readCount(at: url, browser: .chrome, authorizedRoots: [folder])
        XCTAssertEqual(summary.state, .unreadable)
        XCTAssertNil(summary.count)
    }

    func testNonemptyWALOrJournalRequiresRefreshAfterBrowserQuit() throws {
        let url = try database(statements: chromeSQL)
        for suffix in ["-wal", "-journal"] {
            let sidecar = URL(fileURLWithPath: url.path + suffix)
            try Data(repeating: 0x01, count: 128).write(to: sidecar)
            let summary = BrowserHistoryReader.readCount(at: url, browser: .chrome, authorizedRoots: [folder])
            XCTAssertEqual(summary.state, .busy)
            XCTAssertNil(summary.count)
            XCTAssertEqual(try Data(contentsOf: sidecar).count, 128)
            try FileManager.default.removeItem(at: sidecar)
        }
    }

    func testDatabaseAndSidecarLinksAreRejected() throws {
        let url = try database(statements: chromeSQL)
        let link = folder.appendingPathComponent("link")
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: url)
        XCTAssertEqual(BrowserHistoryReader.readCount(at: link, browser: .chrome, authorizedRoots: [folder]).state, .unreadable)
        let target = folder.appendingPathComponent("other")
        try Data().write(to: target)
        try FileManager.default.createSymbolicLink(at: URL(fileURLWithPath: url.path + "-wal"), withDestinationURL: target)
        XCTAssertEqual(BrowserHistoryReader.readCount(at: url, browser: .chrome, authorizedRoots: [folder]).state, .unreadable)
    }

    func testInstalledBrowserDetectionUsesInjectedBundleIdentifiers() {
        var requested: Set<String> = []
        let installations = BrowserDiscovery.installations(applicationURL: { identifier in
            requested.insert(identifier)
            return identifier == "com.google.Chrome" ? URL(fileURLWithPath: "/Applications/Google Chrome.app") : nil
        }, runningIDs: ["com.google.Chrome"])
        XCTAssertEqual(installations.count, 1)
        XCTAssertEqual(installations.first?.browser, .chrome)
        XCTAssertEqual(installations.first?.isRunning, true)
        XCTAssertTrue(requested.contains("com.brave.Browser"))
    }

    func testChromiumProfilesUseLocalMetadataAndIgnoreUnrelatedDirectories() throws {
        let url = try database("Library/Application Support/Google/Chrome/Default/History", statements: chromeSQL)
        let root = url.deletingLastPathComponent().deletingLastPathComponent()
        let state = Data("{\"profile\":{\"info_cache\":{\"Default\":{\"name\":\"Workshop\"}}}}".utf8)
        try state.write(to: root.appendingPathComponent("Local State"))
        for index in 0..<60 { try FileManager.default.createDirectory(at: root.appendingPathComponent("A-Unrelated-\(index)"), withIntermediateDirectories: false) }
        let installations = BrowserDiscovery.installations(applicationURL: { $0 == "com.google.Chrome" ? URL(fileURLWithPath: "/Applications/Google Chrome.app") : nil }, runningIDs: [])
        let library = folder.appendingPathComponent("Library")
        let result = BrowserDiscovery.discover(installations: installations, authorizedRoots: [library], home: folder)
        XCTAssertEqual(result.profiles.count, 1)
        XCTAssertEqual(result.profiles.first?.displayName, "Workshop")
        XCTAssertEqual(result.profiles.first?.historyCount, 3)
    }

    func testFirefoxIniNamesProfilesButCannotEscapeProfileDirectory() throws {
        _ = try database("Library/Application Support/Firefox/Profiles/abcd.default/places.sqlite", statements: "CREATE TABLE moz_historyvisits(id INTEGER PRIMARY KEY, place_id INTEGER, visit_date INTEGER);")
        let root = folder.appendingPathComponent("Library/Application Support/Firefox")
        let ini = "[Profile0]\nName=Workshop\nIsRelative=1\nPath=Profiles/abcd.default\n[Profile1]\nName=Escape\nIsRelative=1\nPath=../../Outside\n"
        try Data(ini.utf8).write(to: root.appendingPathComponent("profiles.ini"))
        let installations = BrowserDiscovery.installations(applicationURL: { $0 == "org.mozilla.firefox" ? URL(fileURLWithPath: "/Applications/Firefox.app") : nil }, runningIDs: [])
        let result = BrowserDiscovery.discover(installations: installations, authorizedRoots: [folder.appendingPathComponent("Library")], home: folder)
        XCTAssertEqual(result.profiles.count, 1)
        XCTAssertEqual(result.profiles.first?.displayName, "Workshop")
        XCTAssertEqual(result.profiles.first?.historyCount, 0)
    }

    func testBrowserPermissionRejectsHomeAndUnrelatedFolders() throws {
        let library = folder.appendingPathComponent("Library", isDirectory: true)
        let downloads = folder.appendingPathComponent("Downloads", isDirectory: true)
        try FileManager.default.createDirectory(at: library, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: downloads, withIntermediateDirectories: true)
        XCTAssertNoThrow(try BrowserDiscovery.validatePermissionRoot(library, home: folder))
        XCTAssertThrowsError(try BrowserDiscovery.validatePermissionRoot(folder, home: folder))
        XCTAssertThrowsError(try BrowserDiscovery.validatePermissionRoot(downloads, home: folder))
        XCTAssertFalse(BrowserDiscovery.hasPermission(for: downloads, roots: [library]))
    }
}
