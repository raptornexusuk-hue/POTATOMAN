import Foundation
import Darwin

/// Only these documented per-user locations are inspected; there is no whole-disk search.
enum BrowserDiscovery {
    static let maximumProfiles = 50
    static let maximumConfigBytes = 1_048_576
    static let locations: [BrowserLocation] = [
        BrowserLocation(bundleID: "com.apple.Safari", browser: .safari, name: "Safari", profileRoot: "Safari", cacheRoot: "Caches/com.apple.Safari"),
        BrowserLocation(bundleID: "com.apple.SafariTechnologyPreview", browser: .safari, name: "Safari Technology Preview", profileRoot: "SafariTechnologyPreview", cacheRoot: nil),
        BrowserLocation(bundleID: "com.google.Chrome", browser: .chrome, name: "Google Chrome", profileRoot: "Application Support/Google/Chrome", cacheRoot: "Caches/Google/Chrome"),
        BrowserLocation(bundleID: "com.google.Chrome.canary", browser: .chrome, name: "Chrome Canary", profileRoot: "Application Support/Google/Chrome Canary", cacheRoot: nil),
        BrowserLocation(bundleID: "com.microsoft.edgemac", browser: .edge, name: "Microsoft Edge", profileRoot: "Application Support/Microsoft Edge", cacheRoot: "Caches/Microsoft Edge"),
        BrowserLocation(bundleID: "com.microsoft.edgemac.Beta", browser: .edge, name: "Edge Beta", profileRoot: "Application Support/Microsoft Edge Beta", cacheRoot: nil),
        BrowserLocation(bundleID: "com.microsoft.edgemac.Dev", browser: .edge, name: "Edge Dev", profileRoot: "Application Support/Microsoft Edge Dev", cacheRoot: nil),
        BrowserLocation(bundleID: "com.brave.Browser", browser: .brave, name: "Brave", profileRoot: "Application Support/BraveSoftware/Brave-Browser", cacheRoot: "Caches/BraveSoftware/Brave-Browser"),
        BrowserLocation(bundleID: "org.mozilla.firefox", browser: .firefox, name: "Firefox", profileRoot: "Application Support/Firefox", cacheRoot: "Caches/Firefox/Profiles"),
        BrowserLocation(bundleID: "org.mozilla.firefoxdeveloperedition", browser: .firefox, name: "Firefox Developer Edition", profileRoot: "Application Support/Firefox", cacheRoot: "Caches/Firefox/Profiles"),
        BrowserLocation(bundleID: "org.mozilla.nightly", browser: .firefox, name: "Firefox Nightly", profileRoot: "Application Support/Firefox", cacheRoot: "Caches/Firefox/Profiles")
    ]

    static func installations(applicationURL: (String) -> URL?, runningIDs: Set<String>) -> [BrowserInstallation] {
        locations.compactMap { location in
            guard let url = applicationURL(location.bundleID) else { return nil }
            return BrowserInstallation(id: location.bundleID, browser: location.browser, displayName: location.name,
                                       applicationURL: url, isRunning: runningIDs.contains(location.bundleID))
        }
    }

    static func library(home: URL = SafetyPolicy.userHomeDirectory) -> URL {
        home.appendingPathComponent("Library", isDirectory: true)
    }

    static func isWithin(_ url: URL, _ root: URL) -> Bool {
        url.standardizedFileURL == root.standardizedFileURL || SafetyPolicy.isStrictDescendant(url, of: root)
    }

    static func hasPermission(for url: URL, roots: [URL]) -> Bool { roots.contains { isWithin(url, $0) } }

    /// A browser permission cannot be replaced by an unrelated folder or an entire home/disk.
    static func validatePermissionRoot(_ url: URL, home: URL = SafetyPolicy.userHomeDirectory) throws {
        let selected = url.standardizedFileURL
        let libraryURL = library(home: home)
        var allowed = selected == libraryURL
        for location in locations {
            let root = libraryURL.appendingPathComponent(location.profileRoot, isDirectory: true)
            if selected == root { allowed = true }
            if selected.deletingLastPathComponent() == root && isChromiumProfile(selected.lastPathComponent) && location.browser != .safari && location.browser != .firefox { allowed = true }
            if location.browser == .firefox {
                let profiles = root.appendingPathComponent("Profiles", isDirectory: true)
                if selected == profiles || (selected.deletingLastPathComponent() == profiles && safeComponent(selected.lastPathComponent)) { allowed = true }
            }
        }
        let safariContainer = libraryURL.appendingPathComponent("Containers/com.apple.Safari/Data/Library/Safari", isDirectory: true)
        if selected == safariContainer { allowed = true }
        guard allowed else { throw CleanseSafetyError.rejected("Choose your home Library folder or a supported browser profile folder. Other folders are not browser permissions.") }
        try validateReadLocation(selected, roots: [selected], isDirectory: true)
    }

