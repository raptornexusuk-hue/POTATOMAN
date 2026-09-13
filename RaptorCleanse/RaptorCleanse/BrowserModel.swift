import AppKit
import Combine
import Foundation

/// Browser read permissions are intentionally independent from CleanseModel's selected folders.
@MainActor
final class BrowserModel: ObservableObject {
    @Published private(set) var installations: [BrowserInstallation] = []
    @Published private(set) var profiles: [BrowserProfile] = []
    @Published private(set) var isRefreshing = false
    @Published private(set) var hasAccess = false
    @Published private(set) var accessGeneration = 0
    @Published var statusMessage = "Installed browsers are detected automatically. Allow access to discover their local profiles."
    @Published var errorMessage: String?
    private var scopedURLs: [URL] = []
    private var activatedScopePaths: Set<String> = []
    private var refreshID = UUID()
    private let bookmarksKey = "browserReadPermissions.v1"

    init() {
        refreshInstallations()
        restoreAccess()
        refresh()
    }

    private func refreshInstallations() {
        let running = Set(NSWorkspace.shared.runningApplications.compactMap(\.bundleIdentifier))
        installations = BrowserDiscovery.installations(applicationURL: { NSWorkspace.shared.urlForApplication(withBundleIdentifier: $0) }, runningIDs: running)
    }

    func grantAccess() {
        let panel = NSOpenPanel()
        panel.title = "Allow browser profile access"
        panel.message = "Choose your home Library folder. \(Brand.name) reads only recognised browser profile metadata and history counts, and locates supported caches. This permission does not add Library to your folder scan. macOS may separately protect Safari history."
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.canCreateDirectories = false
        panel.allowsMultipleSelection = false
        panel.showsHiddenFiles = true
        panel.directoryURL = BrowserDiscovery.library()
        panel.prompt = "Allow browser access"
        guard panel.runModal() == .OK, let selected = panel.url else { return }
        let accessing = selected.startAccessingSecurityScopedResource()
        defer { if accessing { selected.stopAccessingSecurityScopedResource() } }
        do {
            try BrowserDiscovery.validatePermissionRoot(selected)
            let data = try selected.bookmarkData(options: [.withSecurityScope, .securityScopeAllowOnlyReadAccess], includingResourceValuesForKeys: nil, relativeTo: nil)
            try addPermission(data)
            persistAccess()
            refreshID = UUID()
            isRefreshing = false
            refresh()
        } catch { errorMessage = error.localizedDescription }
    }

    private func addPermission(_ bookmark: Data) throws {
        var stale = false
        let url = try URL(resolvingBookmarkData: bookmark, options: [.withSecurityScope, .withoutUI], relativeTo: nil, bookmarkDataIsStale: &stale)
        let accessing = url.startAccessingSecurityScopedResource()
        do {
            try BrowserDiscovery.validatePermissionRoot(url)
            if scopedURLs.contains(where: { $0.standardizedFileURL == url.standardizedFileURL }) {
                if accessing { url.stopAccessingSecurityScopedResource() }
                return
            }
            // A direct local build can already read the selected directory and return false.
            // Retain the explicit logical permission and only balance scopes that activated.
            scopedURLs.append(url)
            if accessing { activatedScopePaths.insert(url.path) }
            hasAccess = !scopedURLs.isEmpty
            accessGeneration += 1
        } catch {
            if accessing { url.stopAccessingSecurityScopedResource() }
            throw error
        }
    }

    private func restoreAccess() {
        guard let records = UserDefaults.standard.array(forKey: bookmarksKey) as? [Data] else { return }
        for bookmark in records {
            do { try addPermission(bookmark) }
            catch { statusMessage = "A saved browser permission is unavailable. Allow browser access again." }
        }
        persistAccess()
    }

    private func persistAccess() {
        let data = scopedURLs.compactMap { try? $0.bookmarkData(options: [.withSecurityScope, .securityScopeAllowOnlyReadAccess], includingResourceValuesForKeys: nil, relativeTo: nil) }
        UserDefaults.standard.set(data, forKey: bookmarksKey)
    }

