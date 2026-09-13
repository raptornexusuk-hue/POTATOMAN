import Foundation

enum CleanseSection: String, CaseIterable, Identifiable {
    case overview = "Overview", cache = "Browser cache", files = "All files"
    case large = "Large files", duplicates = "Duplicates", privacy = "Browser privacy"
    case activity = "Activity", settings = "Settings", virus = "Virus scan"
    var id: String { rawValue }
    var symbol: String {
        switch self {
        case .overview: return "house"
        case .cache: return "globe"
        case .files: return "folder"
        case .large: return "doc"
        case .duplicates: return "square.on.square"
        case .privacy: return "hand.raised"
        case .activity: return "clock"
        case .settings: return "gearshape"
        case .virus: return "shield.lefthalf.filled"
        }
    }
}

struct ScanRoot: Identifiable, Hashable, Sendable {
    let id: UUID
    let url: URL
    init(id: UUID = UUID(), url: URL) { self.id = id; self.url = url }
}

enum BrowserKind: String, CaseIterable, Sendable {
    case safari = "Safari", chrome = "Google Chrome", edge = "Microsoft Edge", firefox = "Firefox", brave = "Brave"
    var bundleIdentifiers: [String] {
        switch self {
        case .safari: return ["com.apple.Safari", "com.apple.SafariTechnologyPreview"]
        case .chrome: return ["com.google.Chrome", "com.google.Chrome.canary"]
        case .edge: return ["com.microsoft.edgemac", "com.microsoft.edgemac.Beta", "com.microsoft.edgemac.Dev"]
        case .firefox: return ["org.mozilla.firefox", "org.mozilla.firefoxdeveloperedition", "org.mozilla.nightly"]
        case .brave: return ["com.brave.Browser", "com.brave.Browser.beta", "com.brave.Browser.nightly"]
        }
    }
}

struct FileSnapshot: Hashable, Sendable {
    let device: UInt64
    let inode: UInt64
    let byteCount: Int64
    let modifiedSeconds: Int64
    let modifiedNanoseconds: Int64
}

struct ScannedFile: Identifiable, Hashable, Sendable {
    var id: String { url.path }
    let url: URL
    let rootID: UUID
    let byteCount: Int64
    let allocatedBytes: Int64
    let modifiedAt: Date
    let snapshot: FileSnapshot
    let browser: BrowserKind?
    var duplicateGroup: String?
    var name: String { url.lastPathComponent }
}

/// How a folder review is ordered. Folder review previously had one fixed order
/// (largest first) with no way to change it, which made "what did I download
/// yesterday?" impossible to answer without searching.
enum CleanseSortOrder: String, CaseIterable, Identifiable, Sendable {
    case largestFirst, smallestFirst, newestFirst, oldestFirst, nameAscending

    var id: String { rawValue }

    var title: String {
        switch self {
        case .largestFirst: return "Largest first"
        case .smallestFirst: return "Smallest first"
        case .newestFirst: return "Newest first"
        case .oldestFirst: return "Oldest first"
        case .nameAscending: return "Name A–Z"
        }
    }

    var symbol: String {
        switch self {
        case .largestFirst, .smallestFirst: return "arrow.up.arrow.down"
        case .newestFirst, .oldestFirst: return "calendar"
        case .nameAscending: return "textformat"
        }
    }
}

/// Ordering is a pure function of the files and the chosen order, so it is
/// covered by tests and never depends on view or main-actor state.
enum CleanseSorting {
    /// Every comparison breaks ties on the file path, which is unique within a
    /// scan. Swift's sort is not stable, so a total order is required for the
    /// list not to shuffle between redraws.
    static func precedes(_ first: ScannedFile, _ second: ScannedFile, order: CleanseSortOrder) -> Bool {
        switch order {
        case .largestFirst:
            if first.byteCount != second.byteCount { return first.byteCount > second.byteCount }
        case .smallestFirst:
            if first.byteCount != second.byteCount { return first.byteCount < second.byteCount }
        case .newestFirst:
            if first.modifiedAt != second.modifiedAt { return first.modifiedAt > second.modifiedAt }
        case .oldestFirst:
            if first.modifiedAt != second.modifiedAt { return first.modifiedAt < second.modifiedAt }
        case .nameAscending:
            let comparison = first.name.localizedStandardCompare(second.name)
            if comparison != .orderedSame { return comparison == .orderedAscending }
        }
        return first.id < second.id
    }

    /// Sort a list of files. With `groupingDuplicates`, matching copies stay
    /// adjacent: groups are ranked by their best-placed member under the chosen
    /// order, then ordered within the group the same way.
    static func sorted(_ files: [ScannedFile], order: CleanseSortOrder, groupingDuplicates: Bool = false) -> [ScannedFile] {
        let ordered = files.sorted { precedes($0, $1, order: order) }
        guard groupingDuplicates else { return ordered }
        var rank: [String: Int] = [:]
        for (index, file) in ordered.enumerated() {
            let key = file.duplicateGroup ?? file.id
            if rank[key] == nil { rank[key] = index }
        }
        return ordered.sorted { first, second in
            let firstRank = rank[first.duplicateGroup ?? first.id] ?? 0
            let secondRank = rank[second.duplicateGroup ?? second.id] ?? 0
            if firstRank != secondRank { return firstRank < secondRank }
            return precedes(first, second, order: order)
        }
    }
}

struct ScanOptions: Sendable {
    var largeFileBytes: Int64 = 50 * 1_024 * 1_024
    var detectDuplicates = true
    /// Folder scanning never enters child folders unless the user explicitly enables it.
    var includeSubfolders = false
    var minimumCacheAgeHours = 24
    var maximumFiles = 50_000
}

struct ScanProgress: Sendable {
    var visitedCount: Int
    var foundCount: Int
    var message: String
}

struct ScanResult: Sendable {
    var files: [ScannedFile]
    var warnings: [String]
    var skippedCount: Int
    var wasCancelled: Bool
}

struct CleanupFailure: Identifiable, Sendable {
    let id = UUID()
    let path: String
    let reason: String
}

struct CleanupResult: Sendable {
    var trashedIDs: Set<String>
    var movedBytes: Int64
    var failures: [CleanupFailure]
}

struct ActivityEntry: Identifiable {
    let id = UUID()
    let date = Date()
    let title: String
    let detail: String
}

struct StorageInfo {
    var total: Int64 = 0
    var available: Int64 = 0
    var used: Int64 { max(0, total - available) }
}

func formattedBytes(_ value: Int64) -> String {
    ByteCountFormatter.string(fromByteCount: max(0, value), countStyle: .file)
}

final class CancellationFlag: @unchecked Sendable {
    private let lock = NSLock()
    private var cancelled = false
    var isCancelled: Bool { lock.lock(); defer { lock.unlock() }; return cancelled }
    func cancel() { lock.lock(); cancelled = true; lock.unlock() }
}
