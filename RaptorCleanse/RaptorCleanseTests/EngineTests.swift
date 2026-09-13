import Foundation
import XCTest

/// These tests never use the user's Trash or scan existing personal folders.
/// Fixture roots live under the real home directory because system temporary
/// directories are intentionally rejected by the application's safety policy.
final class EngineTests: XCTestCase {
    private var fixtureRoot: URL!
    private let manager = FileManager.default

    override func setUpWithError() throws {
        fixtureRoot = SafetyPolicy.userHomeDirectory.appendingPathComponent(
            "RaptorCleanseTests-\(UUID().uuidString)", isDirectory: true
        )
        try manager.createDirectory(at: fixtureRoot, withIntermediateDirectories: false)
        try SafetyPolicy.validateRoot(fixtureRoot)
    }

    override func tearDownWithError() throws {
        if let fixtureRoot = fixtureRoot, manager.fileExists(atPath: fixtureRoot.path) {
            try manager.removeItem(at: fixtureRoot)
        }
        fixtureRoot = nil
    }

    @discardableResult
    private func write(_ relativePath: String, text: String) throws -> URL {
        let url = fixtureRoot.appendingPathComponent(relativePath)
        try manager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data(text.utf8).write(to: url)
        return url
    }

    private func scan(options: ScanOptions = ScanOptions()) -> (ScanRoot, ScanResult) {
        let root = ScanRoot(url: fixtureRoot)
        let result = ScanEngine.scan(
            roots: [root], options: options, cancellation: CancellationFlag(), progress: { _ in }
        )
        return (root, result)
    }

    func testContainmentUsesComponentsAndRejectsRootItself() {
        let root = URL(fileURLWithPath: "/Users/example/Downloads", isDirectory: true)
        XCTAssertTrue(SafetyPolicy.isStrictDescendant(root.appendingPathComponent("report.txt"), of: root))
        XCTAssertFalse(SafetyPolicy.isStrictDescendant(root, of: root))
        XCTAssertFalse(SafetyPolicy.isStrictDescendant(
            URL(fileURLWithPath: "/Users/example/Downloads-old/report.txt"), of: root
        ))
        XCTAssertFalse(SafetyPolicy.isStrictDescendant(root.appendingPathComponent("../secret.txt"), of: root))
    }

    func testSystemHomeLibraryAndDiskRootsAreRejected() {
        let forbidden = [
            URL(fileURLWithPath: "/", isDirectory: true),
            URL(fileURLWithPath: "/System", isDirectory: true),
            URL(fileURLWithPath: "/sYsTeM", isDirectory: true),
            URL(fileURLWithPath: "/Library", isDirectory: true),
            URL(fileURLWithPath: "/Applications", isDirectory: true),
            URL(fileURLWithPath: "/Users", isDirectory: true),
            URL(fileURLWithPath: "/Volumes", isDirectory: true),
            URL(fileURLWithPath: "/private/tmp", isDirectory: true),
            SafetyPolicy.userHomeDirectory,
            URL(fileURLWithPath: SafetyPolicy.userHomeDirectory.path.uppercased(), isDirectory: true),
            SafetyPolicy.userHomeDirectory.appendingPathComponent("Library", isDirectory: true)
        ]
        for root in forbidden {
            XCTAssertThrowsError(try SafetyPolicy.validateRoot(root), "Should reject \(root.path)")
        }
    }

