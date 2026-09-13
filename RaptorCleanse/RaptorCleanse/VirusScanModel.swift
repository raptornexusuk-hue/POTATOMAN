import Foundation
import Combine
import AppKit
import ServiceManagement
import UniformTypeIdentifiers

@MainActor
final class VirusScanModel: ObservableObject {
    @Published private(set) var engine: VirusEngine?
    @Published private(set) var selectedFolder: URL?
    @Published var includeSubfolders = false
    @Published private(set) var isCheckingEngine = false
    @Published private(set) var isScanning = false
    @Published private(set) var isCancelling = false
    @Published private(set) var progress = VirusScanProgress(completed: 0, total: 0, message: "Choose a folder to check.")
    @Published private(set) var report: VirusScanReport?
    @Published var message: String?
    private var cancellation: VirusScanCancellation?
    private var hasDiscovered = false
    private var hasPreparedLaunch = false

    var canScan: Bool { engine != nil && selectedFolder != nil && !isScanning && !isCheckingEngine }

    // MARK: - One-click scanning

    /// Where most people actually acquire files. The home folder itself is not
    /// offered: the safety policy rejects it as a scan root, and scanning it
    /// whole would take long enough that nobody would wait for it.
    struct ScanPreset: Identifiable, Sendable {
        let id: String
        let title: String
        let symbol: String
        var url: URL { SafetyPolicy.userHomeDirectory.appendingPathComponent(id, isDirectory: true) }
    }

    static let presets: [ScanPreset] = [
        ScanPreset(id: "Downloads", title: "Downloads", symbol: "arrow.down.circle"),
        ScanPreset(id: "Desktop", title: "Desktop", symbol: "menubar.dock.rectangle"),
        ScanPreset(id: "Documents", title: "Documents", symbol: "doc")
    ]

    /// The command that installs the engine. Shown with a copy button, because
    /// "install ClamAV using the official guide" is not an instruction anyone
    /// can act on without leaving the app and reading a page first.
    static let installCommand = "brew install clamav && freshclam"

    @Published private(set) var scanAtLogin = false
    @Published private(set) var loginItemMessage: String?
    @Published private(set) var isUpdatingDefinitions = false
    @Published private(set) var updateOutput: String?
    /// Set only by a deliberate choice. Scanning with stale definitions can miss
    /// malware the engine would otherwise recognise.
    @Published var allowStaleDefinitions = false

    /// True when the engine exists but cannot produce a usable result, which is
    /// the state that made the scanner look broken: it ran, and always failed.
    var needsDefinitions: Bool {
        guard let engine else { return false }
        return !engine.hasDefinitions || (engine.definitionsAreStale && !allowStaleDefinitions)
    }

    var definitionsSummary: String {
        guard let engine else { return "No engine detected." }
        guard engine.hasDefinitions else {
            return "The engine is installed but has no malware signatures yet. Nothing can be scanned until they are downloaded."
        }
        let days = engine.definitionsAgeInDays ?? 0
        if days <= 0 { return "Signatures updated today\(engine.signatureCount.map { " · \($0.formatted()) definitions" } ?? "")." }
        let age = "\(days) \(days == 1 ? "day" : "days") old"
        return engine.definitionsAreStale
            ? "Signatures are \(age). Scans refuse to report a clean result on definitions over 7 days old."
            : "Signatures are \(age)\(engine.signatureCount.map { " · \($0.formatted()) definitions" } ?? "")."
    }

    /// Runs freshclam from the same installation as the engine.
    func updateDefinitions() {
        guard let engine, !isUpdatingDefinitions, !isScanning else { return }
        isUpdatingDefinitions = true
        message = nil
        updateOutput = nil
        let token = VirusScanCancellation()
        cancellation = token
        Task {
            let result = await Task.detached(priority: .utility) { () -> Result<String, Error> in
                Result { try VirusScanner.updateDefinitions(engine: engine, cancellation: token) }
            }.value
            isUpdatingDefinitions = false
            cancellation = nil
            switch result {
            case .success(let text):
                updateOutput = String(text.suffix(800))
                message = "Definitions updated. Re-checking the engine…"
                discoverEngine()
            case .failure(let error):
                // Permission is the usual cause with a system-wide database.
                message = "Could not update definitions: \(error.localizedDescription)"
            }
        }
    }

    /// Called once when the Virus scan page first appears: find the engine and
    /// pre-select a folder, so the page opens ready to scan rather than ready to
    /// be configured.
    func prepareIfNeeded() {
        discoverIfNeeded()
        guard !hasPreparedLaunch else { return }
        hasPreparedLaunch = true
        readLoginItemState()
        if selectedFolder == nil, let downloads = Self.presets.first {
            selectPreset(downloads)
        }
    }

    func selectPreset(_ preset: ScanPreset) {
        guard !isScanning else { return }
        do {
            try SafetyPolicy.validateRoot(preset.url)
            selectedFolder = preset.url.standardizedFileURL
            report = nil
            message = nil
            progress = VirusScanProgress(completed: 0, total: 0, message: "Ready to check \(preset.title).")
        } catch {
            message = "\(preset.title) could not be used: \(error.localizedDescription)"
        }
    }

    func isPresetSelected(_ preset: ScanPreset) -> Bool {
        selectedFolder?.standardizedFileURL == preset.url.standardizedFileURL
    }

