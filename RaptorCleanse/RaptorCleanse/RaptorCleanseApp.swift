import AppKit
import SwiftUI

@MainActor
final class CleanseAppDelegate: NSObject, NSApplicationDelegate {
    weak var model: CleanseModel?
    weak var virusModel: VirusScanModel?
    private var awaitingVirusShutdown = false
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if awaitingVirusShutdown { return .terminateLater }
        // Let the current move-to-Trash operation finish before exiting.
        if model?.isCleaning == true {
            let alert = NSAlert()
            alert.messageText = "Cleanup is still running"
            alert.informativeText = "Please wait for the current move to Trash to finish before quitting."
            alert.addButton(withTitle: "Continue cleanup")
            alert.runModal()
            return .terminateCancel
        }
        model?.cancelScan()
        if let virusModel, virusModel.isScanning || virusModel.isCheckingEngine {
            awaitingVirusShutdown = true
            virusModel.cancelScan()
            // Keep the run loop alive for process completion and the bounded
            // SIGTERM/SIGKILL fallback before the application actually exits.
            Task { @MainActor [weak self] in
                while virusModel.isScanning || virusModel.isCheckingEngine {
                    try? await Task.sleep(nanoseconds: 100_000_000)
                }
                self?.awaitingVirusShutdown = false
                sender.reply(toApplicationShouldTerminate: self?.model?.isCleaning != true)
            }
            return .terminateLater
        }
        return .terminateNow
    }
}

@main
@MainActor
struct RaptorCleanseApp: App {
    @NSApplicationDelegateAdaptor(CleanseAppDelegate.self) private var appDelegate
    @StateObject private var model = CleanseModel()
    @StateObject private var browserModel = BrowserModel()
    @StateObject private var virusModel = VirusScanModel()
    var body: some Scene {
        Window(Brand.name, id: "main") {
            ContentView()
                .environmentObject(model)
                .environmentObject(browserModel)
                .environmentObject(virusModel)
                .onAppear { appDelegate.model = model; appDelegate.virusModel = virusModel }
                .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
                    browserModel.refresh()
                }
        }
        .defaultSize(width: Brand.defaultWindowWidth, height: Brand.defaultWindowHeight)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("Choose folder…") { model.chooseFolder() }
                    .keyboardShortcut("o")
                    .disabled(model.isScanning || model.isCleaning)
                Button("Scan current scope") { model.scan() }
                    .keyboardShortcut("r")
                    .disabled(!model.canScan)
                Button("Browser cleaner") { model.section = .privacy }
                    .keyboardShortcut("b", modifiers: [.command, .shift])
                Button("Folder review") { model.showFolderReview() }
                    .keyboardShortcut("f", modifiers: [.command, .shift])
                    .disabled(model.isScanning || model.isCleaning)
                Button("Virus scan") { model.section = .virus }
                    .keyboardShortcut("v", modifiers: [.command, .shift])
            }
            CommandGroup(after: .help) {
                Button("Export diagnostics…") { model.exportDiagnostics() }
            }
        }
    }
}