    func testBrowserClassifierRequiresExactSupportedCacheBranches() {
        // Classification is purely lexical: no browser profile is opened or created.
        let syntheticHome = URL(fileURLWithPath: "/Users/isolated-classifier-fixture", isDirectory: true)
        let supported: [(String, BrowserKind)] = [
            ("Library/Caches/com.apple.Safari/WebKitCache/Version 17/record", .safari),
            ("Library/Caches/com.apple.Safari/fsCachedData/record", .safari),
            ("Library/Caches/Google/Chrome/Default/Cache/Cache_Data/record", .chrome),
            ("Library/Caches/Google/Chrome/Profile 2/Code Cache/js/record", .chrome),
            ("Library/Caches/Microsoft Edge/Default/GPUCache/record", .edge),
            ("Library/Caches/BraveSoftware/Brave-Browser/Default/Cache/Cache_Data/record", .brave),
            ("Library/Caches/Firefox/Profiles/example.default/cache2/entries/record", .firefox)
        ]
        for (path, expected) in supported {
            XCTAssertEqual(
                SafetyPolicy.browserCacheKind(for: syntheticHome.appendingPathComponent(path), homeDirectory: syntheticHome),
                expected, path
            )
        }
        let excluded = [
            "Library/Caches/Google/Chrome/Default/History",
            "Library/Caches/Google/Chrome/Default/Cookies",
            "Library/Caches/Google/Chrome/Default/Login Data",
            "Library/Caches/Google/Chrome/Default/Cache/History",
            "Library/Caches/Google/Chrome/Default/Cache",
            "Library/Caches/Google/Chrome/Default/Cache-old/record",
            "Library/Caches/Google/Chrome/Profile personal/Cache/record",
            "Library/Caches/BraveSoftware/Brave-Browser/Default/History",
            "Library/Caches/com.apple.Safari/History.db",
            "Library/Caches/com.apple.Safari.backup/WebKitCache/record",
            "Library/Caches/Firefox/Profiles/example.default/cookies.sqlite",
            "Library/Application Support/Google/Chrome/Default/Cache/record",
            "Library/Caches-archive/Google/Chrome/Default/Cache/record",
            "Downloads/Cache/record"
        ]
        for path in excluded {
            XCTAssertNil(
                SafetyPolicy.browserCacheKind(for: syntheticHome.appendingPathComponent(path), homeDirectory: syntheticHome),
                path
            )
        }
    }

    func testBrowserCacheRootClassifierRequiresExactLeaves() {
        let syntheticHome = URL(fileURLWithPath: "/Users/isolated-classifier-fixture", isDirectory: true)
        let supported: [(String, BrowserKind)] = [
            ("Library/Caches/com.apple.Safari/WebKitCache", .safari),
            ("Library/Caches/Google/Chrome/Profile 2/Code Cache", .chrome),
            ("Library/Caches/Microsoft Edge/Default/GPUCache", .edge),
            ("Library/Caches/BraveSoftware/Brave-Browser/Default/Cache", .brave),
            ("Library/Caches/Firefox/Profiles/example.default/cache2", .firefox)
        ]
        for (path, expected) in supported {
            XCTAssertEqual(SafetyPolicy.browserCacheRootKind(for: syntheticHome.appendingPathComponent(path), homeDirectory: syntheticHome), expected)
        }
        for path in ["Library/Caches", "Library/Caches/Google/Chrome", "Library/Caches/Google/Chrome/Default",
                     "Library/Caches/Google/Chrome/Default/History", "Library/Caches/Google/Chrome/Default/Cache/Cache_Data",
                     "Downloads/Cache"] {
            XCTAssertNil(SafetyPolicy.browserCacheRootKind(for: syntheticHome.appendingPathComponent(path), homeDirectory: syntheticHome), path)
        }
    }

    func testDefaultScanExcludesSubfoldersAndNestedDuplicateCandidates() throws {
        let direct = try write("selected/direct.txt", text: "matching content")
        try write("selected/nested/copy.txt", text: "matching content")
        try write("outside.txt", text: "outside selection")
        let root = ScanRoot(url: direct.deletingLastPathComponent())
        XCTAssertFalse(ScanOptions().includeSubfolders)
        let result = ScanEngine.scan(roots: [root], options: ScanOptions(), cancellation: CancellationFlag(), progress: { _ in })
        XCTAssertEqual(result.files.map(\.url.path), [direct.path])
        XCTAssertNil(result.files.first?.duplicateGroup)
    }

