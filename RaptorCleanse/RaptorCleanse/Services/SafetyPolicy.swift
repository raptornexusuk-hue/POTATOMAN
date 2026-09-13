import Foundation
import Darwin

enum CleanseSafetyError: LocalizedError {
    case rejected(String)
    var errorDescription: String? {
        switch self { case .rejected(let message): return message }
    }
}

/// A deliberately narrow policy for the first test build. No administrator access is used.
enum SafetyPolicy {
    /// Foundation's home can point at the app container in a sandboxed process.
    static let userHomeDirectory: URL = {
        if let entry = getpwuid(getuid()), let directory = entry.pointee.pw_dir {
            return URL(fileURLWithPath: String(cString: directory), isDirectory: true).standardizedFileURL
        }
        return FileManager.default.homeDirectoryForCurrentUser.standardizedFileURL
    }()
    private static var home: URL { userHomeDirectory }
    private static let protectedTrees = ["/System", "/Library", "/Applications", "/bin", "/sbin", "/usr", "/etc", "/private", "/dev", "/opt", "/cores", "/Network", "/tmp", "/var"]
    private static let protectedNames: Set<String> = [".ssh", ".gnupg", ".aws", ".azure", ".config", ".git", ".trash", ".trashes", ".fseventsd", ".spotlight-v100"]
    private static let packageExtensions: Set<String> = ["app", "bundle", "framework", "photoslibrary", "photolibrary", "musiclibrary", "sparsebundle", "backupbundle", "xcarchive", "xcodeproj", "xcworkspace", "pvm", "vmwarevm", "keychain", "keychain-db"]

    static func isStrictDescendant(_ url: URL, of root: URL) -> Bool {
        let child = url.standardizedFileURL.pathComponents
        let parent = root.standardizedFileURL.pathComponents
        return child.count > parent.count && child.starts(with: parent)
    }

    private static func isWithin(_ url: URL, _ directory: URL) -> Bool {
        url.standardizedFileURL.path == directory.standardizedFileURL.path || isStrictDescendant(url, of: directory)
    }

    /// APFS is commonly case-insensitive. A differently cased spelling must not bypass exclusions.
    private static func isWithinProtectedTree(_ url: URL, path: String) -> Bool {
        let child = url.standardizedFileURL.pathComponents.map { $0.lowercased() }
        let parent = URL(fileURLWithPath: path).pathComponents.map { $0.lowercased() }
        return child.count >= parent.count && child.starts(with: parent)
    }

    /// Files are cache candidates only below a known cache leaf, never a browser profile root.
    static func browserCacheKind(for url: URL, homeDirectory: URL = SafetyPolicy.userHomeDirectory) -> BrowserKind? {
        let cacheRoot = homeDirectory.appendingPathComponent("Library/Caches", isDirectory: true).standardizedFileURL
        guard isStrictDescendant(url, of: cacheRoot) else { return nil }
        let components = Array(url.standardizedFileURL.pathComponents.dropFirst(cacheRoot.pathComponents.count))
        guard let branch = allowedCacheBranch(components), components.count > branch.leafDepth else { return nil }
        let profileDataNames: Set<String> = ["history", "history-journal", "cookies", "cookies-journal", "login data", "login data-journal", "preferences", "secure preferences", "bookmarks", "sessions", "current session", "current tabs", "last session", "last tabs", "places.sqlite", "cookies.sqlite", "logins.json", "key4.db", "sessionstore.jsonlz4"]
        guard !components.dropFirst(branch.leafDepth).contains(where: { profileDataNames.contains($0.lowercased()) }) else { return nil }
        return branch.kind
    }

    /// Only exact known cache leaves are eligible for a dedicated browser-cache scan.
    /// The broader Library/Caches folder and profile roots are never accepted here.
    static func browserCacheRootKind(for url: URL, homeDirectory: URL = SafetyPolicy.userHomeDirectory) -> BrowserKind? {
        let caches = homeDirectory.appendingPathComponent("Library/Caches", isDirectory: true).standardizedFileURL
        guard isStrictDescendant(url, of: caches) else { return nil }
        let parts = Array(url.standardizedFileURL.pathComponents.dropFirst(caches.pathComponents.count))
        guard let branch = allowedCacheBranch(parts), parts.count == branch.leafDepth else { return nil }
        return branch.kind
    }

