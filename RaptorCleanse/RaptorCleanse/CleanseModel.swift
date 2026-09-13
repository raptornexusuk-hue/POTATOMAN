import AppKit
import Combine
import Foundation
import UniformTypeIdentifiers

@MainActor
final class CleanseModel: ObservableObject {
    @Published var section: CleanseSection = .overview
    @Published private(set) var roots: [ScanRoot] = []
    @Published private(set) var isBrowserCacheReview = false
    @Published private(set) var lastScanScope = ""
    @Published var includeSubfolders = false {
        didSet {
            if includeSubfolders != oldValue && !isBrowserCacheReview && !isScanning && !isCleaning {
                invalidateResults()
                statusMessage = "Folder scope changed. Scan when you’re ready."
            }
        }
    }
    @Published var files: [ScannedFile] = []
    @Published var selectedIDs: Set<String> = []
    @Published var isScanning = false
    @Published var isCleaning = false
    @Published var progress = ScanProgress(visitedCount: 0, foundCount: 0, message: "Choose a folder to begin.")
    @Published var warnings: [String] = []
    @Published var activity: [ActivityEntry] = []
    @Published var storage = StorageInfo()
    @Published var lastScan: Date?
    @Published var statusMessage = "Choose one folder, scan, then review your files."
    @Published var searchText = ""
    @Published var detectDuplicates = true {
        didSet { UserDefaults.standard.set(detectDuplicates, forKey: "detectDuplicates") }
    }
    @Published var largeFileMegabytes = 50 {
        didSet {
            UserDefaults.standard.set(largeFileMegabytes, forKey: "largeFileMegabytes")
            if largeFileMegabytes != oldValue { refreshCounts() }
        }
    }
    @Published var sortOrder: CleanseSortOrder = .largestFirst {
        didSet { UserDefaults.standard.set(sortOrder.rawValue, forKey: "reviewSortOrder") }
    }
    /// Counts behind the review tabs. Recomputed when the results or the large-file
    /// threshold change, rather than filtering every file on each redraw.
    @Published private(set) var largeFileCount = 0
    @Published private(set) var duplicateFileCount = 0
    @Published var showCleanupConfirmation = false
    @Published var errorMessage: String?
    private var cancellation: CancellationFlag?
    private var scanID = UUID()
    private var scopedURLs: [UUID: URL] = [:]
    private var browserCleanupGrantScopes: [URL] = []
    private var pendingCleanup: [ScannedFile] = []

    var activeScopeDescription: String {
        guard !roots.isEmpty else { return "No folder selected" }
        let scope = roots.map { $0.url.standardizedFileURL.path }.joined(separator: "\n")
        let depth = (isBrowserCacheReview || includeSubfolders) ? "Including subfolders" : "This folder only · subfolders excluded"
        return "\(scope)\n\(depth)"
    }

    var canScan: Bool { !roots.isEmpty && !isScanning && !isCleaning }
    var selectedFiles: [ScannedFile] { files.filter { selectedIDs.contains($0.id) } }
    var selectedBytes: Int64 { selectedFiles.reduce(0) { $0 + $1.byteCount } }
    var totalReviewBytes: Int64 { files.reduce(0) { $0 + $1.byteCount } }
    var cacheFiles: [ScannedFile] { files.filter { $0.browser != nil } }
    var duplicateFiles: [ScannedFile] { files.filter { $0.duplicateGroup != nil } }
    var visibleFiles: [ScannedFile] {
        var candidates: [ScannedFile]
        switch section {
        case .cache: candidates = cacheFiles
        case .large: candidates = files.filter { $0.byteCount >= Int64(largeFileMegabytes) * 1_024 * 1_024 }
        case .duplicates: candidates = duplicateFiles
        default: candidates = files
        }
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !query.isEmpty {
            candidates = candidates.filter { $0.url.path.localizedCaseInsensitiveContains(query) }
        }
        return CleanseSorting.sorted(candidates, order: sortOrder, groupingDuplicates: section == .duplicates)
    }