    /// Separate read policy: browser databases never enter the file-cleanup policy or scan roots.
    static func validateReadLocation(_ url: URL, roots: [URL], isDirectory: Bool) throws {
        guard url.isFileURL, hasPermission(for: url, roots: roots) else {
            throw CleanseSafetyError.rejected("This browser location is outside the permission you granted.")
        }
        let cloudNames: Set<String> = ["cloudstorage", "mobile documents", "icloud drive", "dropbox", "google drive", "box", "pcloud drive"]
        guard !url.standardizedFileURL.pathComponents.contains(where: { cloudNames.contains($0.lowercased()) || $0.lowercased().hasPrefix("onedrive") || $0.lowercased().hasPrefix("googledrive") }) else {
            throw CleanseSafetyError.rejected("Cloud-managed browser profiles are not inspected.")
        }
        try SafetyPolicy.validateAncestors(url)
        let values = try url.resourceValues(forKeys: [.volumeIsLocalKey, .isUbiquitousItemKey, .isAliasFileKey, .isPackageKey])
        guard values.volumeIsLocal == true, values.isUbiquitousItem != true, values.isAliasFile != true, values.isPackage != true else {
            throw CleanseSafetyError.rejected("Only local browser profiles without links, aliases or cloud storage are supported.")
        }
        let info = try SafetyPolicy.metadata(url)
        guard (info.st_mode & S_IFMT) == (isDirectory ? S_IFDIR : S_IFREG) else {
            throw CleanseSafetyError.rejected("This browser item changed or has an unsupported file type.")
        }
    }