    func copyInstallCommand() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(Self.installCommand, forType: .string)
        message = "Install command copied. Paste it into Terminal, then choose Detect engine."
    }

    // MARK: - Start at login

    private func readLoginItemState() {
        scanAtLogin = SMAppService.mainApp.status == .enabled
    }

    /// Registers the app itself as a login item. There is no helper tool and no
    /// background agent: the app opens at login and scans, and closing it stops
    /// everything.
    func setScanAtLogin(_ enabled: Bool) {
        do {
            if enabled {
                if SMAppService.mainApp.status != .enabled { try SMAppService.mainApp.register() }
            } else {
                if SMAppService.mainApp.status == .enabled { try SMAppService.mainApp.unregister() }
            }
            readLoginItemState()
            loginItemMessage = scanAtLogin
                ? "\(Brand.name) will open at login and scan the selected folder."
                : nil
        } catch {
            readLoginItemState()
            // A locally-signed build moved outside /Applications is the usual
            // reason this fails, and the error alone does not say so.
            loginItemMessage = "macOS refused the login item: \(error.localizedDescription) Move \(Brand.name) to your Applications folder and try again."
        }
    }

    /// Runs a scan immediately if the app was opened at login and everything
    /// needed is already in place.
    func startScanIfLaunchedAtLogin() {
        guard scanAtLogin, canScan, report == nil else { return }
        startScan()
    }

    func discoverEngine() {
        guard !isCheckingEngine, !isScanning else { return }
        hasDiscovered = true
        isCheckingEngine = true
        message = nil
        let token = VirusScanCancellation()
        cancellation = token
        Task {
            let found = await Task.detached(priority: .utility) { VirusScanner.discover(cancellation: token) }.value
            engine = found
            isCheckingEngine = false
            isCancelling = false
            cancellation = nil
            if token.isCancelled { message = "Engine detection stopped or timed out. Check the installation and try again." }
            else if found == nil { message = "ClamAV is not installed in a recognised location. Install it using the official guide, including its signature database, or choose an existing installation." }
        }
    }

    func discoverIfNeeded() {
        if !hasDiscovered { discoverEngine() }
    }

    func chooseEngine() {
        guard !isCheckingEngine, !isScanning else { return }
        let panel = NSOpenPanel()
        panel.title = "Choose an installed ClamAV engine"
        panel.message = "Select the executable named clamscan from a trusted installation. \(Brand.name) will run it to read its version."
        panel.prompt = "Use ClamAV"
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.showsHiddenFiles = true
        panel.directoryURL = URL(fileURLWithPath: "/usr/local", isDirectory: true)
        guard panel.runModal() == .OK, let url = panel.url else { return }
        isCheckingEngine = true
        message = nil
        let token = VirusScanCancellation()
        cancellation = token
        Task {
            let result = await Task.detached(priority: .utility) { () -> Result<VirusEngine, Error> in
                Result { try VirusScanner.inspectEngine(url, cancellation: token) }
            }.value
            switch result {
            case .success(let value): engine = value; hasDiscovered = true
            case .failure(let error): message = error.localizedDescription
            }
            isCheckingEngine = false
            isCancelling = false
            cancellation = nil
        }
    }

    func chooseFolder() {
        guard !isScanning else { return }
        let panel = NSOpenPanel()
        panel.title = "Choose one folder for a virus scan"
        panel.message = "Only this folder will be checked. Include subfolders is off by default."
        panel.prompt = "Choose folder"
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.resolvesAliases = false
        panel.directoryURL = selectedFolder ?? SafetyPolicy.userHomeDirectory.appendingPathComponent("Downloads", isDirectory: true)
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            try SafetyPolicy.validateRoot(url)
            selectedFolder = url.standardizedFileURL
            report = nil
            message = nil
            progress = VirusScanProgress(completed: 0, total: 0, message: "Ready to check the selected folder.")
        } catch { message = error.localizedDescription }
    }

    func startScan() {
        guard canScan, let engine, let folder = selectedFolder else { return }
        let recurse = includeSubfolders
        let stale = allowStaleDefinitions
        let token = VirusScanCancellation()
        cancellation = token
        report = nil
        message = nil
        isScanning = true
        isCancelling = false
        progress = VirusScanProgress(completed: 0, total: 0, message: "Preparing the selected folder…")
        Task {
            let completedReport = await Task.detached(priority: .utility) {
                VirusScanner.scan(engine: engine, folder: folder, includeSubfolders: recurse,
                                  allowStaleDefinitions: stale, cancellation: token) { [weak self] update in
                    Task { @MainActor [weak self] in
                        guard let self, self.isScanning, !self.isCancelling else { return }
                        self.progress = update
                    }
                }
            }.value
            report = completedReport
            isScanning = false
            isCancelling = false
            cancellation = nil
            progress = VirusScanProgress(completed: completedReport.scannedFiles, total: completedReport.scannedFiles, message: completedReport.outcome.rawValue)
        }
    }

    func cancelScan() {
        guard isScanning || isCheckingEngine else { return }
        isCancelling = true
        progress = VirusScanProgress(completed: progress.completed, total: progress.total, message: "Stopping ClamAV…")
        cancellation?.cancel()
    }

    func exportReport() {
        guard let report, !isScanning else { return }
        let panel = NSSavePanel()
        panel.title = "Export virus scan report"
        panel.allowedContentTypes = [.plainText]
        panel.nameFieldStringValue = "\(Brand.fileStem)-Virus-Scan.txt"
        panel.message = "The report includes local filenames and ClamAV findings. Choose where to save it."
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do { try report.exportText.write(to: url, atomically: true, encoding: .utf8) }
        catch { message = error.localizedDescription }
    }
}