    /// Recompute the review tab counts from the current results.
    private func refreshCounts() {
        let threshold = Int64(largeFileMegabytes) * 1_024 * 1_024
        largeFileCount = files.reduce(0) { $0 + ($1.byteCount >= threshold ? 1 : 0) }
        duplicateFileCount = files.reduce(0) { $0 + ($1.duplicateGroup != nil ? 1 : 0) }
    }

    init() {
        let defaults = UserDefaults.standard
        if defaults.object(forKey: "detectDuplicates") != nil {
            detectDuplicates = defaults.bool(forKey: "detectDuplicates")
        }
        let savedThreshold = defaults.integer(forKey: "largeFileMegabytes")
        if [50, 100, 250, 500].contains(savedThreshold) { largeFileMegabytes = savedThreshold }
        if let savedOrder = defaults.string(forKey: "reviewSortOrder"),
           let order = CleanseSortOrder(rawValue: savedOrder) { sortOrder = order }
        // v0.1 accumulated every previous folder and silently restored them as active.
        // Each new session now starts with no active folder, regardless of old bookmarks.
        defaults.removeObject(forKey: "selectedFolderBookmarks.v1")
        refreshStorage()
    }

    func chooseFolder() { chooseFolders(cache: false) }

    /// Return to Folder review from a browser-cache review. The sidebar used to
    /// call `chooseFolder()` here, so clicking "Folder review" threw up an open
    /// panel before the person had asked for one.
    func showFolderReview() {
        guard !isScanning && !isCleaning else { return }
        if isBrowserCacheReview { clearBrowserCacheScope() }
        section = .files
        searchText = ""
    }
    func addFolders() { chooseFolder() }
    func addBrowserCacheFolder() { chooseFolders(cache: true) }

    private func chooseFolders(cache: Bool) {
        guard !isScanning && !isCleaning else { return }
        let panel = NSOpenPanel()
        panel.title = cache ? "Choose a browser cache folder" : "Choose one folder to review"
        panel.message = cache
            ? "Choose a recognised Cache, Code Cache, GPUCache, WebKitCache, fsCachedData or cache2 folder. This replaces the current scan scope."
            : "This folder replaces the previous selection. Subfolders are excluded unless you turn on Include subfolders."
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.canCreateDirectories = false
        panel.showsHiddenFiles = cache
        panel.prompt = "Choose folder"
        panel.directoryURL = SafetyPolicy.userHomeDirectory.appendingPathComponent(cache ? "Library/Caches" : "Downloads")
        guard panel.runModal() == .OK, let url = panel.url else { return }
        if cache { beginBrowserCacheReview([url], authorisedDirectories: [url]) }
        else if replaceRoots([url], browserCache: false) { section = .files }
    }

    /// Browser discovery permissions are read-only. Cache cleanup requires its own
    /// explicit, narrowly scoped folder selection, including in the direct build.
    func reviewBrowserCache(_ urls: [URL]) {
        guard !isScanning && !isCleaning else { return }
        do {
            let permissionRoots = try SafetyPolicy.browserCachePermissionRoots(for: urls)
            var authorisedDirectories: [URL] = []
            for expected in permissionRoots {
                let leaves = urls.filter { $0.standardizedFileURL.path == expected.path || SafetyPolicy.isStrictDescendant($0, of: expected) }
                let browserName = leaves.first.flatMap { SafetyPolicy.browserCacheRootKind(for: $0)?.rawValue } ?? "browser"
                let panel = NSOpenPanel()
                panel.title = "Allow cache cleanup for \(browserName)"
                panel.message = "Choose the displayed cache folder to allow reviewed files to move to Trash. History access stays read-only.\n\n\(expected.path)\n\nOnly the detected cache folders will be scanned."
                panel.canChooseDirectories = true
                panel.canChooseFiles = false
                panel.allowsMultipleSelection = false
                panel.canCreateDirectories = false
                panel.showsHiddenFiles = true
                panel.prompt = "Allow cache cleanup"
                panel.directoryURL = expected
                guard panel.runModal() == .OK, let chosen = panel.url else { return }
                guard chosen.standardizedFileURL.path == expected.standardizedFileURL.path else {
                    throw CleanseSafetyError.rejected("Choose exactly \(expected.path). Selecting another folder does not expand the cache scan.")
                }
                authorisedDirectories.append(chosen)
            }
            beginBrowserCacheReview(urls, authorisedDirectories: authorisedDirectories)
        } catch { errorMessage = error.localizedDescription }
    }

