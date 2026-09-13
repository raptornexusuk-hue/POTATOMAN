import SwiftUI
import AppKit

struct ContentView: View {
    @EnvironmentObject private var model: CleanseModel
    @EnvironmentObject private var browsers: BrowserModel

    var body: some View {
        HStack(spacing: 0) {
            CleanseSidebar().frame(width: Brand.sidebarWidth)
            Divider()
            VStack(spacing: 0) {
                CleansePageHeader()
                if model.isScanning || model.isCleaning { CleanseProgressBanner() }
                sectionContent.frame(maxWidth: .infinity, maxHeight: .infinity)
                if isReviewSection { CleanseSelectionFooter() }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(BrandColor.canvas)
        .font(BrandFont.body)
        .tint(BrandColor.accent)
        .frame(minWidth: Brand.minimumWindowWidth, minHeight: Brand.minimumWindowHeight)
        .sheet(isPresented: $model.showCleanupConfirmation) { CleanseConfirmationSheet() }
        .alert(Brand.name, isPresented: errorPresented) {
            Button("OK", role: .cancel) { clearError() }
        } message: { Text(model.errorMessage ?? browsers.errorMessage ?? "") }
    }

    private var errorPresented: Binding<Bool> {
        Binding(get: { model.errorMessage != nil || browsers.errorMessage != nil }, set: { if !$0 { clearError() } })
    }

    private func clearError() { model.errorMessage = nil; browsers.errorMessage = nil }

    private var isReviewSection: Bool { [.cache, .files, .large, .duplicates].contains(model.section) }

    @ViewBuilder private var sectionContent: some View {
        switch model.section {
        case .overview: CleanseOverview()
        case .cache, .files, .large, .duplicates: CleanseFileReview()
        case .privacy: BrowserCleanerView()
        case .virus: VirusScanView()
        case .activity: CleanseActivityPage()
        case .settings: CleanseSettingsPage()
        }
    }
}

// MARK: - Sidebar

private struct CleanseSidebar: View {
    @EnvironmentObject private var model: CleanseModel
    private let primarySections: [CleanseSection] = [.overview, .privacy, .files, .virus]

    var body: some View {
        VStack(spacing: 0) {
            BrandLockup()
                .padding(.horizontal, BrandSpace.md)
                .padding(.top, BrandSpace.lg)
                .padding(.bottom, BrandSpace.lg)

            ScrollView {
                VStack(spacing: BrandSpace.xxs) {
                    ForEach(primarySections) { sidebarButton($0) }
                    Divider().padding(.horizontal, BrandSpace.sm).padding(.vertical, BrandSpace.sm)
                    sidebarButton(.activity)
                    sidebarButton(.settings)
                }
                .padding(.horizontal, BrandSpace.sm)
            }
            .scrollIndicators(.hidden)

            VStack(alignment: .leading, spacing: BrandSpace.xs) {
                Divider()
                Label(Brand.promise, systemImage: "checkmark.shield")
                    .font(BrandFont.detail.weight(.medium))
                    .foregroundStyle(.secondary)
                // Read from the built bundle: the version can no longer disagree
                // with the project, the settings page or an exported report.
                Text(Brand.shortVersion)
                    .font(BrandFont.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            .padding(BrandSpace.md)
        }
        .background(BrandColor.sidebar)
    }

    /// Several scan filters live behind one sidebar entry, and a browser-cache
    /// review is shown under Browser cleaner rather than Folder review.
    private func isSelected(_ section: CleanseSection) -> Bool {
        let reviewSections: [CleanseSection] = [.cache, .files, .large, .duplicates]
        if section == .privacy {
            return model.section == .privacy || (model.isBrowserCacheReview && reviewSections.contains(model.section))
        }
        if section == .files {
            return !model.isBrowserCacheReview && reviewSections.contains(model.section)
        }
        return model.section == section
    }

    private func sidebarButton(_ section: CleanseSection) -> some View {
        let selected = isSelected(section)
        return Button {
            if section == .files {
                model.showFolderReview()
            } else {
                model.section = section
                model.searchText = ""
            }
        } label: {
            HStack(spacing: BrandSpace.sm) {
                Image(systemName: section == .privacy ? "globe" : section.symbol)
                    .font(.system(size: 17, weight: selected ? .semibold : .regular))
                    .frame(width: 22)
                Text(section.pageTitle)
                    .font(BrandFont.body.weight(selected ? .semibold : .medium))
                Spacer(minLength: 0)
                if selected {
                    Capsule().fill(BrandColor.accent).frame(width: 3, height: 16)
                }
            }
            .padding(.horizontal, BrandSpace.sm)
            .padding(.vertical, BrandSpace.sm)
            .foregroundStyle(selected ? BrandColor.accent : Color.primary)
            .background(selected ? BrandColor.accentWash : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: BrandRadius.md))
            .contentShape(RoundedRectangle(cornerRadius: BrandRadius.md))
        }
        .buttonStyle(.plain)
        .disabled(section == .files && (model.isScanning || model.isCleaning))
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

// MARK: - Page chrome

private struct CleansePageHeader: View {
    @EnvironmentObject private var model: CleanseModel
    @EnvironmentObject private var browsers: BrowserModel
    private var reviewing: Bool { [.cache, .files, .large, .duplicates].contains(model.section) }

    var body: some View {
        HStack(alignment: .center, spacing: BrandSpace.md) {
            VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                Text(reviewing && model.isBrowserCacheReview ? "Browser cache review" : model.section.pageTitle)
                    .font(BrandFont.title)
                Text(subtitle)
                    .font(BrandFont.body)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: BrandSpace.xs)
            if model.section == .privacy {
                Button(action: browsers.refresh) {
                    Label(browsers.isRefreshing ? "Refreshing…" : "Refresh", systemImage: "arrow.clockwise")
                }
                .buttonStyle(CleanseSecondaryButtonStyle())
                .disabled(browsers.isRefreshing)
            } else if reviewing && model.isBrowserCacheReview {
                Button("Back to browsers") { model.section = .privacy }
                    .buttonStyle(CleanseSecondaryButtonStyle())
            } else if model.section == .overview {
                CleanseStatusPill(title: "On this Mac", symbol: "desktopcomputer")
            }
        }
        .padding(.horizontal, BrandSpace.xl)
        .padding(.vertical, BrandSpace.lg)
    }

    private var subtitle: String {
        switch model.section {
        case .overview: return Brand.tagline
        case .privacy: return "Your browsers, profiles and privacy in one place."
        case .cache: return "Review the cache locations you chose."
        case .files, .large, .duplicates:
            return model.isBrowserCacheReview ? "Review the cache locations you chose." : "One folder. A clear view of what is inside."
        case .virus: return "Check selected files for known malware."
        case .activity: return "A record of what was checked and changed."
        case .settings: return "Make \(Brand.name) work your way."
        }
    }
}

private struct CleanseProgressBanner: View {
    @EnvironmentObject private var model: CleanseModel

    var body: some View {
        HStack(spacing: BrandSpace.sm) {
            ProgressView().controlSize(.small)
            VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                Text(model.isCleaning ? "Moving selected files to Trash…" : model.progress.message)
                    .font(BrandFont.bodyStrong)
                    .lineLimit(2)
                if model.isScanning {
                    Text("\(model.progress.visitedCount.formatted()) items checked · \(model.progress.foundCount.formatted()) files found")
                        .font(BrandFont.detail)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
            }
            Spacer()
            if model.isScanning {
                Button("Cancel", action: model.cancelScan).buttonStyle(CleanseSecondaryButtonStyle())
            }
        }
        .padding(BrandSpace.sm)
        .background(BrandColor.accentWash)
        .clipShape(RoundedRectangle(cornerRadius: BrandRadius.md))
        .padding(.horizontal, BrandSpace.xl)
        .padding(.bottom, BrandSpace.md)
        .accessibilityElement(children: .contain)
    }
}

// MARK: - Overview

private struct CleanseOverview: View {
    @EnvironmentObject private var model: CleanseModel
    @EnvironmentObject private var browsers: BrowserModel
    private var busy: Bool { model.isScanning || model.isCleaning }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: BrandSpace.lg) {
                CleanseStorageCard()

                Text("What would you like to tidy?").font(BrandFont.heading)

                // Three equal tasks. Virus scan used to be a narrow strip below
                // the other two, which read as an afterthought rather than one of
                // the three things this app does. The grid reflows on narrow
                // windows instead of squeezing three cards into the minimum width.
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 240), spacing: BrandSpace.md, alignment: .top)],
                          spacing: BrandSpace.md) {
                    CleanseTaskCard(symbol: "globe",
                                    title: "Browser cleaner",
                                    detail: browserSummary,
                                    actionTitle: "Review browsers") {
                        model.section = .privacy
                        model.searchText = ""
                    }
                    CleanseTaskCard(symbol: "folder",
                                    title: "Folder review",
                                    detail: "Find large files and duplicates in exactly the folder you choose.",
                                    actionTitle: "Choose a folder") {
                        model.chooseFolder()
                    }
                    .disabled(busy)
                    CleanseTaskCard(symbol: "shield.lefthalf.filled",
                                    title: "Virus scan",
                                    detail: "Check a chosen folder with a locally installed ClamAV engine. Nothing is removed for you.",
                                    actionTitle: "Open virus scan") {
                        model.section = .virus
                    }
                }

