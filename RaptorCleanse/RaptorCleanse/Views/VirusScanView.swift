import SwiftUI

/// Which colour role an outcome or finding gets. Kept next to the view so the
/// Sendable scan models stay free of any user-interface type.
private extension VirusScanOutcome {
    var tone: BrandTone {
        switch self {
        case .noDetections: return .positive
        case .detections: return .critical
        case .incomplete, .cancelled, .noFiles: return .caution
        }
    }

    var symbol: String {
        switch self {
        case .noDetections: return "checkmark.shield"
        case .detections: return "exclamationmark.shield"
        case .incomplete, .cancelled, .noFiles: return "questionmark.circle"
        }
    }
}

struct VirusScanView: View {
    @EnvironmentObject private var model: VirusScanModel
    @State private var showTechnicalReport = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: BrandSpace.lg) {
                introPanel
                if model.engine == nil {
                    setupPanel
                } else {
                    if model.needsDefinitions { definitionsPanel }
                    quickScanPanel
                }
                if let message = model.message {
                    CleanseCallout(text: message, tone: .caution)
                }
                if model.isScanning { progressPanel }
                if let report = model.report { resultPanel(report) }
                enginePanel
                coveragePanel
            }
            .padding(.horizontal, BrandSpace.xl)
            .padding(.bottom, BrandSpace.xl)
        }
        .task {
            model.prepareIfNeeded()
            model.startScanIfLaunchedAtLogin()
        }
    }

    private var introPanel: some View {
        CleansePanel {
            HStack(alignment: .top, spacing: BrandSpace.md) {
                CleanseIconTile(symbol: "shield.lefthalf.filled", size: 62)
                VStack(alignment: .leading, spacing: BrandSpace.xs) {
                    Text("A second opinion for your files").font(BrandFont.heading)
                    Text("Check a folder with the ClamAV malware engine. Review clear results, with your files kept in place.")
                        .font(BrandFont.body)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: BrandSpace.xs) {
                        CleanseStatusPill(title: "On demand", symbol: "hand.tap")
                        CleanseStatusPill(title: "Local results", symbol: "lock")
                        CleanseStatusPill(title: "No automatic removal", symbol: "trash.slash")
                    }
                    .padding(.top, BrandSpace.xxs)
                }
            }
        }
    }

    private var enginePanel: some View {
        CleansePanel {
            VStack(alignment: .leading, spacing: BrandSpace.md) {
                HStack(alignment: .top) {
                    CleanseSectionHeading(title: "Scanning engine",
                                          detail: model.engine == nil
                                              ? "An installed engine and signature database are needed."
                                              : "Using your installed engine and local signature database.")
                    Spacer(minLength: BrandSpace.sm)
                    if model.isCheckingEngine {
                        ProgressView().controlSize(.small)
                    } else {
                        CleanseStatusPill(title: model.engine == nil ? "Setup needed" : "Engine found",
                                          symbol: model.engine == nil ? "wrench" : "checkmark.circle",
                                          tone: model.engine == nil ? .caution : .positive)
                    }
                }
                if let engine = model.engine {
                    CleanseWell {
                        VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                            Text(engine.version)
                                .font(BrandFont.mono)
                                .textSelection(.enabled)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(engine.executableURL.path)
                                .font(BrandFont.detail)
                                .foregroundStyle(.secondary)
                                .textSelection(.enabled)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    Text(model.definitionsSummary)
                        .font(BrandFont.detail)
                        .foregroundStyle(model.needsDefinitions ? BrandColor.caution : .secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: BrandSpace.sm) { engineActions }
                    VStack(alignment: .leading, spacing: BrandSpace.sm) { engineActions }
                }
                HStack(spacing: BrandSpace.lg) {
                    Link("Official installation guide ↗", destination: VirusScanner.installationURL)
                    Link("Signature updates ↗", destination: VirusScanner.signaturesURL)
                }
                .font(BrandFont.body.weight(.medium))
                .tint(BrandColor.accent)
            }
        }
    }

    @ViewBuilder private var engineActions: some View {
        Button("Detect engine", action: model.discoverEngine)
            .buttonStyle(CleanseSecondaryButtonStyle())
            .disabled(model.isScanning || model.isCheckingEngine)
        Button("Choose installed engine…", action: model.chooseEngine)
            .buttonStyle(CleanseSecondaryButtonStyle())
            .disabled(model.isScanning || model.isCheckingEngine)
    }

    /// The whole scan in one panel: a folder that is already chosen, and a
    /// button. Picking a different folder stays available but is not required.
    private var quickScanPanel: some View {
        CleansePanel {
            VStack(alignment: .leading, spacing: BrandSpace.md) {
                CleanseSectionHeading(title: "Scan a folder",
                                      detail: "Downloads is pre-selected because that is where files usually arrive.")

                HStack(spacing: BrandSpace.xs) {
                    ForEach(VirusScanModel.presets) { preset in
                        presetButton(preset)
                    }
                    Button("Choose…", action: model.chooseFolder)
                        .buttonStyle(CleanseSecondaryButtonStyle())
                        .disabled(model.isScanning)
                    Spacer(minLength: 0)
                }

                if let folder = model.selectedFolder {
                    Text(folder.path)
                        .font(BrandFont.mono)
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                        .lineLimit(2)
                        .truncationMode(.middle)
                        .help(folder.path)
                } else {
                    Text("No folder selected")
                        .font(BrandFont.rowTitle)
                        .foregroundStyle(.secondary)
                }

                Toggle("Include subfolders", isOn: $model.includeSubfolders)
                    .font(BrandFont.body)
                    .toggleStyle(.checkbox)
                    .disabled(model.isScanning)

                HStack(spacing: BrandSpace.sm) {
                    Toggle("Scan at login", isOn: Binding(
                        get: { model.scanAtLogin },
                        set: { model.setScanAtLogin($0) }
                    ))
                    .font(BrandFont.body)
                    .toggleStyle(.switch)
                    .tint(BrandColor.accent)
                    .disabled(model.isScanning)
                    Spacer(minLength: 0)
                    Button(action: model.startScan) {
                        Label("Scan now", systemImage: "shield.lefthalf.filled")
                    }
                    .buttonStyle(CleansePrimaryButtonStyle())
                    .disabled(!model.canScan)
                    .keyboardShortcut(.defaultAction)
                }

                if let note = model.loginItemMessage {
                    CleanseCallout(text: note, tone: .caution)
                }
            }
        }
    }

    private func presetButton(_ preset: VirusScanModel.ScanPreset) -> some View {
        let selected = model.isPresetSelected(preset)
        return Button { model.selectPreset(preset) } label: {
            Label(preset.title, systemImage: preset.symbol)
                .font(BrandFont.body.weight(selected ? .semibold : .medium))
                .foregroundStyle(selected ? BrandColor.accent : Color.primary)
                .padding(.horizontal, BrandSpace.sm)
                .padding(.vertical, BrandSpace.xs)
                .background(selected ? BrandColor.accentWash : BrandColor.panel)
                .clipShape(RoundedRectangle(cornerRadius: BrandRadius.md))
                .overlay {
                    RoundedRectangle(cornerRadius: BrandRadius.md)
                        .stroke(selected ? BrandColor.accent.opacity(0.55) : BrandColor.line, lineWidth: 1)
                }
                .contentShape(RoundedRectangle(cornerRadius: BrandRadius.md))
        }
        .buttonStyle(.plain)
        .disabled(model.isScanning)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    /// The engine can be installed and still unable to produce a result: with no
    /// signatures, or signatures over a week old, every scan ends as "incomplete"
    /// with nothing scanned. That is what this panel exists to fix, in place.
    private var definitionsPanel: some View {
        CleansePanel {
            VStack(alignment: .leading, spacing: BrandSpace.md) {
                HStack(alignment: .top, spacing: BrandSpace.md) {
                    CleanseIconTile(symbol: "arrow.down.doc", size: 48, tone: .caution)
                    VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                        Text(model.engine?.hasDefinitions == true ? "Malware definitions are out of date" : "Malware definitions are missing")
                            .font(BrandFont.heading)
                        Text(model.definitionsSummary)
                            .font(BrandFont.body)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                Text("ClamAV ships with no signatures of its own. Until they are downloaded, a scan reports nothing found because nothing could be checked — not because the files are clean.")
                    .font(BrandFont.detail)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: BrandSpace.sm) {
                    Button(action: model.updateDefinitions) {
                        Label(model.isUpdatingDefinitions ? "Updating…" : "Update definitions", systemImage: "arrow.down.circle")
                    }
                    .buttonStyle(CleansePrimaryButtonStyle())
                    .disabled(model.isUpdatingDefinitions || model.isScanning)
                    if model.isUpdatingDefinitions {
                        ProgressView().controlSize(.small)
                        Text("Downloading from the official mirrors. This can take a few minutes.")
                            .font(BrandFont.detail)
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                }

                if let output = model.updateOutput {
                    CleanseWell {
                        Text(output)
                            .font(BrandFont.mono)
                            .textSelection(.enabled)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                Text("If that fails with a permission error, the database is owned by another user. Run `sudo freshclam` in Terminal instead.")
                    .font(BrandFont.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                Divider()

                Toggle("Scan anyway with out-of-date definitions", isOn: $model.allowStaleDefinitions)
                    .font(BrandFont.body)
                    .toggleStyle(.checkbox)
                    .disabled(model.isScanning)
                Text("Lets a scan run and report results, at the cost of missing anything discovered since these signatures were published.")
                    .font(BrandFont.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    /// Shown instead of the scan controls when there is no engine. The previous
    /// message pointed at a documentation page; this gives the actual command.
    private var setupPanel: some View {
        CleansePanel {
            VStack(alignment: .leading, spacing: BrandSpace.md) {
                HStack(alignment: .top, spacing: BrandSpace.md) {
                    CleanseIconTile(symbol: "wrench.and.screwdriver", size: 48, tone: .caution)
                    VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                        Text("ClamAV is not installed yet").font(BrandFont.heading)
                        Text("The scanner uses the free ClamAV engine, which is a separate install and is not bundled with \(Brand.name). This is a one-time setup.")
                            .font(BrandFont.body)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                CleanseWell {
                    VStack(alignment: .leading, spacing: BrandSpace.xs) {
                        Text("1. Paste this into Terminal").font(BrandFont.detail.weight(.medium))
                        Text(VirusScanModel.installCommand)
                            .font(BrandFont.mono)
                            .textSelection(.enabled)
                            .fixedSize(horizontal: false, vertical: true)
                        Text("Installs the engine, then downloads the official malware signatures. Needs Homebrew, and takes a few minutes.")
                            .font(BrandFont.caption)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                HStack(spacing: BrandSpace.sm) {
                    Button(action: model.copyInstallCommand) {
                        Label("Copy command", systemImage: "doc.on.doc")
                    }
                    .buttonStyle(CleanseSecondaryButtonStyle())
                    Button(action: model.discoverEngine) {
                        Label(model.isCheckingEngine ? "Checking…" : "2. I've installed it — detect", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(CleansePrimaryButtonStyle())
                    .disabled(model.isCheckingEngine)
                    Spacer(minLength: 0)
                }

                Text("No Homebrew? Use the official package from the installation guide below, then choose the installed engine by hand.")
                    .font(BrandFont.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var progressPanel: some View {
        CleansePanel {
            VStack(alignment: .leading, spacing: BrandSpace.md) {
                HStack(spacing: BrandSpace.sm) {
                    ProgressView().controlSize(.small)
                    Text(model.progress.message).font(BrandFont.body.weight(.medium))
                    Spacer()
                    Button(model.isCancelling ? "Stopping…" : "Cancel", action: model.cancelScan)
                        .buttonStyle(CleanseSecondaryButtonStyle())
                        .disabled(model.isCancelling)
                }
                if model.progress.total > 0 {
                    ProgressView(value: Double(model.progress.completed), total: Double(model.progress.total))
                        .tint(BrandColor.accentBright)
                    Text("Progress updates after each group of files. Large archives can take longer.")
                        .font(BrandFont.detail)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func resultPanel(_ report: VirusScanReport) -> some View {
        CleansePanel {
            VStack(alignment: .leading, spacing: BrandSpace.md) {
                HStack(alignment: .top, spacing: BrandSpace.sm) {
                    CleanseIconTile(symbol: report.outcome.symbol, size: 44, tone: report.outcome.tone)
                    VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                        Text(report.outcome.rawValue)
                            .font(BrandFont.heading)
                            .foregroundStyle(report.outcome.tone.foreground)
                            .fixedSize(horizontal: false, vertical: true)
                        Text("Scope: \(report.folder.path)\(report.includedSubfolders ? " (with subfolders)" : " (this folder only)")")
                            .font(BrandFont.detail)
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                    Button("Export report…", action: model.exportReport)
                        .buttonStyle(CleanseSecondaryButtonStyle())
                }

                CleanseWell {
                    HStack(alignment: .top, spacing: BrandSpace.md) {
                        CleanseMetric(label: "Files scanned", value: report.scannedFiles.formatted())
                        CleanseMetric(label: "Files with alerts", value: report.alertedFiles.formatted())
                        CleanseMetric(label: "Not checked", value: report.coverageGaps.formatted(),
                                      detail: report.emptyFilesSkipped > 0 ? "\(report.emptyFilesSkipped.formatted()) empty files ignored" : nil)
                    }
                }

                if report.alertedFiles > 0 {
                    CleanseCallout(text: "Keep flagged files closed while you review them. Alerts can include malware matches, encrypted content or scan limits. No files were removed or quarantined.",
                                   symbol: "exclamationmark.triangle",
                                   tone: .critical)
                }

                ForEach(Array(report.findings.prefix(100))) { finding in
                    findingRow(finding)
                }
                if report.findings.count > 100 {
                    Text("Showing the first 100 alerts. Export the report for all findings.")
                        .font(BrandFont.detail)
                        .foregroundStyle(.secondary)
                }

                ForEach(Array(report.warnings.prefix(10).enumerated()), id: \.offset) { _, warning in
                    Label(warning, systemImage: "info.circle")
                        .font(BrandFont.detail)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                DisclosureGroup("Engine output", isExpanded: $showTechnicalReport) {
                    Text(String(report.rawOutput.prefix(20_000)))
                        .font(BrandFont.mono)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, BrandSpace.xs)
                    if report.rawOutput.count > 20_000 {
                        Text("Preview shortened. Export the report to see the complete captured output.")
                            .font(BrandFont.detail)
                            .foregroundStyle(.secondary)
                    }
                }
                .font(BrandFont.body.weight(.medium))

                Text("No detections means ClamAV found no matches in the files it scanned; it does not guarantee that a file is safe.")
                    .font(BrandFont.detail)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    /// A coverage alert means the engine could not see inside a file; a detection
    /// means it matched a signature. They are not the same event and no longer
    /// share one colour.
    private func findingRow(_ finding: VirusFinding) -> some View {
        let tone: BrandTone = finding.isCoverageAlert ? .caution : .critical
        return VStack(alignment: .leading, spacing: BrandSpace.xxs) {
            Label(finding.isCoverageAlert ? "Coverage alert" : "Detection to review",
                  systemImage: finding.isCoverageAlert ? "eye.trianglebadge.exclamationmark" : "exclamationmark.shield")
                .font(BrandFont.rowTitle)
                .foregroundStyle(tone.foreground)
            Text(finding.signature)
                .font(BrandFont.body.weight(.medium))
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
            Text(finding.path)
                .font(BrandFont.mono)
                .foregroundStyle(.secondary)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(BrandSpace.sm)
        .background(tone.wash)
        .clipShape(RoundedRectangle(cornerRadius: BrandRadius.md))
    }

    private var coveragePanel: some View {
        CleansePanel {
            VStack(alignment: .leading, spacing: BrandSpace.xs) {
                CleanseSectionHeading(title: "What this scan covers",
                                      detail: "Eligible local files in your chosen folder. Keep ClamAV and its signatures current; this app requires official signatures no more than seven days old.")
                Text("System folders, applications and packages, cloud-managed files, links, nested disks and files over 512 MB are excluded. Encrypted files and engine limits are reported for review. This is not continuous protection or a whole-Mac security assessment.")
                    .font(BrandFont.detail)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