    func testCacheCleanupPermissionUsesOnlyOneProfileParent() throws {
        let home = URL(fileURLWithPath: "/Users/isolated-classifier-fixture", isDirectory: true)
        let profile = home.appendingPathComponent("Library/Caches/Google/Chrome/Default", isDirectory: true)
        let secondProfileLeaf = home.appendingPathComponent("Library/Caches/Google/Chrome/Profile 2/Cache", isDirectory: true)
        let leaves = [profile.appendingPathComponent("Cache"), profile.appendingPathComponent("Code Cache"),
                      profile.appendingPathComponent("GPUCache"), secondProfileLeaf]
        let permissions = try SafetyPolicy.browserCachePermissionRoots(for: leaves, homeDirectory: home)
        XCTAssertEqual(Set(permissions), Set([profile, secondProfileLeaf]))
        XCTAssertFalse(permissions.contains(profile.deletingLastPathComponent()))
        XCTAssertFalse(permissions.contains(home.appendingPathComponent("Library/Caches")))
    }

    func testOneCacheLeafNeverRequestsItsParentEvenWhenDuplicated() throws {
        let home = URL(fileURLWithPath: "/Users/isolated-classifier-fixture", isDirectory: true)
        let leaf = home.appendingPathComponent("Library/Caches/Firefox/Profiles/example.default/cache2", isDirectory: true)
        let alternateURLSpelling = URL(fileURLWithPath: leaf.path, isDirectory: false)
        let permissions = try SafetyPolicy.browserCachePermissionRoots(for: [leaf, alternateURLSpelling], homeDirectory: home)
        XCTAssertEqual(permissions, [leaf])
    }

    func testCacheCleanupPermissionRejectsProfileHistoryAndBroadFolders() throws {
        let home = URL(fileURLWithPath: "/Users/isolated-classifier-fixture", isDirectory: true)
        let cache = home.appendingPathComponent("Library/Caches/Google/Chrome/Default/Cache", isDirectory: true)
        XCTAssertThrowsError(try SafetyPolicy.browserCachePermissionRoots(for: [], homeDirectory: home))
        for path in ["Library/Caches", "Library/Caches/Google/Chrome/Default", "Library/Application Support/Google/Chrome/Default/History", "Downloads"] {
            XCTAssertThrowsError(try SafetyPolicy.browserCachePermissionRoots(for: [cache, home.appendingPathComponent(path)], homeDirectory: home), path)
        }
    }

    func testRecursiveScanStaysInsideTheOneSelectedFolder() throws {
        let direct = try write("selected/direct.txt", text: "direct file")
        let nested = try write("selected/nested/deep.txt", text: "nested file")
        try write("selected-old/sibling.txt", text: "must not scan similarly named sibling")
        try write("previous-selection/old.txt", text: "must not scan previously selected folder")
        try write("parent-file.txt", text: "must not scan selected folder's parent")
        let root = ScanRoot(url: direct.deletingLastPathComponent())
        let result = ScanEngine.scan(roots: [root], options: ScanOptions(includeSubfolders: true), cancellation: CancellationFlag(), progress: { _ in })
        XCTAssertEqual(Set(result.files.map(\.url.path)), Set([direct.path, nested.path]))
        XCTAssertTrue(result.files.allSatisfy { $0.rootID == root.id && SafetyPolicy.isStrictDescendant($0.url, of: root.url) })
    }