                if let date = model.lastScan { latestReview(date) }

                CleanseCallout(text: "Scan and review first. You choose every file that moves to Trash.",
                               symbol: "checkmark.shield",
                               tone: .positive)

                if !model.warnings.isEmpty { CleanseWarningsPanel() }
            }
            .padding(.horizontal, BrandSpace.xl)
            .padding(.bottom, BrandSpace.xl)
        }
    }

    private func latestReview(_ date: Date) -> some View {
        CleansePanel {
            VStack(alignment: .leading, spacing: BrandSpace.sm) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Latest review").font(BrandFont.heading)
                    Spacer()
                    Text(date, format: .dateTime.day().month(.abbreviated).hour().minute())
                        .font(BrandFont.detail)
                        .foregroundStyle(.secondary)
                }
                Text(model.lastScanScope)
                    .font(BrandFont.detail)
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(alignment: .bottom, spacing: BrandSpace.md) {
                    CleanseMetric(label: "Listed",
                                  value: "\(model.files.count.formatted()) files · \(formattedBytes(model.totalReviewBytes))",
                                  detail: "Listed file sizes are separate from volume usage.")
                    Button("Continue review") { model.section = model.isBrowserCacheReview ? .cache : .files }
                        .buttonStyle(CleanseSecondaryButtonStyle())
                }
            }
        }
    }

    private var browserSummary: String {
        if browsers.installations.isEmpty {
            return "Detect browsers automatically, review cache and manage browsing history."
        }
        let count = browsers.installations.count
        return "\(count) \(count == 1 ? "browser" : "browsers") detected. Review cache and manage history for each profile."
    }
}