    /// A cleanup grant is restricted to one exact cache leaf, or the narrow
    /// per-profile parent shared by that profile's requested cache leaves.
    static func browserCachePermissionRoots(for urls: [URL], homeDirectory: URL = SafetyPolicy.userHomeDirectory) throws -> [URL] {
        let roots = Array(Set(urls.map { URL(fileURLWithPath: $0.standardizedFileURL.path, isDirectory: true) }))
        guard !roots.isEmpty, roots.allSatisfy({ browserCacheRootKind(for: $0, homeDirectory: homeDirectory) != nil }) else {
            throw CleanseSafetyError.rejected("Only exact recognised browser cache folders can be authorised for cleanup.")
        }
        let groups = Dictionary(grouping: roots, by: { $0.deletingLastPathComponent() })
        return groups.map { entry in
            entry.value.count == 1 ? entry.value[0] : entry.key
        }.sorted { $0.path < $1.path }
    }

    private static func allowedCacheBranch(_ components: [String]) -> (kind: BrowserKind, leafDepth: Int)? {
        if components.count >= 2, components[0] == "com.apple.Safari", ["WebKitCache", "fsCachedData"].contains(components[1]) {
            return (.safari, 2)
        }
        if components.count >= 4, components[0] == "Google", components[1] == "Chrome", isChromeProfile(components[2]), ["Cache", "Code Cache", "GPUCache"].contains(components[3]) {
            return (.chrome, 4)
        }
        if components.count >= 3, components[0] == "Microsoft Edge", isChromeProfile(components[1]), ["Cache", "Code Cache", "GPUCache"].contains(components[2]) {
            return (.edge, 3)
        }
        if components.count >= 4, components[0] == "BraveSoftware", components[1] == "Brave-Browser", isChromeProfile(components[2]), ["Cache", "Code Cache", "GPUCache"].contains(components[3]) {
            return (.brave, 4)
        }
        if components.count >= 4, components[0] == "Firefox", components[1] == "Profiles", !components[2].isEmpty, components[3] == "cache2" {
            return (.firefox, 4)
        }
        return nil
    }

    private static func isChromeProfile(_ name: String) -> Bool {
        if name == "Default" { return true }
        guard name.hasPrefix("Profile ") else { return false }
        let suffix = name.dropFirst("Profile ".count)
        return !suffix.isEmpty && suffix.allSatisfy { $0.isNumber && $0.isASCII }
    }

    /// Ancestors of supported cache directories may be traversed, but never offered for cleanup.
    private static func isAllowedCacheTraversal(_ url: URL) -> Bool {
        let caches = home.appendingPathComponent("Library/Caches", isDirectory: true)
        guard isWithin(url, caches) else { return false }
        let parts = Array(url.standardizedFileURL.pathComponents.dropFirst(caches.pathComponents.count))
        if parts.isEmpty || allowedCacheBranch(parts) != nil { return true }
        if parts[0] == "com.apple.Safari" { return parts.count == 1 }
        if parts[0] == "Google" {
            if parts.count == 1 { return true }
            guard parts[1] == "Chrome" else { return false }
            return parts.count == 2 || (parts.count == 3 && isChromeProfile(parts[2]))
        }
        if parts[0] == "Microsoft Edge" {
            return parts.count == 1 || (parts.count == 2 && isChromeProfile(parts[1]))
        }
        if parts[0] == "BraveSoftware" {
            if parts.count == 1 { return true }
            guard parts[1] == "Brave-Browser" else { return false }
            return parts.count == 2 || (parts.count == 3 && isChromeProfile(parts[2]))
        }
        if parts[0] == "Firefox" {
            return parts.count == 1 || (parts.count <= 3 && parts[1] == "Profiles")
        }
        return false
    }