    /// Called only with directory URLs returned by this model's writable folder picker.
    /// Discovery's read-only profile URLs cannot authorise this operation by themselves.
    private func beginBrowserCacheReview(_ urls: [URL], authorisedDirectories: [URL]) {
        guard !isScanning && !isCleaning else { return }
        var heldScopes: [URL] = []
        var transferred = false
        defer {
            if !transferred { for url in heldScopes { url.stopAccessingSecurityScopedResource() } }
        }
        do {
            let expected = try SafetyPolicy.browserCachePermissionRoots(for: urls)
            guard Set(authorisedDirectories.map { $0.standardizedFileURL.path }) == Set(expected.map(\.path)) else {
                throw CleanseSafetyError.rejected("Cache cleanup requires permission for exactly the displayed cache folders.")
            }
            for url in authorisedDirectories {
                if url.startAccessingSecurityScopedResource() { heldScopes.append(url) }
                try SafetyPolicy.validateRoot(url)
            }
            let authorisedLeaves = try urls.map { leaf -> URL in
                guard let permission = authorisedDirectories.first(where: {
                    $0.standardizedFileURL.path == leaf.standardizedFileURL.path || SafetyPolicy.isStrictDescendant(leaf, of: $0)
                }) else {
                    throw CleanseSafetyError.rejected("A detected cache folder is outside the cleanup permission.")
                }
                let relative = leaf.standardizedFileURL.pathComponents.dropFirst(permission.standardizedFileURL.pathComponents.count)
                return relative.reduce(permission) { $0.appendingPathComponent($1, isDirectory: true) }
            }
            guard replaceRoots(authorisedLeaves, browserCache: true, cleanupGrantScopes: heldScopes) else { return }
            transferred = true
        } catch {
            errorMessage = error.localizedDescription
            return
        }
        section = .cache
        scan()
    }

    @discardableResult
    private func replaceRoots(_ urls: [URL], browserCache: Bool, cleanupGrantScopes: [URL] = []) -> Bool {
        guard !isScanning && !isCleaning else { return false }
        guard !urls.isEmpty, browserCache || urls.count == 1 else {
            errorMessage = browserCache ? "No accessible supported browser cache folders were found." : "Choose exactly one folder."
            return false
        }
        var newRoots: [ScanRoot] = []
        var newScopes: [UUID: URL] = [:]
        do {
            var seen = Set<String>()
            for url in urls {
                guard seen.insert(url.standardizedFileURL.path).inserted else { continue }
                let root = ScanRoot(url: url)
                if url.startAccessingSecurityScopedResource() { newScopes[root.id] = url }
                try SafetyPolicy.validateRoot(url)
                if browserCache, SafetyPolicy.browserCacheRootKind(for: url) == nil {
                    throw CleanseSafetyError.rejected("Only exact recognised browser cache folders can enter a browser-cache review.")
                }
                newRoots.append(root)
            }
            for url in scopedURLs.values { url.stopAccessingSecurityScopedResource() }
            for url in browserCleanupGrantScopes { url.stopAccessingSecurityScopedResource() }
            scopedURLs = newScopes
            browserCleanupGrantScopes = cleanupGrantScopes
            roots = newRoots
            isBrowserCacheReview = browserCache
            invalidateResults()
            searchText = ""
            warnings = []
            progress = ScanProgress(visitedCount: 0, foundCount: 0, message: "Ready to scan the displayed scope.")
            statusMessage = browserCache ? "Browser cache scope selected." : "Folder selected. Scan when you’re ready."
            return true
        } catch {
            for url in newScopes.values { url.stopAccessingSecurityScopedResource() }
            errorMessage = error.localizedDescription
            return false
        }
    }