private struct CleanseStorageCard: View {
    @EnvironmentObject private var model: CleanseModel

    var body: some View {
        CleansePanel {
            VStack(alignment: .leading, spacing: BrandSpace.md) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: BrandSpace.xs) {
                        Label("Home volume", systemImage: "internaldrive")
                            .font(BrandFont.detail.weight(.medium))
                            .foregroundStyle(.secondary)
                        if model.storage.total > 0 {
                            HStack(alignment: .firstTextBaseline, spacing: BrandSpace.xs) {
                                Text(formattedBytes(model.storage.available))
                                    .font(BrandFont.display)
                                    .monospacedDigit()
                                Text("available").font(BrandFont.subheading).foregroundStyle(.secondary)
                            }
                        } else {
                            Text("Storage information unavailable").font(BrandFont.heading)
                        }
                    }
                    Spacer()
                    CleanseIconTile(symbol: "internaldrive", size: 58)
                }
                if model.storage.total > 0 {
                    CleanseStorageMeter(
                        usedFraction: usedFraction,
                        accessibilityText: "Home volume: \(formattedBytes(model.storage.used)) used, \(formattedBytes(model.storage.available)) available"
                    )
                    HStack {
                        Text("\(formattedBytes(model.storage.used)) used").foregroundStyle(.secondary)
                        Spacer()
                        Text("\(formattedBytes(model.storage.total)) total").foregroundStyle(.secondary)
                    }
                    .font(BrandFont.detail)
                    .monospacedDigit()
                }
                Text("Volume information only. Choose a task below to start a scan.")
                    .font(BrandFont.detail)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var usedFraction: CGFloat {
        guard model.storage.total > 0 else { return 0 }
        return CGFloat(min(1, max(0, Double(model.storage.used) / Double(model.storage.total))))
    }
}