    func testDirectorySymlinkCannotEscapeSelectedFolder() throws {
        let selected = try write("selected/direct.txt", text: "selected file")
        let outside = try write("outside/secret.txt", text: "outside selection")
        let rootURL = selected.deletingLastPathComponent()
        let link = rootURL.appendingPathComponent("outside-link")
        try manager.createSymbolicLink(at: link, withDestinationURL: outside.deletingLastPathComponent())
        let root = ScanRoot(url: rootURL)
        let result = ScanEngine.scan(roots: [root], options: ScanOptions(includeSubfolders: true), cancellation: CancellationFlag(), progress: { _ in })
        XCTAssertEqual(result.files.map(\.url.path), [selected.path])
        let snapshot = SafetyPolicy.snapshot(try SafetyPolicy.metadata(rootURL))
        XCTAssertThrowsError(try SafetyPolicy.validateScopedEntry(link.appendingPathComponent("secret.txt"), root: rootURL, rootSnapshot: snapshot))
    }

    func testScopeValidatorRejectsSiblingTraversalAndUnrequestedDepth() throws {
        let selected = try write("selected/direct.txt", text: "selected file")
        let nested = try write("selected/nested/deep.txt", text: "nested file")
        let sibling = try write("selected-old/sibling.txt", text: "sibling file")
        let root = selected.deletingLastPathComponent()
        let snapshot = SafetyPolicy.snapshot(try SafetyPolicy.metadata(root))
        XCTAssertNoThrow(try SafetyPolicy.validateScopedEntry(selected, root: root, rootSnapshot: snapshot, includeSubfolders: false))
        XCTAssertThrowsError(try SafetyPolicy.validateScopedEntry(root, root: root, rootSnapshot: snapshot))
        XCTAssertThrowsError(try SafetyPolicy.validateScopedEntry(sibling, root: root, rootSnapshot: snapshot))
        XCTAssertThrowsError(try SafetyPolicy.validateScopedEntry(root.appendingPathComponent("../selected-old/sibling.txt"), root: root, rootSnapshot: snapshot))
        XCTAssertThrowsError(try SafetyPolicy.validateScopedEntry(nested, root: root, rootSnapshot: snapshot, includeSubfolders: false))
    }

    func testReplacedRootIsRejectedEvenAtTheSamePath() throws {
        let original = try write("selected/original.txt", text: "original file")
        let root = original.deletingLastPathComponent()
        let snapshot = SafetyPolicy.snapshot(try SafetyPolicy.metadata(root))
        try manager.moveItem(at: root, to: fixtureRoot.appendingPathComponent("moved-selection"))
        let replacement = try write("selected/replacement.txt", text: "different folder at same pathname")
        XCTAssertThrowsError(try SafetyPolicy.validateScopedEntry(replacement, root: root, rootSnapshot: snapshot))
    }

    func testExplicitNestedRootsRemainIndependentWhenRecursionIsDisabled() throws {
        let direct = try write("direct.txt", text: "direct file")
        let nested = try write("nested/inner.txt", text: "explicit nested selection")
        let roots = [ScanRoot(url: fixtureRoot), ScanRoot(url: nested.deletingLastPathComponent())]
        let result = ScanEngine.scan(roots: roots, options: ScanOptions(), cancellation: CancellationFlag(), progress: { _ in })
        XCTAssertEqual(Set(result.files.map(\.url.path)), Set([direct.path, nested.path]))
        XCTAssertEqual(result.files.first { $0.url == nested }?.rootID, roots[1].id)
    }

    func testCloudAndPackageRootsAreRejectedAndTheirContentsAreNotScanned() throws {
        try write("ordinary.txt", text: "ordinary local file")
        for folder in ["Dropbox", "OneDrive - Example", "Google Drive", "Example.app", "Pictures.photoslibrary"] {
            try write("\(folder)/must-remain.txt", text: "protected content")
            XCTAssertThrowsError(try SafetyPolicy.validateRoot(fixtureRoot.appendingPathComponent(folder)))
        }
        let (_, result) = scan(options: ScanOptions(includeSubfolders: true))
        XCTAssertFalse(result.wasCancelled)
        XCTAssertEqual(result.files.map(\.name), ["ordinary.txt"])
    }