    /// Forget access is disabled during a scan or cleanup so scopes cannot be
    /// released while a worker is using them. Pending confirmations are discarded.
    func clearBrowserCacheScope() {
        guard isBrowserCacheReview && !isScanning && !isCleaning else { return }
        for url in scopedURLs.values { url.stopAccessingSecurityScopedResource() }
        for url in browserCleanupGrantScopes { url.stopAccessingSecurityScopedResource() }
        scopedURLs.removeAll()
        browserCleanupGrantScopes.removeAll()
        roots.removeAll()
        isBrowserCacheReview = false
        invalidateResults()
        warnings = []
        searchText = ""
        statusMessage = "Browser cache access cleared. Choose a folder or detect browsers to begin."
        progress = ScanProgress(visitedCount: 0, foundCount: 0, message: statusMessage)
    }

    func removeRoot(_ root: ScanRoot) {
        guard !isScanning && !isCleaning else { return }
        if let url = scopedURLs.removeValue(forKey: root.id) { url.stopAccessingSecurityScopedResource() }
        roots.removeAll { $0.id == root.id }
        if roots.isEmpty {
            isBrowserCacheReview = false
            for url in browserCleanupGrantScopes { url.stopAccessingSecurityScopedResource() }
            browserCleanupGrantScopes.removeAll()
        }
        invalidateResults()
        statusMessage = roots.isEmpty ? "Choose one folder to begin." : "Scan scope changed. Scan when you’re ready."
        progress = ScanProgress(visitedCount: 0, foundCount: 0, message: statusMessage)
    }

    private func invalidateResults() {
        files = []; selectedIDs = []; pendingCleanup = []; lastScan = nil
        lastScanScope = ""
        showCleanupConfirmation = false
        refreshCounts()
    }

    func scan() {
        guard canScan else { return }
        let token = CancellationFlag()
        cancellation = token
        let currentID = UUID()
        scanID = currentID
        let scanRoots = roots
        let options = ScanOptions(largeFileBytes: Int64(largeFileMegabytes) * 1_024 * 1_024,
                                  detectDuplicates: !isBrowserCacheReview && detectDuplicates,
                                  includeSubfolders: isBrowserCacheReview || includeSubfolders)
        invalidateResults()
        lastScanScope = activeScopeDescription
        warnings = []
        isScanning = true
        statusMessage = isBrowserCacheReview ? "Scanning the displayed browser cache folders…" : "Scanning the selected folder…"
        progress = ScanProgress(visitedCount: 0, foundCount: 0, message: "Reading file information…")
        Task { [self] in
            let result = await Task.detached(priority: .userInitiated) {
                ScanEngine.scan(roots: scanRoots, options: options, cancellation: token) { update in
                    Task { @MainActor [self] in
                        guard self.scanID == currentID, self.isScanning else { return }
                        self.progress = update
                    }
                }
            }.value
            guard self.scanID == currentID else { return }
            self.files = result.files
            self.refreshCounts()
            self.warnings = result.warnings
            self.lastScan = Date()
            self.isScanning = false
            self.cancellation = nil
            self.statusMessage = result.wasCancelled
                ? "Scan cancelled. \(result.files.count) files are available to review."
                : "Scan complete. \(result.files.count) files available to review."
            self.progress.message = self.statusMessage
            self.log("\(result.wasCancelled ? "Scan cancelled" : "Scan complete")",
                     "\(result.files.count) files; \(result.skippedCount) skipped. Nothing was changed.")
            self.refreshStorage()
        }
    }

    func cancelScan() { cancellation?.cancel(); statusMessage = "Stopping scan…" }

    func toggleSelection(_ file: ScannedFile) {
        guard !isScanning && !isCleaning else { return }
        if selectedIDs.contains(file.id) { selectedIDs.remove(file.id); return }
        if let group = file.duplicateGroup {
            let others = files.filter { $0.duplicateGroup == group && $0.id != file.id }
            if !others.isEmpty && others.allSatisfy({ selectedIDs.contains($0.id) }) {
                errorMessage = "Keep at least one copy in each duplicate group. Deselect another copy first."
                return
            }
        }
        selectedIDs.insert(file.id)
    }

