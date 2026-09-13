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
                enginePanel
                scopePanel
                if let message = model.message {
                    CleanseCallout(text: message, tone: .caution)
                }
                if model.isScanning { progressPanel }
                if let report = model.report { resultPanel(report) }
                coveragePanel
            }
            .padding(.horizontal, BrandSpace.xl)
            .padding(.bottom, BrandSpace.xl)
        }
        .task { model.discoverIfNeeded() }
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
                    CleanseStepHeading(number: 1,
                                       title: "ClamAV engine",
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
                    Text("The version line includes signature details when available. Database readiness and age are checked when a scan starts.")
                        .font(BrandFont.detail)
                        .foregroundStyle(.secondary)
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

    private var scopePanel: some View {
        CleansePanel {
            VStack(alignment: .leading, spacing: BrandSpace.md) {
                CleanseStepHeading(number: 2,
                                   title: "Choose exactly where to scan",
                                   detail: "This selection is independent of your cleaning folders.")
                if let folder = model.selectedFolder {
                    CleanseWell {
                        VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                            Label(folder.lastPathComponent, systemImage: "folder")
                                .font(BrandFont.subheading)
                            Text(folder.path)
                                .font(BrandFont.mono)
                                .foregroundStyle(.secondary)
                                .textSelection(.enabled)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                } else {
                    Text("No folder selected")
                        .font(BrandFont.rowTitle)
                        .foregroundStyle(.secondary)
                }
                Toggle("Include subfolders", isOn: $model.includeSubfolders)
                    .font(BrandFont.body)
                    .toggleStyle(.switch)
                    .tint(BrandColor.accent)
                    .disabled(model.isScanning)
                    .frame(maxWidth: 330, alignment: .leading)
                Text(model.includeSubfolders
                     ? "Includes eligible files in child folders. Links and mounted disks remain excluded."
                     : "Only eligible files directly inside the selected folder will be checked.")
                    .font(BrandFont.detail)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: BrandSpace.sm) {
                    Button(model.selectedFolder == nil ? "Choose folder…" : "Change folder…", action: model.chooseFolder)
                        .buttonStyle(CleanseSecondaryButtonStyle())
                        .disabled(model.isScanning)
                    Button(action: model.startScan) { Label("Scan for threats", systemImage: "shield") }
                        .buttonStyle(CleansePrimaryButtonStyle())
                        .disabled(!model.canScan)
                }
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
                        CleanseMetric(label: "Entries skipped", value: report.skippedEntries.formatted())
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