    func testSymlinkRootsAndSymlinkFilesAreExcluded() throws {
        let target = try write("real/visible.txt", text: "real file")
        let directoryLink = fixtureRoot.appendingPathComponent("directory-link")
        let fileLink = fixtureRoot.appendingPathComponent("file-link.txt")
        try manager.createSymbolicLink(at: directoryLink, withDestinationURL: target.deletingLastPathComponent())
        try manager.createSymbolicLink(at: fileLink, withDestinationURL: target)
        XCTAssertThrowsError(try SafetyPolicy.validateRoot(directoryLink))
        let (_, result) = scan(options: ScanOptions(includeSubfolders: true))
        XCTAssertEqual(result.files.map(\.url.path), [target.path])
    }

    func testFinderAliasIsExcluded() throws {
        let target = try write("real.txt", text: "alias target")
        let alias = fixtureRoot.appendingPathComponent("shortcut.alias")
        let bookmark = try target.bookmarkData(options: .suitableForBookmarkFile, includingResourceValuesForKeys: nil, relativeTo: nil)
        try URL.writeBookmarkData(bookmark, to: alias, options: [])
        XCTAssertEqual(try alias.resourceValues(forKeys: [.isAliasFileKey]).isAliasFile, true)
        let (_, result) = scan()
        XCTAssertEqual(result.files.map(\.url.path), [target.path])
    }

    func testDuplicateGroupsRequireEqualContentNotOnlyEqualLength() throws {
        let firstURL = try write("first.txt", text: "identical payload")
        let copyURL = try write("copy.txt", text: "identical payload")
        let differentURL = try write("different.txt", text: "different payload")
        let (_, result) = scan()
        XCTAssertEqual(result.files.count, 3)
        let first = try XCTUnwrap(result.files.first(where: { $0.url == firstURL }))
        let copy = try XCTUnwrap(result.files.first(where: { $0.url == copyURL }))
        let different = try XCTUnwrap(result.files.first(where: { $0.url == differentURL }))
        XCTAssertEqual(first.byteCount, different.byteCount, "Fixture must challenge size-only grouping")
        XCTAssertNotNil(first.duplicateGroup)
        XCTAssertEqual(first.duplicateGroup, copy.duplicateGroup)
        XCTAssertNil(different.duplicateGroup)
    }

    func testDuplicateDetectionCanBeDisabled() throws {
        try write("first.txt", text: "identical payload")
        try write("copy.txt", text: "identical payload")
        var options = ScanOptions()
        options.detectDuplicates = false
        let (_, result) = scan(options: options)
        XCTAssertEqual(result.files.count, 2)
        XCTAssertTrue(result.files.allSatisfy { $0.duplicateGroup == nil })
    }

    func testChangedFileNeverReachesTrashOperation() throws {
        let url = try write("changed.txt", text: "original")
        let (root, result) = scan()
        let file = try XCTUnwrap(result.files.first)
        try Data("changed after scanning".utf8).write(to: url)
        var calledPaths: [String] = []
        let cleanup = TrashService.clean(
            files: [file], allFiles: result.files, roots: [root], runningBrowserIDs: [],
            trashOperation: { calledPaths.append($0.path) }
        )
        XCTAssertTrue(calledPaths.isEmpty)
        XCTAssertTrue(cleanup.trashedIDs.isEmpty)
        XCTAssertEqual(cleanup.failures.count, 1)
        XCTAssertEqual(try String(contentsOf: url, encoding: .utf8), "changed after scanning")
    }

