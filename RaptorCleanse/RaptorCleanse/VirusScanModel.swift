import Foundation
import Combine
import AppKit
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

    var canScan: Bool { engine != nil && selectedFolder != nil && !isScanning && !isCheckingEngine }

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
        let token = VirusScanCancellation()
        cancellation = token
        report = nil
        message = nil
        isScanning = true
        isCancelling = false
        progress = VirusScanProgress(completed: 0, total: 0, message: "Preparing the selected folder…")
        Task {
            let completedReport = await Task.detached(priority: .utility) {
                VirusScanner.scan(engine: engine, folder: folder, includeSubfolders: recurse, cancellation: token) { [weak self] update in
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
