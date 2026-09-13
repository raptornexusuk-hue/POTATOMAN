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

extension BrowserProfile {
    /// Where this profile keeps its cookies. Chrome moved the store under
    /// `Network/` in newer versions and left the old path behind on upgrades,
    /// so whichever actually exists is the one that counts.
    var cookiesURL: URL? {
        switch browser {
        case .firefox:
            return directoryURL.appendingPathComponent("cookies.sqlite")
        case .safari:
            return nil
        default:
            let current = directoryURL.appendingPathComponent("Network/Cookies")
            if FileManager.default.fileExists(atPath: current.path) { return current }
            return directoryURL.appendingPathComponent("Cookies")
        }
    }
}
