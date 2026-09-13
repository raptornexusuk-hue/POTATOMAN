import Foundation

enum BrowserHistoryState: String, Sendable {
    case available, permissionRequired, missing, busy, unsupported, unreadable
}

struct BrowserHistorySummary: Sendable {
    let count: Int?
    let state: BrowserHistoryState
    let message: String
}

struct BrowserInstallation: Identifiable, Sendable {
    let id: String
    let browser: BrowserKind
    let displayName: String
    let applicationURL: URL
    var isRunning: Bool
}

struct BrowserProfile: Identifiable, Sendable {
    let id: String
    let browser: BrowserKind
    let installationID: String
    let displayName: String
    let directoryURL: URL
    let historyURL: URL?
    var historyCount: Int?
    var historyState: BrowserHistoryState
    var historyStatus: String
    let cachePaths: [URL]
}

struct BrowserDiscoveryResult: Sendable {
    var profiles: [BrowserProfile]
    var warnings: [String]
}

struct BrowserLocation: Sendable {
    let bundleID: String
    let browser: BrowserKind
    let name: String
    let profileRoot: String
    let cacheRoot: String?
}