    func testSiblingFileNeverReachesTrashAfterScopeChanges() throws {
        let chosen = try write("selected/chosen.txt", text: "selected folder file")
        let sibling = try write("selected-old/sibling.txt", text: "sibling must remain")
        let (originalRoot, result) = scan(options: ScanOptions(includeSubfolders: true))
        let siblingFile = try XCTUnwrap(result.files.first { $0.url == sibling })
        let restrictedRoot = ScanRoot(id: originalRoot.id, url: chosen.deletingLastPathComponent())
        var operationCount = 0
        let cleanup = TrashService.clean(files: [siblingFile], allFiles: result.files, roots: [restrictedRoot],
                                         runningBrowserIDs: [], trashOperation: { _ in operationCount += 1 })
        XCTAssertEqual(operationCount, 0)
        XCTAssertTrue(cleanup.trashedIDs.isEmpty)
        XCTAssertEqual(cleanup.failures.count, 1)
        XCTAssertEqual(try String(contentsOf: sibling, encoding: .utf8), "sibling must remain")
    }

    func testPathReplacedBySymlinkNeverReachesTrashOperation() throws {
        let selectedURL = try write("selected.txt", text: "original selected file")
        let targetURL = try write("target.txt", text: "keep this file")
        let (root, result) = scan()
        let selected = try XCTUnwrap(result.files.first(where: { $0.url == selectedURL }))
        try manager.removeItem(at: selectedURL)
        try manager.createSymbolicLink(at: selectedURL, withDestinationURL: targetURL)
        var operationCount = 0
        let cleanup = TrashService.clean(
            files: [selected], allFiles: result.files, roots: [root], runningBrowserIDs: [],
            trashOperation: { _ in operationCount += 1 }
        )
        XCTAssertEqual(operationCount, 0)
        XCTAssertTrue(cleanup.trashedIDs.isEmpty)
        XCTAssertEqual(cleanup.failures.count, 1)
        XCTAssertEqual(try String(contentsOf: targetURL, encoding: .utf8), "keep this file")
    }

    func testSelectingEveryDuplicateIsRejected() throws {
        try write("first.txt", text: "identical payload")
        try write("copy.txt", text: "identical payload")
        let (root, result) = scan()
        XCTAssertEqual(result.files.count, 2)
        XCTAssertTrue(result.files.allSatisfy { $0.duplicateGroup != nil })
        var operationCount = 0
        let cleanup = TrashService.clean(
            files: result.files, allFiles: result.files, roots: [root], runningBrowserIDs: [],
            trashOperation: { _ in operationCount += 1 }
        )
        XCTAssertEqual(operationCount, 0)
        XCTAssertTrue(cleanup.trashedIDs.isEmpty)
        XCTAssertEqual(cleanup.failures.count, 2)
    }

    func testOneDuplicateCanBeSelectedWhenAnUnchangedKeeperRemains() throws {
        try write("first.txt", text: "identical payload")
        try write("copy.txt", text: "identical payload")
        let (root, result) = scan()
        let selected = try XCTUnwrap(result.files.first)
        var calledPaths: [String] = []
        let cleanup = TrashService.clean(
            files: [selected], allFiles: result.files, roots: [root], runningBrowserIDs: [],
            trashOperation: { calledPaths.append($0.path) }
        )
        XCTAssertEqual(calledPaths, [selected.url.path])
        XCTAssertEqual(cleanup.trashedIDs, Set([selected.id]))
        XCTAssertTrue(cleanup.failures.isEmpty)
    }

    func testChangedDuplicateKeeperPreventsRemovalOfRemainingOriginal() throws {
        let selectedURL = try write("selected.txt", text: "identical payload")
        let keeperURL = try write("keeper.txt", text: "identical payload")
        let (root, result) = scan()
        let selected = try XCTUnwrap(result.files.first(where: { $0.url == selectedURL }))
        try Data("keeper changed after scan".utf8).write(to: keeperURL)
        var operationCount = 0
        let cleanup = TrashService.clean(
            files: [selected], allFiles: result.files, roots: [root], runningBrowserIDs: [],
            trashOperation: { _ in operationCount += 1 }
        )
        XCTAssertEqual(operationCount, 0)
        XCTAssertTrue(cleanup.trashedIDs.isEmpty)
        XCTAssertEqual(cleanup.failures.count, 1)
    }