    func selectVisible() {
        guard !isScanning && !isCleaning else { return }
        var newSelection = selectedIDs.union(visibleFiles.map(\.id))
        let groups = Dictionary(grouping: duplicateFiles, by: { $0.duplicateGroup! })
        for group in groups.values where group.allSatisfy({ newSelection.contains($0.id) }) {
            if let keeper = group.sorted(by: { $0.id < $1.id }).first { newSelection.remove(keeper.id) }
        }
        selectedIDs = newSelection
    }

    func clearSelection() { guard !isCleaning else { return }; selectedIDs.removeAll() }

    func requestCleanup() {
        guard !isScanning && !isCleaning && !selectedFiles.isEmpty else { return }
        pendingCleanup = selectedFiles
        showCleanupConfirmation = true
    }

    func confirmCleanup() {
        guard !isScanning && !isCleaning && !pendingCleanup.isEmpty else { return }
        let requested = pendingCleanup
        let previousFiles = files
        let cleanupRoots = roots
        let runningIDs = Set(NSWorkspace.shared.runningApplications.compactMap(\.bundleIdentifier))
        pendingCleanup = []
        showCleanupConfirmation = false
        isCleaning = true
        statusMessage = "Moving confirmed files to Trash…"
        Task { [self] in
            let result = await Task.detached(priority: .userInitiated) {
                TrashService.clean(files: requested, allFiles: previousFiles, roots: cleanupRoots, runningBrowserIDs: runningIDs)
            }.value
            self.files.removeAll { result.trashedIDs.contains($0.id) }
            // A surviving single file is no longer a duplicate group.
            let groupCounts = Dictionary(grouping: self.files.compactMap { $0.duplicateGroup }, by: { $0 }).mapValues(\.count)
            for index in self.files.indices {
                if let group = self.files[index].duplicateGroup, groupCounts[group, default: 0] < 2 {
                    self.files[index].duplicateGroup = nil
                }
            }
            self.refreshCounts()
            self.selectedIDs.removeAll()
            self.isCleaning = false
            self.warnings.append(contentsOf: result.failures.map { "\($0.path): \($0.reason)" })
            self.statusMessage = "\(result.trashedIDs.count) files moved to Trash. \(result.failures.count) skipped."
            self.log("Cleanup complete", "\(result.trashedIDs.count) files (\(formattedBytes(result.movedBytes))) moved to Trash; \(result.failures.count) skipped. Space is not reclaimed until Trash is emptied in Finder.")
            self.refreshStorage()
        }
    }

    func reveal(_ file: ScannedFile) { NSWorkspace.shared.activateFileViewerSelecting([file.url]) }
    func openSupport(_ url: URL) {
        guard url.scheme == "https" else { return }
        NSWorkspace.shared.open(url)
    }

