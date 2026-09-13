import Foundation

/// How far back to clear. "All time" is represented by a nil cutoff rather than
/// a very old date, so the engine can take a simpler and safer path for it.
enum BrowserTimeRange: String, CaseIterable, Identifiable, Sendable {
    case lastHour, last24Hours, last7Days, last4Weeks, allTime

    var id: String { rawValue }

    var title: String {
        switch self {
        case .lastHour: return "Last hour"
        case .last24Hours: return "Last 24 hours"
        case .last7Days: return "Last 7 days"
        case .last4Weeks: return "Last 4 weeks"
        case .allTime: return "All time"
        }
    }

    /// Everything recorded at or after this moment is removed. `nil` means
    /// everything, with no lower bound.
    func cutoff(from now: Date = Date()) -> Date? {
        switch self {
        case .lastHour: return now.addingTimeInterval(-3_600)
        case .last24Hours: return now.addingTimeInterval(-86_400)
        case .last7Days: return now.addingTimeInterval(-7 * 86_400)
        case .last4Weeks: return now.addingTimeInterval(-28 * 86_400)
        case .allTime: return nil
        }
    }
}

/// What to clear. Cookies default to off: clearing them signs you out of sites,
/// which is a bigger interruption than losing history or cache.
struct BrowserClearSelection: Equatable, Sendable {
    var history = true
    var cookies = false
    var cache = true

    var isEmpty: Bool { !history && !cookies && !cache }

    var summary: String {
        var parts: [String] = []
        if history { parts.append("history") }
        if cookies { parts.append("cookies and sign-ins") }
        if cache { parts.append("cache") }
        if parts.isEmpty { return "nothing" }
        if parts.count == 1 { return parts[0] }
        return parts.dropLast().joined(separator: ", ") + " and " + parts[parts.count - 1]
    }
}

/// Browsers do not agree on how to store a moment in time. Getting one of these
/// wrong would delete far more than the person asked for, so each conversion is
/// a pure function with its own tests.
enum BrowserTimestamp {
    /// Seconds between 1601-01-01 and 1970-01-01, the Windows FILETIME epoch
    /// that Chromium inherited.
    static let chromiumEpochOffset: Int64 = 11_644_473_600
    /// Seconds between 1970-01-01 and 2001-01-01, Apple's reference date.
    static let appleEpochOffset: Double = 978_307_200

    /// Chromium history and cookies: microseconds since 1601-01-01 UTC.
    static func chromium(from date: Date) -> Int64 {
        (Int64(date.timeIntervalSince1970.rounded()) + chromiumEpochOffset) * 1_000_000
    }

    /// Firefox places and cookies: microseconds since 1970-01-01 UTC.
    static func firefox(from date: Date) -> Int64 {
        Int64((date.timeIntervalSince1970 * 1_000_000).rounded())
    }

    /// Safari history: seconds since 2001-01-01 UTC.
    static func safari(from date: Date) -> Double {
        date.timeIntervalSince1970 - appleEpochOffset
    }
}

/// One profile's worth of work: which databases and cache folders to act on.
struct BrowserClearTarget: Identifiable, Sendable {
    let id: String
    let browser: BrowserKind
    let browserName: String
    let profileName: String
    let profileDirectory: URL
    let historyURL: URL?
    let cookiesURL: URL?
    let cachePaths: [URL]
}

/// What actually happened, per profile. Every number here is something the
/// engine observed, not something it intended.
struct BrowserClearOutcome: Identifiable, Sendable {
    let id: String
    let browserName: String
    let profileName: String
    var historyRowsRemoved: Int? = nil
    var cookieRowsRemoved: Int? = nil
    var cacheFilesTrashed: Int? = nil
    var skipped: [String] = []
    var failures: [String] = []

    var didSomething: Bool {
        (historyRowsRemoved ?? 0) > 0 || (cookieRowsRemoved ?? 0) > 0 || (cacheFilesTrashed ?? 0) > 0
    }

    var summary: String {
        var parts: [String] = []
        if let rows = historyRowsRemoved { parts.append("\(rows.formatted()) history \(rows == 1 ? "visit" : "visits")") }
        if let rows = cookieRowsRemoved { parts.append("\(rows.formatted()) \(rows == 1 ? "cookie" : "cookies")") }
        if let files = cacheFilesTrashed { parts.append("\(files.formatted()) cache \(files == 1 ? "file" : "files")") }
        if parts.isEmpty { return failures.isEmpty ? "Nothing to remove" : "Nothing removed" }
        return parts.joined(separator: " · ")
    }
}

struct BrowserClearReport: Sendable {
    var outcomes: [BrowserClearOutcome] = []
    var startedAt = Date()
    var range: BrowserTimeRange = .allTime
    var selection = BrowserClearSelection()

    var totalHistoryRows: Int { outcomes.reduce(0) { $0 + ($1.historyRowsRemoved ?? 0) } }
    var totalCookieRows: Int { outcomes.reduce(0) { $0 + ($1.cookieRowsRemoved ?? 0) } }
    var totalCacheFiles: Int { outcomes.reduce(0) { $0 + ($1.cacheFilesTrashed ?? 0) } }
    var failures: [String] { outcomes.flatMap(\.failures) }
    var skipped: [String] { outcomes.flatMap(\.skipped) }

    var headline: String {
        if outcomes.isEmpty { return "Nothing to clear" }
        var parts: [String] = []
        if selection.history { parts.append("\(totalHistoryRows.formatted()) history \(totalHistoryRows == 1 ? "visit" : "visits")") }
        if selection.cookies { parts.append("\(totalCookieRows.formatted()) \(totalCookieRows == 1 ? "cookie" : "cookies")") }
        if selection.cache { parts.append("\(totalCacheFiles.formatted()) cache \(totalCacheFiles == 1 ? "file" : "files")") }
        return parts.isEmpty ? "Nothing removed" : "Removed " + parts.joined(separator: ", ")
    }
}