// MARK: - Folder and cache review

private struct CleanseScopePanel: View {
    @EnvironmentObject private var model: CleanseModel
    private var busy: Bool { model.isScanning || model.isCleaning }

    var body: some View {
        CleanseWell {
            VStack(alignment: .leading, spacing: BrandSpace.sm) {
                HStack(alignment: .top, spacing: BrandSpace.sm) {
                    Image(systemName: model.isBrowserCacheReview ? "globe" : "folder")
                        .font(.system(size: 19))
                        .foregroundStyle(BrandColor.accent)
                        .padding(.top, 2)
                    VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                        Text(model.isBrowserCacheReview ? "Selected browser cache locations" : "Selected folder")
                            .font(BrandFont.rowTitle)
                        Text(model.roots.isEmpty ? "Choose the folder you want to review." : model.activeScopeDescription)
                            .font(BrandFont.detail)
                            .foregroundStyle(.secondary)
                            .lineLimit(3)
                            .truncationMode(.middle)
                            .textSelection(.enabled)
                            .help(model.activeScopeDescription)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                HStack(spacing: BrandSpace.sm) {
                    if !model.isBrowserCacheReview {
                        Button(model.roots.isEmpty ? "Choose folder" : "Change folder", action: model.chooseFolder)
                            .buttonStyle(CleanseSecondaryButtonStyle())
                            .disabled(busy)
                        Toggle("Include subfolders", isOn: $model.includeSubfolders)
                            .toggleStyle(.checkbox)
                            .font(BrandFont.body)
                            .disabled(busy || model.roots.isEmpty)
                    } else {
                        Text("Includes files inside these cache locations.")
                            .font(BrandFont.detail)
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                    // No keyboard shortcut here: Command-R is the Scan menu
                    // command, and declaring it twice made the pair ambiguous.
                    Button(action: model.scan) {
                        Label(model.isBrowserCacheReview ? "Scan cache" : "Scan this folder", systemImage: "magnifyingglass")
                    }
                    .buttonStyle(CleansePrimaryButtonStyle())
                    .disabled(!model.canScan)
                }
            }
        }
    }
}

private struct CleanseFileReview: View {
    @EnvironmentObject private var model: CleanseModel
    private var busy: Bool { model.isScanning || model.isCleaning }

    var body: some View {
        // Resolved once per redraw. Reading `model.visibleFiles` repeatedly
        // re-filtered and re-sorted the whole result set each time.
        let visible = model.visibleFiles
        let listedBytes = visible.reduce(Int64(0)) { $0 + $1.byteCount }

        return VStack(alignment: .leading, spacing: BrandSpace.sm) {
            CleanseScopePanel()
            if !model.isBrowserCacheReview { reviewTabs }
            toolbar(hasVisibleFiles: !visible.isEmpty)
            HStack {
                Text("\(visible.count.formatted()) files shown · \(formattedBytes(listedBytes)) listed")
                    .font(BrandFont.detail)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
                Spacer()
                if !model.warnings.isEmpty {
                    Button("Scan notes (\(model.warnings.count))") { model.section = .activity }
                        .buttonStyle(CleanseQuietButtonStyle())
                }
            }
            if visible.isEmpty {
                ScrollView {
                    CleanseEmptyState(symbol: model.searchText.isEmpty ? "folder" : "magnifyingglass",
                                      title: emptyTitle, detail: emptyDetail)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                fileList(visible)
            }
            if model.isBrowserCacheReview {
                Text("Cache is separate from history. Quit this browser before moving cache to Trash. Recent cache files are skipped.")
                    .font(BrandFont.detail)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !model.statusMessage.isEmpty && !model.isScanning {
                Text(model.statusMessage)
                    .font(BrandFont.detail.weight(.medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .textSelection(.enabled)
            }
        }
        .padding(.horizontal, BrandSpace.xl)
        .padding(.bottom, BrandSpace.md)
    }

    private func fileList(_ visible: [ScannedFile]) -> some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if model.section == .duplicates {
                    ForEach(Array(duplicateGroups(visible).enumerated()), id: \.offset) { index, group in
                        HStack {
                            Text("Matching group \(index + 1)").font(BrandFont.rowTitle)
                            Spacer()
                            Text("Keep one copy").font(BrandFont.detail).foregroundStyle(.secondary)
                        }
                        .padding(BrandSpace.sm)
                        .background(BrandColor.accentWash)
                        ForEach(group) { file in fileRow(file) }
                    }
                } else {
                    ForEach(visible) { file in fileRow(file) }
                }
            }
        }
        .background(BrandColor.panel)
        .clipShape(RoundedRectangle(cornerRadius: BrandRadius.lg))
        .overlay {
            RoundedRectangle(cornerRadius: BrandRadius.lg).stroke(BrandColor.line, lineWidth: 1)
        }
    }

    private var reviewTabs: some View {
        HStack(spacing: BrandSpace.xxs) {
            // Counts come from the model's cached totals rather than filtering
            // every scanned file three times on each redraw.
            filterTab(.files, title: "All files", count: model.files.count)
            filterTab(.large, title: "Large files", count: model.largeFileCount)
            filterTab(.duplicates, title: "Duplicates", count: model.duplicateFileCount)
            Spacer(minLength: 0)
        }
    }

    private func filterTab(_ section: CleanseSection, title: String, count: Int) -> some View {
        let selected = model.section == section
        return Button { model.section = section } label: {
            HStack(spacing: BrandSpace.xs) {
                Text(title)
                Text(count.formatted())
                    .monospacedDigit()
                    .padding(.horizontal, BrandSpace.xs)
                    .padding(.vertical, 1)
                    .background(selected ? BrandColor.accent.opacity(0.18) : BrandColor.neutralWash)
                    .clipShape(Capsule())
            }
            .font(BrandFont.body.weight(selected ? .semibold : .medium))
            .foregroundStyle(selected ? BrandColor.accent : Color.secondary)
            .padding(.horizontal, BrandSpace.sm)
            .padding(.vertical, BrandSpace.xs)
            .background(selected ? BrandColor.accentWash : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: BrandRadius.sm))
            .contentShape(RoundedRectangle(cornerRadius: BrandRadius.sm))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func toolbar(hasVisibleFiles: Bool) -> some View {
        HStack(spacing: BrandSpace.sm) {
            HStack(spacing: BrandSpace.xs) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("Search filenames or paths", text: $model.searchText)
                    .textFieldStyle(.plain)
                    .font(BrandFont.body)
                    .accessibilityLabel("Search review files")
                if !model.searchText.isEmpty {
                    Button { model.searchText = "" } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear search")
                }
            }
            .padding(BrandSpace.sm)
            .background(BrandColor.panel)
            .clipShape(RoundedRectangle(cornerRadius: BrandRadius.md))
            .overlay {
                RoundedRectangle(cornerRadius: BrandRadius.md).stroke(BrandColor.line, lineWidth: 1)
            }

            // Review order is a choice now. It was fixed at largest-first, which
            // made "what arrived most recently?" impossible to answer here.
            Picker("Sort by", selection: $model.sortOrder) {
                ForEach(CleanseSortOrder.allCases) { order in
                    Text(order.title).tag(order)
                }
            }
            .labelsHidden()
            .font(BrandFont.body)
            .frame(width: 165)
            .accessibilityLabel("Sort review files")

            Button("Select visible", action: model.selectVisible)
                .buttonStyle(CleanseSecondaryButtonStyle())
                .disabled(!hasVisibleFiles || busy)
        }
    }

    private func duplicateGroups(_ visible: [ScannedFile]) -> [[ScannedFile]] {
        // `visible` already arrives grouped and ordered, so collect runs in place
        // rather than re-sorting a dictionary and losing the chosen order.
        var groups: [[ScannedFile]] = []
        var currentKey: String?
        for file in visible {
            let key = file.duplicateGroup ?? file.id
            if key == currentKey, !groups.isEmpty {
                groups[groups.count - 1].append(file)
            } else {
                groups.append([file])
                currentKey = key
            }
        }
        return groups
    }

    private func fileRow(_ file: ScannedFile) -> some View {
        VStack(spacing: 0) {
            CleanseFileRow(file: file,
                           isSelected: model.selectedIDs.contains(file.id),
                           isBusy: busy,
                           toggle: { model.toggleSelection(file) },
                           reveal: { model.reveal(file) })
            Divider()
        }
    }

    private var emptyTitle: String {
        if !model.searchText.isEmpty { return "No matching files" }
        if model.isScanning { return "Checking the selected location" }
        if model.roots.isEmpty { return "Choose a folder to begin" }
        if model.lastScan == nil { return "Ready when you are" }
        if model.section == .duplicates && !model.detectDuplicates { return "Duplicate review is switched off" }
        return "No files in this view"
    }

    private var emptyDetail: String {
        if !model.searchText.isEmpty { return "Try another filename or part of a path." }
        if model.isScanning { return "Results will appear here when this scan finishes." }
        if model.roots.isEmpty { return "Choose a local folder above. Enable Include subfolders only if you want to inspect its child folders too." }
        if model.lastScan == nil { return "Check the exact location above, then choose Scan this folder." }
        if model.section == .duplicates && !model.detectDuplicates { return "Enable Find duplicate files in Settings, then scan this folder again." }
        if model.isBrowserCacheReview { return "No eligible cache files were found in these locations. Recent cache files are skipped. Check Scan notes for access issues." }
        return "There are no results for this filter. Choose All files to see the rest of your selected folder."
    }
}

private struct CleanseSelectionFooter: View {
    @EnvironmentObject private var model: CleanseModel

    var body: some View {
        let selected = model.selectedFiles
        let selectedBytes = selected.reduce(Int64(0)) { $0 + $1.byteCount }
        return VStack(spacing: 0) {
            Divider()
            HStack(spacing: BrandSpace.sm) {
                VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                    Text("\(selected.count.formatted()) selected · \(formattedBytes(selectedBytes))")
                        .font(BrandFont.subheading)
                        .monospacedDigit()
                    Text("Review in Trash before emptying it to free space.")
                        .font(BrandFont.detail)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: BrandSpace.xxs)
                Button("Deselect", action: model.clearSelection)
                    .buttonStyle(CleanseQuietButtonStyle())
                    .disabled(model.selectedIDs.isEmpty || model.isCleaning)
                Button(action: model.requestCleanup) { Label("Move to Trash", systemImage: "trash") }
                    .buttonStyle(CleansePrimaryButtonStyle())
                    .disabled(selected.isEmpty || model.isScanning || model.isCleaning)
            }
            .padding(.horizontal, BrandSpace.xl)
            .padding(.vertical, BrandSpace.md)
            .background(BrandColor.panel)
        }
    }
}

private struct CleanseConfirmationSheet: View {
    @EnvironmentObject private var model: CleanseModel

    var body: some View {
        let selected = model.selectedFiles
        VStack(alignment: .leading, spacing: BrandSpace.md) {
            ScrollView {
                VStack(alignment: .leading, spacing: BrandSpace.md) {
                    Label("Move selected files to Trash?", systemImage: "trash")
                        .font(BrandFont.title)
                    Text("\(selected.count.formatted()) files · \(formattedBytes(model.selectedBytes)) selected")
                        .font(BrandFont.subheading)
                        .monospacedDigit()
                    Text("All selected files, including selections from other filters:")
                        .font(BrandFont.detail)
                        .foregroundStyle(.secondary)
                    selectedFileList(selected)
                    Text("Review these files in the Mac’s Trash before emptying it manually. Moving files to Trash does not immediately free storage.")
                        .font(BrandFont.body)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    if selected.contains(where: { $0.browser != nil }) {
                        CleanseCallout(text: "Quit the relevant browsers before continuing.",
                                       symbol: "globe", tone: .caution)
                    }
                    Text("Files are checked again before moving. Changed files and protected locations are skipped; duplicate groups keep at least one copy.")
                        .font(BrandFont.detail)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            Divider()
            HStack {
                Spacer()
                Button("Cancel") { model.showCleanupConfirmation = false }
                    .buttonStyle(CleanseSecondaryButtonStyle())
                    .keyboardShortcut(.cancelAction)
                Button("Move to Trash", action: model.confirmCleanup)
                    .buttonStyle(CleansePrimaryButtonStyle())
                    .disabled(selected.isEmpty || model.isCleaning)
            }
        }
        .padding(BrandSpace.lg)
        .frame(width: 650, height: min(670, max(440, (NSScreen.main?.visibleFrame.height ?? 800) - 110)))
    }

    private func selectedFileList(_ selected: [ScannedFile]) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(selected) { file in
                    VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                        Text(file.name).font(BrandFont.rowTitle)
                        Text(file.url.path).font(BrandFont.detail).foregroundStyle(.secondary)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
                    .padding(BrandSpace.sm)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Divider()
                }
            }
        }
        .frame(height: min(200, CGFloat(selected.count) * 88))
        .background(BrandColor.panel)
        .clipShape(RoundedRectangle(cornerRadius: BrandRadius.md))
        .overlay {
            RoundedRectangle(cornerRadius: BrandRadius.md).stroke(BrandColor.line, lineWidth: 1)
        }
    }
}

// MARK: - Activity and settings

private struct CleanseActivityPage: View {
    @EnvironmentObject private var model: CleanseModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: BrandSpace.md) {
                HStack {
                    Text("Current app session").font(BrandFont.detail).foregroundStyle(.secondary)
                    Spacer()
                    Button(action: model.exportDiagnostics) {
                        Label("Export diagnostics", systemImage: "square.and.arrow.up")
                    }
                    .buttonStyle(CleanseSecondaryButtonStyle())
                }
                if !model.warnings.isEmpty { CleanseWarningsPanel() }
                if model.activity.isEmpty {
                    CleanseEmptyState(symbol: "clock",
                                      title: "A clear record of each review",
                                      detail: "Run a scan to see what was checked. Cleanup records show files moved to Trash and anything skipped.")
                } else {
                    ForEach(model.activity) { entry in
                        CleansePanel {
                            VStack(alignment: .leading, spacing: BrandSpace.xs) {
                                HStack(alignment: .firstTextBaseline) {
                                    Text(entry.title).font(BrandFont.subheading)
                                    Spacer()
                                    Text(entry.date, format: .dateTime.day().month(.abbreviated).hour().minute())
                                        .font(BrandFont.detail)
                                        .foregroundStyle(.secondary)
                                }
                                Text(entry.detail)
                                    .font(BrandFont.body)
                                    .foregroundStyle(.secondary)
                                    .textSelection(.enabled)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, BrandSpace.xl)
            .padding(.bottom, BrandSpace.xl)
        }
    }
}

private struct CleanseWarningsPanel: View {
    @EnvironmentObject private var model: CleanseModel

    var body: some View {
        CleansePanel {
            DisclosureGroup {
                VStack(alignment: .leading, spacing: BrandSpace.sm) {
                    ForEach(Array(model.warnings.enumerated()), id: \.offset) { _, warning in
                        Text(warning)
                            .font(BrandFont.detail)
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(.top, BrandSpace.sm)
            } label: {
                Label("\(model.warnings.count.formatted()) scan \(model.warnings.count == 1 ? "note" : "notes")",
                      systemImage: "info.circle")
                    .font(BrandFont.subheading)
            }
        }
    }
}

private struct CleanseSettingsPage: View {
    @EnvironmentObject private var model: CleanseModel
    @EnvironmentObject private var browsers: BrowserModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: BrandSpace.lg) {
                CleansePanel {
                    VStack(alignment: .leading, spacing: BrandSpace.md) {
                        CleanseSectionHeading(title: "Folder review", detail: "Changes apply to your next scan.")
                        Toggle(isOn: $model.detectDuplicates) {
                            VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                                Text("Find duplicate files").font(BrandFont.rowTitle)
                                Text("Compare file content. Large files can make scanning take longer.")
                                    .font(BrandFont.detail)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .toggleStyle(.switch)
                        Divider()
                        HStack {
                            VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                                Text("Large file threshold").font(BrandFont.rowTitle)
                                Text("Minimum size in the Large files filter.")
                                    .font(BrandFont.detail)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Picker("Large file threshold", selection: $model.largeFileMegabytes) {
                                Text("50 MB").tag(50)
                                Text("100 MB").tag(100)
                                Text("250 MB").tag(250)
                                Text("500 MB").tag(500)
                            }
                            .labelsHidden()
                            .font(BrandFont.body)
                            .frame(width: 135)
                            .controlSize(.large)
                        }
                    }
                    .disabled(model.isScanning || model.isCleaning)
                }

                CleansePanel {
                    VStack(alignment: .leading, spacing: BrandSpace.md) {
                        CleanseSectionHeading(title: "Browser access",
                                              detail: "Browser discovery is separate from your selected folder. History summaries stay on this Mac.")
                        HStack(spacing: BrandSpace.sm) {
                            CleanseStatusPill(title: browsers.hasAccess ? "Access granted" : "Access required",
                                              symbol: browsers.hasAccess ? "checkmark.circle" : "lock",
                                              tone: browsers.hasAccess ? .positive : .neutral)
                            Spacer()
                            if browsers.hasAccess {
                                Button("Forget access") {
                                    model.clearBrowserCacheScope()
                                    browsers.revokeAccess()
                                }
                                .buttonStyle(CleanseSecondaryButtonStyle())
                            } else {
                                Button("Grant browser access", action: browsers.grantAccess)
                                    .buttonStyle(CleanseSecondaryButtonStyle())
                            }
                        }
                        .disabled(browsers.isRefreshing || model.isScanning || model.isCleaning)
                    }
                }

                CleansePanel {
                    VStack(alignment: .leading, spacing: BrandSpace.md) {
                        CleanseSectionHeading(title: "Test and troubleshoot",
                                              detail: "Try a review using disposable sample files, or export diagnostics.")
                        HStack(spacing: BrandSpace.sm) {
                            Button("Create test folder", action: model.createTestFolder)
                                .buttonStyle(CleanseSecondaryButtonStyle())
                                .disabled(model.isScanning || model.isCleaning)
                            Button("Export diagnostics", action: model.exportDiagnostics)
                                .buttonStyle(CleanseSecondaryButtonStyle())
                        }
                        Text("Diagnostic exports omit filenames and paths. Detailed scan notes remain available in Activity.")
                            .font(BrandFont.detail)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                aboutPanel
            }
            .padding(.horizontal, BrandSpace.xl)
            .padding(.bottom, BrandSpace.xl)
        }
    }

    /// The one place in the UI that states the full build, taken from the bundle.
    private var aboutPanel: some View {
        CleansePanel {
            HStack(alignment: .top, spacing: BrandSpace.md) {
                Image("BrandIcon")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 54, height: 54)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                    Text(Brand.name).font(BrandFont.subheading)
                    Text("\(Brand.shortVersion) · Build \(Brand.build)")
                        .font(BrandFont.mono)
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                    Text("Local file review, browser privacy and on-demand malware checks for macOS. \(Brand.tagline)")
                        .font(BrandFont.detail)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("\(Brand.vendor) · Virus scanning uses a separately installed ClamAV engine, which is not bundled with this app.")
                        .font(BrandFont.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, BrandSpace.xxs)
                }
                Spacer(minLength: 0)
            }
        }
    }
}