    static func validateRoot(_ url: URL) throws {
        let root = url.standardizedFileURL
        guard root.isFileURL else { throw CleanseSafetyError.rejected("Choose a local folder.") }
        let forbiddenRoots = ["/", "/Users", "/Volumes", home.path, home.appendingPathComponent("Library").path]
        guard !forbiddenRoots.map({ $0.lowercased() }).contains(root.path.lowercased()), !(root.pathComponents.count == 3 && root.pathComponents[1].lowercased() == "users") else {
            throw CleanseSafetyError.rejected("Choose a specific folder, such as Downloads, instead of a home, Library, or disk root.")
        }
        try validateLocation(root, isDirectory: true)
        guard try root.resourceValues(forKeys: [.isVolumeKey]).isVolume != true else {
            throw CleanseSafetyError.rejected("Choose a specific folder instead of an entire disk.")
        }
        let info = try metadata(root)
        guard (info.st_mode & S_IFMT) == S_IFDIR else { throw CleanseSafetyError.rejected("The selected item is not a folder.") }
    }

    static func validateLocation(_ url: URL, isDirectory: Bool) throws {
        guard url.isFileURL else { throw CleanseSafetyError.rejected("Only local files are supported.") }
        let normalized = url.standardizedFileURL
        for path in protectedTrees where isWithinProtectedTree(normalized, path: path) {
            throw CleanseSafetyError.rejected("System locations are excluded.")
        }
        let parts = normalized.pathComponents
        let lowerParts = parts.map { $0.lowercased() }
        if lowerParts.contains(where: { protectedNames.contains($0) }) {
            throw CleanseSafetyError.rejected("This location contains protected application or security data.")
        }
        if lowerParts.contains("library") && !(isDirectory ? isAllowedCacheTraversal(normalized) : browserCacheKind(for: normalized) != nil) {
            throw CleanseSafetyError.rejected("Only supported browser cache directories are accessible within Library.")
        }
        if lowerParts.contains(where: { isCloudFolder($0) }) {
            throw CleanseSafetyError.rejected("Cloud-managed locations are excluded to avoid deleting synchronised copies.")
        }
        if parts.contains(where: { packageExtensions.contains(URL(fileURLWithPath: $0).pathExtension.lowercased()) }) {
            throw CleanseSafetyError.rejected("Application bundles, libraries and packages are excluded.")
        }
        try validateAncestors(normalized)
        let values = try normalized.resourceValues(forKeys: [.isAliasFileKey, .isPackageKey, .isUbiquitousItemKey, .volumeIsLocalKey])
        guard values.isAliasFile != true, values.isPackage != true, values.isUbiquitousItem != true, values.volumeIsLocal == true else {
            throw CleanseSafetyError.rejected("Aliases, packages, cloud files and network volumes are excluded.")
        }
    }

    private static func isCloudFolder(_ name: String) -> Bool {
        name == "cloudstorage" || name == "mobile documents" || name == "icloud drive" || name == "dropbox" || name.hasPrefix("dropbox (") || name.hasPrefix("onedrive") || name == "google drive" || name.hasPrefix("googledrive") || name == "box" || name == "pcloud drive"
    }

    /// Check every existing component with lstat so directory links cannot bypass containment.
    static func validateAncestors(_ url: URL) throws {
        var current = URL(fileURLWithPath: "/", isDirectory: true)
        let components = url.standardizedFileURL.pathComponents.dropFirst()
        for (index, component) in components.enumerated() {
            current.appendPathComponent(component)
            let info = try metadata(current)
            let type = info.st_mode & S_IFMT
            guard type != S_IFLNK else { throw CleanseSafetyError.rejected("Symbolic links and their contents are excluded.") }
            if index < components.count - 1, type != S_IFDIR {
                throw CleanseSafetyError.rejected("A containing folder has changed.")
            }
            // Finder aliases and application packages may also occur above the selected root.
            let values = try current.resourceValues(forKeys: [.isAliasFileKey, .isPackageKey, .isUbiquitousItemKey])
            if values.isAliasFile == true || values.isPackage == true || values.isUbiquitousItem == true {
                throw CleanseSafetyError.rejected("This path passes through an alias, package, or cloud-managed folder.")
            }
        }
    }