    func testMissingDuplicateKeeperPreventsRemovalOfRemainingOriginal() throws {
        let selectedURL = try write("selected.txt", text: "identical payload")
        let keeperURL = try write("keeper.txt", text: "identical payload")
        let (root, result) = scan()
        let selected = try XCTUnwrap(result.files.first(where: { $0.url == selectedURL }))
        try manager.removeItem(at: keeperURL)
        var operationCount = 0
        let cleanup = TrashService.clean(
            files: [selected], allFiles: result.files, roots: [root], runningBrowserIDs: [],
            trashOperation: { _ in operationCount += 1 }
        )
        XCTAssertEqual(operationCount, 0)
        XCTAssertTrue(cleanup.trashedIDs.isEmpty)
        XCTAssertEqual(cleanup.failures.count, 1)
    }

    func testTrashOperationFailureIsReportedWithoutClaimingSpace() throws {
        try write("ordinary.txt", text: "ordinary local file")
        let (root, result) = scan()
        let file = try XCTUnwrap(result.files.first)
        let cleanup = TrashService.clean(
            files: [file], allFiles: result.files, roots: [root], runningBrowserIDs: [],
            trashOperation: { _ in throw NSError(domain: "TestTrashFailure", code: 1) }
        )
        XCTAssertTrue(cleanup.trashedIDs.isEmpty)
        XCTAssertEqual(cleanup.movedBytes, 0)
        XCTAssertEqual(cleanup.failures.count, 1)
        XCTAssertTrue(manager.fileExists(atPath: file.url.path))
    }

    func testCancelledScanReturnsWithoutFiles() throws {
        try write("ordinary.txt", text: "ordinary local file")
        let cancellation = CancellationFlag()
        cancellation.cancel()
        let result = ScanEngine.scan(
            roots: [ScanRoot(url: fixtureRoot)], options: ScanOptions(),
            cancellation: cancellation, progress: { _ in }
        )
        XCTAssertTrue(result.wasCancelled)
        XCTAssertTrue(result.files.isEmpty)
    }

    func testOverlappingRootsAndHardLinksAreCountedOnce() throws {
        let original = try write("nested/original.txt", text: "one physical file")
        try manager.linkItem(at: original, to: fixtureRoot.appendingPathComponent("hard-link.txt"))
        let roots = [ScanRoot(url: original.deletingLastPathComponent()), ScanRoot(url: fixtureRoot)]
        let result = ScanEngine.scan(roots: roots, options: ScanOptions(includeSubfolders: true), cancellation: CancellationFlag(), progress: { _ in })
        XCTAssertEqual(result.files.count, 1)
        XCTAssertNil(result.files.first?.duplicateGroup)
        XCTAssertEqual(result.files.first?.rootID, roots[1].id)
    }

    func testNestedLibraryCannotBypassProtectionThroughBroadSelection() throws {
        try write("ordinary.txt", text: "allowed")
        try write("Library/Application Support/Browser/History", text: "protected")
        try write("Library/Caches/UnknownApp/cache.bin", text: "unsupported cache")
        try write("nested/library/Application Support/Browser/History", text: "case-variant protected")
        let (_, result) = scan(options: ScanOptions(includeSubfolders: true))
        XCTAssertEqual(result.files.map(\.name), ["ordinary.txt"])
        XCTAssertGreaterThan(result.skippedCount, 0)
    }

    func testEntryLimitReturnsBoundedResultsAndWarning() throws {
        try write("first.txt", text: "one")
        try write("second.txt", text: "two")
        try write("third.txt", text: "three")
        var options = ScanOptions()
        options.maximumFiles = 1
        let (_, result) = scan(options: options)
        XCTAssertLessThanOrEqual(result.files.count, 1)
        XCTAssertTrue(result.warnings.contains { $0.contains("Stopped after 1 filesystem entries") })
    }
}