    static func discover(installations: [BrowserInstallation], authorizedRoots: [URL], home: URL = SafetyPolicy.userHomeDirectory) -> BrowserDiscoveryResult {
        let libraryURL = library(home: home)
        var output = BrowserDiscoveryResult(profiles: [], warnings: [])
        var seenFirefoxRoots: Set<String> = []
        for installation in installations {
            guard let location = locations.first(where: { $0.bundleID == installation.id }) else { continue }
            let root = libraryURL.appendingPathComponent(location.profileRoot, isDirectory: true)
            if installation.browser == .firefox {
                // Firefox editions share profiles.ini; report each physical profile only once.
                guard seenFirefoxRoots.insert(root.path).inserted else { continue }
            }
            var directories: [(URL, String)] = []
            do {
                switch installation.browser {
                case .safari:
                    var safariRoots = [root]
                    if installation.id == "com.apple.Safari" {
                        safariRoots.append(libraryURL.appendingPathComponent("Containers/com.apple.Safari/Data/Library/Safari", isDirectory: true))
                    }
                    for candidate in safariRoots where hasPermission(for: candidate, roots: authorizedRoots) {
                        guard exists(candidate) else { continue }
                        try validateReadLocation(candidate, roots: authorizedRoots, isDirectory: true)
                        directories.append((candidate, candidate == root ? "Default" : "Container profile"))
                        let profileDirectory = candidate.appendingPathComponent("Profiles", isDirectory: true)
                        if exists(profileDirectory) {
                            for child in try boundedDirectories(profileDirectory, roots: authorizedRoots) {
                                directories.append((child, "Profile \(child.lastPathComponent.prefix(12))"))
                            }
                        }
                    }
                case .firefox:
                    directories = try firefoxProfiles(root: root, authorizedRoots: authorizedRoots)
                default:
                    var names: [String: String] = [:]
                    if hasPermission(for: root, roots: authorizedRoots), exists(root) {
                        let state = root.appendingPathComponent("Local State")
                        if exists(state), let object = try? readJSON(state, roots: authorizedRoots),
                           let profile = object["profile"] as? [String: Any], let cache = profile["info_cache"] as? [String: Any] {
                            for (key, value) in cache where isChromiumProfile(key) {
                                if let info = value as? [String: Any], let name = info["name"] as? String {
                                    names[key] = String(name.prefix(100))
                                }
                            }
                        }
                        for child in try boundedDirectories(root, roots: authorizedRoots, include: isChromiumProfile) {
                            directories.append((child, names[child.lastPathComponent] ?? child.lastPathComponent))
                        }
                    } else {
                        for selected in authorizedRoots where selected.deletingLastPathComponent() == root && isChromiumProfile(selected.lastPathComponent) {
                            try validateReadLocation(selected, roots: authorizedRoots, isDirectory: true)
                            directories.append((selected, selected.lastPathComponent))
                        }
                    }
                }
                if directories.count > maximumProfiles { output.warnings.append("\(installation.displayName): showing the first \(maximumProfiles) profiles.") }
                for (directory, name) in directories.prefix(maximumProfiles) {
                    let history = directory.appendingPathComponent(installation.browser == .safari ? "History.db" : installation.browser == .firefox ? "places.sqlite" : "History")
                    let summary = BrowserHistoryReader.readCount(at: history, browser: installation.browser, authorizedRoots: authorizedRoots)
                    let caches = cachePaths(location: location, profileDirectory: directory, libraryURL: libraryURL, roots: authorizedRoots)
                    output.profiles.append(BrowserProfile(id: installation.id + ":" + directory.path, browser: installation.browser,
                                                         installationID: installation.id, displayName: name, directoryURL: directory,
                                                         historyURL: history, historyCount: summary.count, historyState: summary.state,
                                                         historyStatus: summary.message, cachePaths: caches))
                }
                if directories.isEmpty {
                    let authorized = hasPermission(for: root, roots: authorizedRoots)
                    output.profiles.append(BrowserProfile(id: installation.id + ":unavailable", browser: installation.browser,
                                                         installationID: installation.id, displayName: "Profiles", directoryURL: root,
                                                         historyURL: nil, historyCount: nil, historyState: authorized ? .missing : .permissionRequired,
                                                         historyStatus: authorized ? "No standard local profile found. Open this browser once, then refresh." : "Allow browser access to detect profiles and history.", cachePaths: []))
                }
            } catch {
                let nsError = error as NSError
                let denied = nsError.domain == NSPOSIXErrorDomain && [Int(EACCES), Int(EPERM)].contains(nsError.code)
                output.profiles.append(BrowserProfile(id: installation.id + ":unreadable", browser: installation.browser,
                                                     installationID: installation.id, displayName: "Profiles", directoryURL: root,
                                                     historyURL: nil, historyCount: nil, historyState: denied ? .permissionRequired : .unreadable,
                                                     historyStatus: denied ? "macOS denied access. You can still clear history in the browser." : "Profiles could not be inspected: \(error.localizedDescription)", cachePaths: []))
            }
        }
        return output
    }

    static func safeComponent(_ name: String) -> Bool {
        !name.isEmpty && name != "." && name != ".." && !name.contains("/") && !name.contains("\\") && !name.contains("\0")
    }

    static func isChromiumProfile(_ name: String) -> Bool {
        if name == "Default" { return true }
        guard name.hasPrefix("Profile ") else { return false }
        let suffix = name.dropFirst(8)
        return !suffix.isEmpty && suffix.allSatisfy { $0.isASCII && $0.isNumber }
    }

    private static func exists(_ url: URL) -> Bool {
        // EACCES/EPERM must remain distinct from a missing profile.
        do { _ = try SafetyPolicy.metadata(url); return true }
        catch { let error = error as NSError; return !(error.domain == NSPOSIXErrorDomain && [Int(ENOENT), Int(ENOTDIR)].contains(error.code)) }
    }