    static func metadata(_ url: URL) throws -> stat {
        var info = stat()
        let result = url.withUnsafeFileSystemRepresentation { path -> Int32 in
            guard let path = path else { return -1 }
            return lstat(path, &info)
        }
        guard result == 0 else { throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno), userInfo: [NSFilePathErrorKey: url.path]) }
        return info
    }

    static func snapshot(_ info: stat) -> FileSnapshot {
        FileSnapshot(device: UInt64(UInt32(bitPattern: info.st_dev)), inode: UInt64(info.st_ino), byteCount: Int64(info.st_size), modifiedSeconds: Int64(info.st_mtimespec.tv_sec), modifiedNanoseconds: Int64(info.st_mtimespec.tv_nsec))
    }

    /// Enforce both the selected pathname and its resolved location before any entry
    /// is used. Root identity and device checks also stop traversal into mounted folders.
    static func validateScopedEntry(_ url: URL, root: URL, rootSnapshot: FileSnapshot, includeSubfolders: Bool = true) throws {
        let normalized = url.standardizedFileURL
        let selected = root.standardizedFileURL
        guard isStrictDescendant(normalized, of: selected),
              isStrictDescendant(normalized.resolvingSymlinksInPath(), of: selected.resolvingSymlinksInPath()) else {
            throw CleanseSafetyError.rejected("The item is outside the selected scan folder.")
        }
        guard includeSubfolders || normalized.deletingLastPathComponent() == selected else {
            throw CleanseSafetyError.rejected("Subfolders are excluded from this scan.")
        }
        let currentRoot = try metadata(selected)
        let currentRootSnapshot = snapshot(currentRoot)
        guard (currentRoot.st_mode & S_IFMT) == S_IFDIR,
              currentRootSnapshot.device == rootSnapshot.device,
              currentRootSnapshot.inode == rootSnapshot.inode else {
            throw CleanseSafetyError.rejected("The selected folder changed during the scan. Choose it again.")
        }
        // Check each descendant component, including the final entry. lstat never
        // follows directory links, and a changed device identifies a mounted subtree.
        var current = selected
        for component in normalized.pathComponents.dropFirst(selected.pathComponents.count) {
            current.appendPathComponent(component)
            let info = try metadata(current)
            guard (info.st_mode & S_IFMT) != S_IFLNK,
                  snapshot(info).device == rootSnapshot.device else {
                throw CleanseSafetyError.rejected("Symbolic links and mounted subfolders are excluded.")
            }
            if (info.st_mode & S_IFMT) == S_IFDIR,
               try current.resourceValues(forKeys: [.isVolumeKey]).isVolume == true {
                throw CleanseSafetyError.rejected("Mounted subfolders are excluded.")
            }
        }
    }

    static func validateFile(_ file: ScannedFile, roots: [ScanRoot]) throws {
        guard let root = roots.first(where: { $0.id == file.rootID }), isStrictDescendant(file.url, of: root.url) else {
            throw CleanseSafetyError.rejected("The file is outside its selected scan folder.")
        }
        try validateRoot(root.url)
        try validateScopedEntry(file.url, root: root.url, rootSnapshot: snapshot(metadata(root.url)))
        try validateLocation(file.url, isDirectory: false)
        let info = try metadata(file.url)
        guard (info.st_mode & S_IFMT) == S_IFREG, snapshot(info) == file.snapshot else {
            throw CleanseSafetyError.rejected("The file changed after scanning. Scan again before selecting it.")
        }
        if let browser = browserCacheKind(for: file.url) {
            guard browser == file.browser else { throw CleanseSafetyError.rejected("The browser cache classification changed.") }
            let modified = Date(timeIntervalSince1970: TimeInterval(info.st_mtimespec.tv_sec) + TimeInterval(info.st_mtimespec.tv_nsec) / 1_000_000_000)
            guard Date().timeIntervalSince(modified) >= 24 * 60 * 60 else { throw CleanseSafetyError.rejected("Recently used cache files are excluded.") }
        } else if file.browser != nil {
            throw CleanseSafetyError.rejected("This file is outside the supported browser cache directories.")
        }
    }
}
