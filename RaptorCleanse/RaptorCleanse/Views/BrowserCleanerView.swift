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
                if browsers.hasAccess { clearCard }
                if let report = browsers.clearReport { resultCard(report) }
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
        .sheet(isPresented: $browsers.showClearConfirmation) {
            BrowserClearConfirmation()
        }
    }

    /// One control for the whole job: pick how far back, pick what to remove,
    /// press once. Everything below it stays available for per-profile work.
    private var clearCard: some View {
        CleansePanel {
            VStack(alignment: .leading, spacing: BrandSpace.md) {
                HStack(alignment: .top, spacing: BrandSpace.md) {
                    CleanseIconTile(symbol: "sparkles", size: 48)
                    VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                        Text("Clear browsing data").font(BrandFont.heading)
                        Text("Applies to every detected browser and profile at once.")
                            .font(BrandFont.body)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }

                Picker("Time range", selection: $browsers.clearRange) {
                    ForEach(BrowserTimeRange.allCases) { range in
                        Text(range.title).tag(range)
                    }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                .disabled(browsers.isClearing)
                .accessibilityLabel("Time range to clear")

                HStack(alignment: .top, spacing: BrandSpace.lg) {
                    Toggle("Browsing history", isOn: $browsers.clearSelection.history)
                    Toggle("Cookies and sign-ins", isOn: $browsers.clearSelection.cookies)
                    Toggle("Cached files", isOn: $browsers.clearSelection.cache)
                    Spacer(minLength: 0)
                }
                .toggleStyle(.checkbox)
                .font(BrandFont.body)
                .disabled(browsers.isClearing)

                if browsers.clearSelection.cookies {
                    CleanseCallout(text: "Clearing cookies signs you out of websites.",
                                   symbol: "person.badge.key", tone: .caution)
                }
                if !browsers.runningBrowserNames.isEmpty {
                    CleanseCallout(text: "\(browsers.runningBrowserNames.joined(separator: ", ")) \(browsers.runningBrowserNames.count == 1 ? "is" : "are") open. \(Brand.name) can close \(browsers.runningBrowserNames.count == 1 ? "it" : "them") for you — you will be asked before it does.",
                                   symbol: "exclamationmark.triangle", tone: .caution)
                }

                HStack(spacing: BrandSpace.sm) {
                    if browsers.isClearing || browsers.isQuittingBrowsers {
                        ProgressView().controlSize(.small)
                        Text(browsers.statusMessage).font(BrandFont.body.weight(.medium))
                    } else {
                        Text("\(browsers.clearTargets.count) \(browsers.clearTargets.count == 1 ? "profile" : "profiles") ready")
                            .font(BrandFont.detail)
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                    Button(action: browsers.requestClear) {
                        Label("Clear now", systemImage: "trash")
                    }
                    .buttonStyle(CleansePrimaryButtonStyle())
                    .disabled(!browsers.canClear)
                    .keyboardShortcut(.defaultAction)
                }
            }
        }
    }

    private func resultCard(_ report: BrowserClearReport) -> some View {
        CleansePanel {
            VStack(alignment: .leading, spacing: BrandSpace.sm) {
                HStack(alignment: .top, spacing: BrandSpace.sm) {
                    CleanseIconTile(symbol: report.failures.isEmpty ? "checkmark.circle" : "exclamationmark.triangle",
                                    size: 40,
                                    tone: report.failures.isEmpty ? .positive : .caution)
                    VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                        Text(report.headline).font(BrandFont.subheading)
                        Text("\(report.selection.summary.capitalized) · \(report.range.title.lowercased())")
                            .font(BrandFont.detail)
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                    Button("Dismiss", action: browsers.dismissClearReport)
                        .buttonStyle(CleanseQuietButtonStyle())
                }
                ForEach(report.outcomes.filter(\.didSomething)) { outcome in
                    HStack(spacing: BrandSpace.xs) {
                        Text("\(outcome.browserName) · \(outcome.profileName)")
                            .font(BrandFont.detail.weight(.medium))
                        Spacer(minLength: 0)
                        Text(outcome.summary)
                            .font(BrandFont.detail)
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                }
                ForEach(Array(report.skipped.prefix(8).enumerated()), id: \.offset) { _, note in
                    CleanseCallout(text: note, tone: .neutral)
                }
                ForEach(Array(report.failures.prefix(8).enumerated()), id: \.offset) { _, note in
                    CleanseCallout(text: note, symbol: "exclamationmark.triangle", tone: .critical)
                }
                Text("Database copies were moved to Trash before anything was changed. Recover them from Trash if this removed more than you meant.")
                    .font(BrandFont.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
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

/// The consent step for the only irreversible thing this app does. It names the
/// exact browsers, profiles, data and time range before anything is removed.
private struct BrowserClearConfirmation: View {
    @EnvironmentObject private var browsers: BrowserModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let targets = browsers.clearTargets
        let running = browsers.runningBrowserNames
        let safari = targets.filter { $0.browser == .safari }

        return VStack(alignment: .leading, spacing: BrandSpace.md) {
            Label("Clear browsing data?", systemImage: "trash")
                .font(BrandFont.title)

            CleanseWell {
                VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                    Text(browsers.clearSelection.summary.capitalized)
                        .font(BrandFont.subheading)
                    Text("Time range: \(browsers.clearRange.title.lowercased())")
                        .font(BrandFont.body)
                        .foregroundStyle(.secondary)
                    Text("\(targets.count) \(targets.count == 1 ? "profile" : "profiles") across \(Set(targets.map(\.browserName)).count) \(Set(targets.map(\.browserName)).count == 1 ? "browser" : "browsers")")
                        .font(BrandFont.body)
                        .foregroundStyle(.secondary)
                }
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(targets) { target in
                        HStack(spacing: BrandSpace.xs) {
                            Text(target.browserName).font(BrandFont.detail.weight(.medium))
                            Text(target.profileName).font(BrandFont.detail).foregroundStyle(.secondary)
                            Spacer(minLength: 0)
                            if target.browser == .safari {
                                Text("cache only").font(BrandFont.caption).foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, BrandSpace.xxs)
                        Divider()
                    }
                }
            }
            .frame(maxHeight: 150)

            if !running.isEmpty {
                CleanseCallout(text: "\(running.joined(separator: ", ")) \(running.count == 1 ? "is" : "are") open. Closing \(running.count == 1 ? "it" : "them") first is the only way this can clear \(running.count == 1 ? "its" : "their") data — a running browser holds its databases and would rewrite whatever was removed.",
                               symbol: "exclamationmark.triangle", tone: .caution)
                CleanseCallout(text: "Each browser is asked to quit the same way ⌘Q asks, so anything with unsaved work can prompt you. Any that ignore it after eight seconds are forced to close, and unsaved work in those is lost.",
                               symbol: "bolt", tone: .caution)
            }
            if !safari.isEmpty && (browsers.clearSelection.history || browsers.clearSelection.cookies) {
                CleanseCallout(text: "macOS protects Safari's history and cookies from other apps. Safari's cache can be cleared here; for the rest, use Safari → History → Clear History.",
                               symbol: "lock", tone: .caution)
            }
            if browsers.clearSelection.cookies {
                CleanseCallout(text: "Clearing cookies signs you out of websites on this Mac.",
                               symbol: "person.badge.key", tone: .caution)
            }

            Text("History and cookies are removed from the browser's own databases and cannot be restored from the browser. A copy of each database is moved to Trash first, so you can recover it from there. Cache files go to Trash.")
                .font(BrandFont.detail)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Divider()
            HStack(spacing: BrandSpace.sm) {
                Spacer()
                Button("Cancel") { dismiss() }
                    .buttonStyle(CleanseSecondaryButtonStyle())
                    .keyboardShortcut(.cancelAction)
                if running.isEmpty {
                    Button("Clear now", action: browsers.confirmClear)
                        .buttonStyle(CleansePrimaryButtonStyle())
                        .disabled(targets.isEmpty)
                } else {
                    // Skipping open browsers stays available, but it is not the
                    // default: it is the option that does less than was asked.
                    Button("Skip open browsers", action: browsers.confirmClear)
                        .buttonStyle(CleanseSecondaryButtonStyle())
                        .disabled(targets.isEmpty)
                    Button("Close browsers and clear", action: browsers.confirmClearQuittingBrowsers)
                        .buttonStyle(CleansePrimaryButtonStyle())
                        .disabled(targets.isEmpty)
                }
            }
        }
        .padding(BrandSpace.lg)
        .frame(width: 620)
    }
}
