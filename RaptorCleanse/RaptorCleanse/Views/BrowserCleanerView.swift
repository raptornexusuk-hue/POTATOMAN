import SwiftUI
import AppKit

struct BrowserCleanerView: View {
    @EnvironmentObject private var browsers: BrowserModel
    @EnvironmentObject private var files: CleanseModel
    @State private var historyProfile: BrowserProfile?
    private var busy: Bool { files.isScanning || files.isCleaning || browsers.isRefreshing }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: BrandSpace.lg) {
                if !browsers.hasAccess { accessCard }
                statusRow
                if browsers.installations.isEmpty {
                    CleanseEmptyState(symbol: "globe",
                                      title: browsers.isRefreshing ? "Finding your browsers" : "No supported browsers detected",
                                      detail: "\(Brand.name) checks installed Safari, Chrome, Edge, Firefox and Brave applications. Refresh after installing a browser.")
                } else {
                    ForEach(browsers.installations) { installation in
                        BrowserInstallationCard(installation: installation) { profile in
                            historyProfile = profile
                        }
                    }
                }
                if !browsers.statusMessage.isEmpty {
                    Text(browsers.statusMessage)
                        .font(BrandFont.detail)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)
                }
                explanationPanel
            }
            .padding(.horizontal, BrandSpace.xl)
            .padding(.bottom, BrandSpace.xl)
        }
        .sheet(item: $historyProfile) { profile in
            BrowserHistoryConfirmation(profile: profile)
        }
    }

    private var accessCard: some View {
        CleansePanel {
            VStack(alignment: .leading, spacing: BrandSpace.md) {
                HStack(alignment: .top, spacing: BrandSpace.md) {
                    CleanseIconTile(symbol: "lock.open", size: 48)
                    CleanseSectionHeading(title: "Connect your browser profiles",
                                          detail: "Grant access once so \(Brand.name) can find profile locations, eligible cache folders and readable history counts automatically.")
                }
                HStack(spacing: BrandSpace.md) {
                    Button("Grant browser access", action: browsers.grantAccess)
                        .buttonStyle(CleansePrimaryButtonStyle())
                        .disabled(busy)
                    Text("This does not change your folder scan.")
                        .font(BrandFont.detail)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var statusRow: some View {
        HStack(spacing: BrandSpace.sm) {
            Text("Detected on this Mac").font(BrandFont.heading)
            Spacer()
            if browsers.isRefreshing {
                ProgressView().controlSize(.small)
                Text("Checking…").font(BrandFont.detail).foregroundStyle(.secondary)
            } else {
                Text("\(browsers.installations.count) browsers · \(browsers.profiles.filter { $0.historyURL != nil }.count) history profiles")
                    .font(BrandFont.detail)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
        }
    }

    private var explanationPanel: some View {
        CleansePanel {
            VStack(alignment: .leading, spacing: BrandSpace.md) {
                CleanseSectionHeading(title: "Two different kinds of cleanup")
                browserExplanation("Cache",
                                   detail: "Temporary website resources. Review files here and move selected items to Trash after quitting the browser.",
                                   symbol: "externaldrive")
                Divider()
                browserExplanation("History",
                                   detail: "Recorded page visits. Open the browser’s controls, check the profile and time range, then confirm there. Refresh \(Brand.name) afterwards to recheck.",
                                   symbol: "clock.arrow.circlepath")
            }
        }
    }

    private func browserExplanation(_ title: String, detail: String, symbol: String) -> some View {
        HStack(alignment: .top, spacing: BrandSpace.sm) {
            Image(systemName: symbol)
                .font(.system(size: 18))
                .foregroundStyle(BrandColor.accent)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                Text(title).font(BrandFont.rowTitle)
                Text(detail)
                    .font(BrandFont.detail)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

private struct BrowserInstallationCard: View {
    @EnvironmentObject private var browsers: BrowserModel
    let installation: BrowserInstallation
    let requestHistory: (BrowserProfile) -> Void
    private var profiles: [BrowserProfile] { browsers.profiles.filter { $0.installationID == installation.id } }
    private var detectedCount: Int { profiles.filter { $0.historyURL != nil }.count }

    var body: some View {
        CleansePanel {
            VStack(alignment: .leading, spacing: BrandSpace.md) {
                HStack(spacing: BrandSpace.sm) {
                    Image(nsImage: NSWorkspace.shared.icon(forFile: installation.applicationURL.path))
                        .resizable()
                        .scaledToFit()
                        .frame(width: 46, height: 46)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                        Text(installation.displayName).font(BrandFont.heading)
                        Text(browsers.hasAccess
                             ? "\(detectedCount) history \(detectedCount == 1 ? "profile" : "profiles") found"
                             : "Installed · Profile access required")
                            .font(BrandFont.detail)
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                    // Running is a fact to act on, not a success: cache cleanup
                    // needs the browser quit, so it reads as neutral, not green.
                    CleanseStatusPill(title: installation.isRunning ? "Running" : "Closed",
                                      symbol: installation.isRunning ? "play.circle" : "stop.circle",
                                      tone: installation.isRunning ? .caution : .neutral)
                }
                if profiles.isEmpty {
                    Text(browsers.hasAccess
                         ? "No readable profile was found for this browser. Open it once to create a profile, or grant access to its data location."
                         : "Grant browser access above to discover history and cache for this installation.")
                        .font(BrandFont.detail)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    ForEach(profiles) { profile in
                        Divider()
                        BrowserProfileRow(profile: profile, isRunning: installation.isRunning) {
                            requestHistory(profile)
                        }
                    }
                }
            }
        }
    }
}

private struct BrowserProfileRow: View {
    @EnvironmentObject private var browsers: BrowserModel
    @EnvironmentObject private var files: CleanseModel
    let profile: BrowserProfile
    let isRunning: Bool
    let requestHistory: () -> Void
    private var cacheURLs: [URL] { browsers.cacheURLs(for: profile) }
    private var busy: Bool { files.isScanning || files.isCleaning || browsers.isRefreshing }

    var body: some View {
        VStack(alignment: .leading, spacing: BrandSpace.md) {
            VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                Label(profile.displayName, systemImage: "person.crop.circle")
                    .font(BrandFont.subheading)
                Text(profile.directoryURL.path)
                    .font(BrandFont.detail)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .truncationMode(.middle)
                    .textSelection(.enabled)
                    .help(profile.directoryURL.path)
            }

            CleanseWell {
                HStack(alignment: .top, spacing: BrandSpace.lg) {
                    VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                        Text("Browsing history")
                            .font(BrandFont.detail.weight(.medium))
                            .foregroundStyle(.secondary)
                        if let count = profile.historyCount {
                            Text("\(count.formatted()) recorded visits")
                                .font(BrandFont.subheading)
                                .monospacedDigit()
                            Text("Private browsing is excluded.")
                                .font(BrandFont.caption)
                                .foregroundStyle(.secondary)
                        } else {
                            Label(historyTitle, systemImage: historySymbol)
                                .font(BrandFont.rowTitle)
                                .foregroundStyle(historyTone.foreground)
                            Text(profile.historyStatus)
                                .font(BrandFont.caption)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                        Text("Website cache")
                            .font(BrandFont.detail.weight(.medium))
                            .foregroundStyle(.secondary)
                        Text(cacheURLs.isEmpty ? "No accessible cache" : "\(cacheURLs.count) \(cacheURLs.count == 1 ? "location" : "locations") found")
                            .font(BrandFont.subheading)
                            .monospacedDigit()
                        Text(isRunning ? "Quit the browser before cleanup." : "Review sizes before selecting files.")
                            .font(BrandFont.caption)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }

            HStack(spacing: BrandSpace.sm) {
                Button(action: requestHistory) {
                    Label("Clear in browser…", systemImage: "clock.arrow.circlepath")
                }
                .buttonStyle(CleanseSecondaryButtonStyle())
                .disabled(busy)
                if profile.historyState == .permissionRequired {
                    Button("Grant access", action: browsers.grantAccess)
                        .buttonStyle(CleanseSecondaryButtonStyle())
                        .disabled(busy)
                }
                Spacer(minLength: 0)
                Button {
                    files.reviewBrowserCache(cacheURLs)
                } label: {
                    Label("Review cache", systemImage: "magnifyingglass")
                }
                .buttonStyle(CleansePrimaryButtonStyle())
                .disabled(cacheURLs.isEmpty || busy)
            }
        }
    }

    private var historyTitle: String {
        switch profile.historyState {
        case .available: return "Ready to review"
        case .permissionRequired: return "Permission required"
        case .missing: return "No history database found"
        case .busy: return "History is in use"
        case .unsupported: return "History format unsupported"
        case .unreadable: return "History could not be read"
        }
    }

    private var historySymbol: String {
        switch profile.historyState {
        case .permissionRequired: return "lock"
        case .busy: return "clock"
        case .missing: return "minus.circle"
        case .unsupported, .unreadable: return "info.circle"
        case .available: return "checkmark.circle"
        }
    }

    /// A history count that could not be read is a state to resolve, not a
    /// failure and not a success. Only a readable database reads as positive.
    private var historyTone: BrandTone {
        switch profile.historyState {
        case .available: return .positive
        case .permissionRequired, .busy: return .caution
        case .missing, .unsupported, .unreadable: return .neutral
        }
    }
}

private struct BrowserHistoryConfirmation: View {
    @EnvironmentObject private var browsers: BrowserModel
    @Environment(\.dismiss) private var dismiss
    let profile: BrowserProfile

    var body: some View {
        VStack(alignment: .leading, spacing: BrandSpace.md) {
            Label("Review history controls", systemImage: "clock.arrow.circlepath")
                .font(BrandFont.title)
            CleanseWell {
                VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                    Text("\(profile.browser.rawValue) · \(profile.displayName)")
                        .font(BrandFont.subheading)
                    if let count = profile.historyCount {
                        Text("Last read: \(count.formatted()) recorded visits")
                            .font(BrandFont.body)
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                    Text(profile.directoryURL.path)
                        .font(BrandFont.mono)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)
                }
            }
            Text("\(Brand.name) will open the browser or its privacy controls. Check that the browser is showing this profile, then choose the time range and data categories before confirming removal there.")
                .font(BrandFont.body)
                .fixedSize(horizontal: false, vertical: true)
            CleanseCallout(text: "Clearing history may also affect synced devices. Removing cookies can sign you out. Return here and refresh afterwards; opening the controls does not clear history.",
                           tone: .caution)
            Divider()
            HStack(spacing: BrandSpace.sm) {
                Spacer()
                Button("Cancel") { dismiss() }
                    .buttonStyle(CleanseSecondaryButtonStyle())
                    .keyboardShortcut(.cancelAction)
                Button("Open browser controls") {
                    browsers.openHistoryControls(profile)
                    dismiss()
                }
                .buttonStyle(CleansePrimaryButtonStyle())
            }
        }
        .padding(BrandSpace.lg)
        .frame(width: 620)
    }
}