    private static func boundedDirectories(_ root: URL, roots: [URL], include: (String) -> Bool = { _ in true }) throws -> [URL] {
        try validateReadLocation(root, roots: roots, isDirectory: true)
        guard let stream = opendir(root.path) else { throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno)) }
        defer { closedir(stream) }
        var result: [URL] = []
        var inspected = 0
        while let entry = readdir(stream), inspected < 1_000 {
            inspected += 1
            var rawName = entry.pointee.d_name
            let rawNameCapacity = MemoryLayout.size(ofValue: rawName)
            let name = withUnsafePointer(to: &rawName) { pointer in
                pointer.withMemoryRebound(to: CChar.self, capacity: rawNameCapacity) { String(cString: $0) }
            }
            guard safeComponent(name), !name.hasPrefix("."), include(name) else { continue }
            let child = root.appendingPathComponent(name, isDirectory: true)
            if (try? validateReadLocation(child, roots: roots, isDirectory: true)) != nil { result.append(child) }
        }
        return Array(result.sorted { $0.lastPathComponent < $1.lastPathComponent }.prefix(maximumProfiles + 1))
    }

    static func readConfig(_ url: URL, roots: [URL]) throws -> Data {
        try validateReadLocation(url, roots: roots, isDirectory: false)
        guard try SafetyPolicy.metadata(url).st_size <= Int64(maximumConfigBytes) else { throw CleanseSafetyError.rejected("Browser profile metadata exceeds the supported size.") }
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        let data = try handle.read(upToCount: maximumConfigBytes + 1) ?? Data()
        guard data.count <= maximumConfigBytes else { throw CleanseSafetyError.rejected("Browser profile metadata changed while reading.") }
        return data
    }

    private static func readJSON(_ url: URL, roots: [URL]) throws -> [String: Any] {
        let object = try JSONSerialization.jsonObject(with: readConfig(url, roots: roots))
        return (object as? [String: Any]) ?? [:]
    }

    private static func firefoxProfiles(root: URL, authorizedRoots: [URL]) throws -> [(URL, String)] {
        let profiles = root.appendingPathComponent("Profiles", isDirectory: true)
        var found: [(URL, String)] = []
        var names: [String: String] = [:]
        let ini = root.appendingPathComponent("profiles.ini")
        if hasPermission(for: ini, roots: authorizedRoots), exists(ini) {
            let data = try readConfig(ini, roots: authorizedRoots)
            if let text = String(data: data, encoding: .utf8) {
                var section = ""
                var record: [String: String] = [:]
                func capture() {
                    guard section.hasPrefix("Profile"), record["IsRelative"] == "1", let path = record["Path"], let name = record["Name"] else { return }
                    let parts = path.split(separator: "/", omittingEmptySubsequences: false)
                    guard parts.count == 2, parts[0] == "Profiles", safeComponent(String(parts[1])) else { return }
                    names[String(parts[1])] = String(name.prefix(100))
                }
                for raw in text.split(whereSeparator: \.isNewline) {
                    let line = raw.trimmingCharacters(in: .whitespaces)
                    if line.hasPrefix("["), line.hasSuffix("]") { capture(); section = String(line.dropFirst().dropLast()); record = [:] }
                    else if let separator = line.firstIndex(of: "=") { record[String(line[..<separator])] = String(line[line.index(after: separator)...]) }
                }
                capture()
            }
        }
        if hasPermission(for: profiles, roots: authorizedRoots), exists(profiles) {
            for child in try boundedDirectories(profiles, roots: authorizedRoots) { found.append((child, names[child.lastPathComponent] ?? child.lastPathComponent)) }
        } else {
            for selected in authorizedRoots where selected.deletingLastPathComponent() == profiles {
                try validateReadLocation(selected, roots: authorizedRoots, isDirectory: true)
                found.append((selected, names[selected.lastPathComponent] ?? selected.lastPathComponent))
            }
        }
        return found
    }

    private static func cachePaths(location: BrowserLocation, profileDirectory: URL, libraryURL: URL, roots: [URL]) -> [URL] {
        guard let relativeRoot = location.cacheRoot else { return [] }
        let cacheRoot = libraryURL.appendingPathComponent(relativeRoot, isDirectory: true)
        let candidates: [URL]
        switch location.browser {
        case .safari: candidates = ["WebKitCache", "fsCachedData"].map { cacheRoot.appendingPathComponent($0, isDirectory: true) }
        case .firefox: candidates = [cacheRoot.appendingPathComponent(profileDirectory.lastPathComponent, isDirectory: true).appendingPathComponent("cache2", isDirectory: true)]
        default: candidates = ["Cache", "Code Cache", "GPUCache"].map { cacheRoot.appendingPathComponent(profileDirectory.lastPathComponent, isDirectory: true).appendingPathComponent($0, isDirectory: true) }
        }
        return candidates.filter { (try? validateReadLocation($0, roots: roots, isDirectory: true)) != nil }
    }
}