    func createTestFolder() {
        guard !isScanning && !isCleaning else { return }
        let panel = NSOpenPanel()
        panel.title = "Choose where to create sample files"
        panel.message = "Creates a new \(Brand.name) Test folder with disposable sample files. Existing files are not changed."
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.canCreateDirectories = true
        panel.directoryURL = SafetyPolicy.userHomeDirectory.appendingPathComponent("Downloads")
        panel.prompt = "Create test folder here"
        guard panel.runModal() == .OK, let parent = panel.url else { return }
        let scoped = parent.startAccessingSecurityScopedResource()
        defer { if scoped { parent.stopAccessingSecurityScopedResource() } }
        let folder = parent.appendingPathComponent("\(Brand.name) Test \(UUID().uuidString.prefix(8))", isDirectory: true)
        do {
            try SafetyPolicy.validateRoot(parent)
            guard !parent.pathComponents.contains(where: { $0.caseInsensitiveCompare("Library") == .orderedSame }) else {
                throw CleanseSafetyError.rejected("Choose a normal local folder such as Downloads for the sample files.")
            }
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
            let sample = Data("Disposable duplicate sample for \(Brand.name) testing.\n".utf8)
            try sample.write(to: folder.appendingPathComponent("Sample-copy-A.txt"), options: .withoutOverwriting)
            try sample.write(to: folder.appendingPathComponent("Sample-copy-B.txt"), options: .withoutOverwriting)
            let note = Data("This is a different disposable file. Review each item before moving it to Trash.\n".utf8)
            try note.write(to: folder.appendingPathComponent("Sample-notes.txt"), options: .withoutOverwriting)
            let nested = folder.appendingPathComponent("Nested", isDirectory: true)
            try FileManager.default.createDirectory(at: nested, withIntermediateDirectories: false)
            let nestedNote = Data("This disposable file appears only when Include subfolders is enabled.\n".utf8)
            try nestedNote.write(to: nested.appendingPathComponent("Nested-sample.txt"), options: .withoutOverwriting)
            let large = folder.appendingPathComponent("Sample-large-file.bin")
            guard FileManager.default.createFile(atPath: large.path, contents: nil) else { throw CocoaError(.fileWriteUnknown) }
            let handle = try FileHandle(forWritingTo: large)
            do {
                // Sparse, disposable 60 MiB logical file; deliberately uses very little physical storage.
                try handle.truncate(atOffset: 60 * 1_024 * 1_024)
                try handle.close()
            } catch { try? handle.close(); throw error }
            // A derived child URL does not necessarily carry its parent's sandbox extension.
            // Create and resolve a child bookmark while the selected parent is still accessible.
            let bookmark = try folder.bookmarkData(options: .withSecurityScope, includingResourceValuesForKeys: nil, relativeTo: nil)
            var stale = false
            let authorisedFolder = try URL(resolvingBookmarkData: bookmark, options: [.withSecurityScope, .withoutUI],
                                           relativeTo: nil, bookmarkDataIsStale: &stale)
            guard replaceRoots([authorisedFolder], browserCache: false) else { return }
            includeSubfolders = false
            section = .files
            log("Test folder created", "Four files are in the selected folder, with a fifth in Nested. Scan with Include subfolders off to see 4 files, then enable it and rescan to see 5. The 60 MiB sample is sparse and uses very little physical storage.")
            statusMessage = "Test folder ready. Choose Scan this folder to begin."
        } catch { errorMessage = "Could not create the test folder: \(error.localizedDescription)" }
    }

    func exportDiagnostics() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.plainText]
        panel.nameFieldStringValue = "\(Brand.fileStem)-Diagnostics.txt"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        let report = """
        \(Brand.fullVersion)
        Generated: \(ISO8601DateFormatter().string(from: Date()))
        macOS: \(ProcessInfo.processInfo.operatingSystemVersionString)
        Logical processors: \(ProcessInfo.processInfo.activeProcessorCount)
        Memory: \(formattedBytes(Int64(ProcessInfo.processInfo.physicalMemory)))
        Folders: \(roots.count)
        Scan mode: \(isBrowserCacheReview ? "Browser cache" : "Selected folder")
        Include subfolders: \(isBrowserCacheReview || includeSubfolders)
        Files in latest scan: \(files.count)
        Duplicate detection: \(detectDuplicates)
        Status: \(statusMessage)
        Paths and filenames are omitted from this diagnostic export.

        Activity
        \(activity.map { "\($0.date.formatted()): \($0.title) — \($0.detail)" }.joined(separator: "\n"))

        Warning count: \(warnings.count)
        Warnings are shown in the app. Review them before sharing a screenshot.
        """
        do { try report.write(to: url, atomically: true, encoding: .utf8) }
        catch { errorMessage = "Could not save diagnostics: \(error.localizedDescription)" }
    }

    private func refreshStorage() {
        if let attributes = try? FileManager.default.attributesOfFileSystem(forPath: SafetyPolicy.userHomeDirectory.path),
           let total = attributes[.systemSize] as? NSNumber,
           let free = attributes[.systemFreeSize] as? NSNumber {
            storage = StorageInfo(total: total.int64Value, available: free.int64Value)
        }
    }

    private func log(_ title: String, _ detail: String) {
        activity.insert(ActivityEntry(title: title, detail: detail), at: 0)
        if activity.count > 100 { activity.removeLast(activity.count - 100) }
    }
}