    func revokeAccess() {
        refreshID = UUID()
        for url in scopedURLs where activatedScopePaths.contains(url.path) { url.stopAccessingSecurityScopedResource() }
        activatedScopePaths = []
        scopedURLs = []
        profiles = []
        hasAccess = false
        accessGeneration += 1
        isRefreshing = false
        UserDefaults.standard.removeObject(forKey: bookmarksKey)
        statusMessage = "Browser access forgotten. Installed browsers can still open their own privacy controls."
        refresh()
    }

    func refresh() {
        guard !isRefreshing else { return }
        refreshInstallations()
        let currentID = UUID()
        refreshID = currentID
        let currentInstallations = installations
        let permissionRoots = scopedURLs
        isRefreshing = true
        Task { [weak self] in
            let result = await Task.detached(priority: .utility) {
                BrowserDiscovery.discover(installations: currentInstallations, authorizedRoots: permissionRoots)
            }.value
            guard let self, self.refreshID == currentID else { return }
            self.profiles = result.profiles
            self.isRefreshing = false
            if !result.warnings.isEmpty {
                self.statusMessage = result.warnings.joined(separator: " ")
            } else if currentInstallations.isEmpty {
                self.statusMessage = "No supported browsers found. Install or open Safari, Chrome, Edge, Brave or Firefox, then refresh."
            } else if permissionRoots.isEmpty {
                self.statusMessage = "\(currentInstallations.count) installed browsers detected. Allow access to find local profiles and history counts."
            } else {
                let count = result.profiles.filter { $0.historyURL != nil }.count
                self.statusMessage = "\(currentInstallations.count) browsers detected · \(count) local profiles. History counts refresh when you return to \(Brand.name)."
            }
        }
    }

    func cacheURLs(for profile: BrowserProfile) -> [URL] {
        guard profiles.contains(where: { $0.id == profile.id }) else { return [] }
        return profile.cachePaths.filter { (try? BrowserDiscovery.validateReadLocation($0, roots: scopedURLs, isDirectory: true)) != nil }
    }

    /// Opens the selected browser's native controls. No database is edited or deleted here.
    /// Existing browser processes can choose their active profile; the user must verify it there.
    func openHistoryControls(_ profile: BrowserProfile) {
        guard let installation = installations.first(where: { $0.id == profile.installationID }) else {
            errorMessage = "This browser is no longer installed. Refresh the browser list."
            return
        }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = true
        configuration.createsNewApplicationInstance = false
        let guidance: String
        switch profile.browser {
        case .safari:
            guidance = "Opened \(installation.displayName). In the browser, choose History → Clear History, check the profile and time range, then confirm. Return here and refresh to check the count."
            NSWorkspace.shared.openApplication(at: installation.applicationURL, configuration: configuration) { [weak self] _, error in
                let message = error?.localizedDescription
                Task { @MainActor [weak self] in if let message { self?.errorMessage = "Could not open this browser: \(message)" } }
            }
        default:
            let destination: String
            switch profile.browser {
            case .firefox: destination = "about:preferences#privacy"
            case .edge: destination = "edge://settings/clearBrowserData"
            case .brave: destination = "brave://settings/clearBrowserData"
            default: destination = "chrome://settings/clearBrowserData"
            }
            if profile.browser != .firefox && BrowserDiscovery.isChromiumProfile(profile.directoryURL.lastPathComponent) {
                configuration.arguments = ["--profile-directory=\(profile.directoryURL.lastPathComponent)"]
            }
            guard let url = URL(string: destination) else { return }
            guidance = "Opened \(installation.displayName). Check that \(profile.displayName) is the active profile, choose the time range and browsing history, then confirm in the browser. Return here and refresh to check the count."
            NSWorkspace.shared.open([url], withApplicationAt: installation.applicationURL, configuration: configuration) { [weak self] _, error in
                let message = error?.localizedDescription
                Task { @MainActor [weak self] in
                    if let message { self?.errorMessage = "The browser could not open its privacy page: \(message). Open its Settings → Privacy controls manually." }
                }
            }
        }
        statusMessage = guidance
    }
}
