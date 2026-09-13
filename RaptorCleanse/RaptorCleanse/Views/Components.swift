import SwiftUI
import AppKit

extension CleanseSection {
    /// The name shown in the sidebar and page header. Several scan filters share
    /// one destination, so the raw case name is not always the right label.
    var pageTitle: String {
        switch self {
        case .privacy: return "Browser cleaner"
        case .files, .large, .duplicates: return "Folder review"
        default: return rawValue
        }
    }
}

// MARK: - Buttons

/// Filled emerald. One per view at most: the action the page exists for.
///
/// Button styles resolve `isEnabled` and hover state inside a nested view, because
/// reading the environment on the style value itself does not reliably update.
///
/// That nested view must not be called `Body`: `ButtonStyle` declares
/// `associatedtype Body`, so a nested type with that name becomes the witness for
/// it, and a `private` witness cannot satisfy an internal conformance. The result
/// is "does not conform to protocol 'ButtonStyle'" pointing at the style itself.
struct CleansePrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View { StyledLabel(configuration: configuration) }

    private struct StyledLabel: View {
        let configuration: ButtonStyleConfiguration
        @Environment(\.isEnabled) private var isEnabled
        @State private var isHovering = false

        var body: some View {
            configuration.label
                .font(BrandFont.bodyStrong)
                .foregroundStyle(.white)
                .padding(.horizontal, BrandSpace.md)
                .padding(.vertical, BrandSpace.sm)
                .background(fill)
                .clipShape(RoundedRectangle(cornerRadius: BrandRadius.md))
                .contentShape(RoundedRectangle(cornerRadius: BrandRadius.md))
                .opacity(isEnabled ? 1 : 0.45)
                .onHover { isHovering = $0 }
        }

        private var fill: Color {
            guard isEnabled else { return BrandColor.accentFill }
            if configuration.isPressed { return BrandColor.accentFillPressed }
            return isHovering ? BrandColor.accentFillPressed.opacity(0.9) : BrandColor.accentFill
        }
    }
}

/// Bordered. Everything that is a real action but not the page's main one.
struct CleanseSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View { StyledLabel(configuration: configuration) }

    private struct StyledLabel: View {
        let configuration: ButtonStyleConfiguration
        @Environment(\.isEnabled) private var isEnabled
        @State private var isHovering = false

        var body: some View {
            configuration.label
                .font(BrandFont.body.weight(.medium))
                .foregroundStyle(isEnabled ? Color.primary : Color.secondary)
                .padding(.horizontal, BrandSpace.sm)
                .padding(.vertical, BrandSpace.sm)
                .background(configuration.isPressed || isHovering ? BrandColor.accentWash : BrandColor.panel)
                .clipShape(RoundedRectangle(cornerRadius: BrandRadius.md))
                .overlay {
                    RoundedRectangle(cornerRadius: BrandRadius.md)
                        .stroke(isHovering && isEnabled ? BrandColor.accent.opacity(0.55) : BrandColor.line, lineWidth: 1)
                }
                .contentShape(RoundedRectangle(cornerRadius: BrandRadius.md))
                .opacity(isEnabled ? 1 : 0.55)
                .onHover { isHovering = $0 }
        }
    }
}

/// Text only, for reversible in-place actions such as clearing a selection.
struct CleanseQuietButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View { StyledLabel(configuration: configuration) }

    private struct StyledLabel: View {
        let configuration: ButtonStyleConfiguration
        @Environment(\.isEnabled) private var isEnabled
        @State private var isHovering = false

        var body: some View {
            configuration.label
                .font(BrandFont.body.weight(.medium))
                .foregroundStyle(isEnabled ? BrandColor.accent : Color.secondary)
                .padding(.horizontal, BrandSpace.xs)
                .padding(.vertical, BrandSpace.xxs)
                .background(isHovering && isEnabled ? BrandColor.accentWash : .clear)
                .clipShape(RoundedRectangle(cornerRadius: BrandRadius.sm))
                .contentShape(RoundedRectangle(cornerRadius: BrandRadius.sm))
                .opacity(configuration.isPressed ? 0.7 : 1)
                .onHover { isHovering = $0 }
        }
    }
}

// MARK: - Containers

/// The app's card. Every page is a stack of these.
struct CleansePanel<Content: View>: View {
    var padding: CGFloat = BrandSpace.lg
    private let content: Content

    init(padding: CGFloat = BrandSpace.lg, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(BrandColor.panel)
            .clipShape(RoundedRectangle(cornerRadius: BrandRadius.xl))
            .overlay {
                RoundedRectangle(cornerRadius: BrandRadius.xl).stroke(BrandColor.line, lineWidth: 1)
            }
    }
}

/// A recessed area inside a panel, for figures a card is reporting rather than acting on.
struct CleanseWell<Content: View>: View {
    private let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        content
            .padding(BrandSpace.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(BrandColor.well)
            .clipShape(RoundedRectangle(cornerRadius: BrandRadius.lg))
            .overlay {
                RoundedRectangle(cornerRadius: BrandRadius.lg).stroke(BrandColor.line, lineWidth: 1)
            }
    }
}

/// The emerald tile that carries a section's symbol.
struct CleanseIconTile: View {
    let symbol: String
    var size: CGFloat = 52
    var tone: BrandTone = .positive

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.46, weight: .medium))
            .foregroundStyle(tone.foreground)
            .frame(width: size, height: size)
            .background(tone.wash)
            .clipShape(RoundedRectangle(cornerRadius: BrandRadius.lg))
            .accessibilityHidden(true)
    }
}

// MARK: - Text

struct CleanseSectionHeading: View {
    let title: String
    var detail: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: BrandSpace.xxs) {
            Text(title).font(BrandFont.heading)
            if let detail {
                Text(detail)
                    .font(BrandFont.body)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A numbered heading, for pages that are a sequence rather than a list.
struct CleanseStepHeading: View {
    let number: Int
    let title: String
    var detail: String? = nil

    var body: some View {
        HStack(alignment: .top, spacing: BrandSpace.sm) {
            Text("\(number)")
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundStyle(BrandColor.accent)
                .frame(width: 26, height: 26)
                .background(BrandColor.accentWash)
                .clipShape(Circle())
                .accessibilityHidden(true)
            CleanseSectionHeading(title: title, detail: detail)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Step \(number). \(title)")
    }
}

/// A short state label. Tone chooses the colour, so no view picks one itself.
struct CleanseStatusPill: View {
    let title: String
    var symbol = "checkmark.circle"
    var tone: BrandTone = .positive

    var body: some View {
        Label(title, systemImage: symbol)
            .font(BrandFont.body.weight(.medium))
            .foregroundStyle(tone.foreground)
            .padding(.horizontal, BrandSpace.sm)
            .padding(.vertical, BrandSpace.xs)
            .background(tone.wash)
            .clipShape(Capsule())
            .fixedSize()
    }
}

/// An inline note the reader must not miss, tinted by how serious it is.
struct CleanseCallout: View {
    let text: String
    var symbol = "info.circle"
    var tone: BrandTone = .neutral

    var body: some View {
        HStack(alignment: .top, spacing: BrandSpace.sm) {
            Image(systemName: symbol)
                .font(BrandFont.body)
                .foregroundStyle(tone.foreground)
            Text(text)
                .font(BrandFont.body)
                .foregroundStyle(tone == .neutral ? .secondary : tone.foreground)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(BrandSpace.sm)
        .background(tone == .neutral ? Color.clear : tone.wash)
        .clipShape(RoundedRectangle(cornerRadius: BrandRadius.md))
    }
}

/// A labelled figure. Keeps every number in the app on the same baseline.
struct CleanseMetric: View {
    let label: String
    let value: String
    var detail: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: BrandSpace.xxs) {
            Text(label)
                .font(BrandFont.detail)
                .foregroundStyle(.secondary)
            Text(value)
                .font(BrandFont.subheading)
                .monospacedDigit()
            if let detail {
                Text(detail)
                    .font(BrandFont.detail)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Cards and rows

/// A whole-card button for the three things the app can do.
struct CleanseTaskCard: View {
    let symbol: String
    let title: String
    let detail: String
    let actionTitle: String
    let action: () -> Void
    @Environment(\.isEnabled) private var isEnabled
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: BrandSpace.md) {
                CleanseIconTile(symbol: symbol)
                Text(title)
                    .font(BrandFont.heading)
                    .foregroundStyle(.primary)
                Text(detail)
                    .font(BrandFont.body)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, minHeight: 66, alignment: .topLeading)
                HStack(spacing: BrandSpace.xs) {
                    Text(actionTitle).font(BrandFont.bodyStrong)
                    Image(systemName: "arrow.right")
                        .font(BrandFont.bodyStrong)
                        .offset(x: isHovering && isEnabled ? 3 : 0)
                }
                .foregroundStyle(BrandColor.accent)
            }
            .padding(BrandSpace.lg)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(BrandColor.panel)
            .clipShape(RoundedRectangle(cornerRadius: BrandRadius.xl))
            .overlay {
                RoundedRectangle(cornerRadius: BrandRadius.xl)
                    .stroke(isHovering && isEnabled ? BrandColor.accent.opacity(0.6) : BrandColor.line, lineWidth: 1)
            }
            .contentShape(RoundedRectangle(cornerRadius: BrandRadius.xl))
        }
        .buttonStyle(.plain)
        .opacity(isEnabled ? 1 : 0.55)
        .onHover { isHovering = $0 }
        .animation(.easeOut(duration: 0.12), value: isHovering)
    }
}

/// One reviewable file. The path is never truncated away from the middle,
/// because the part that identifies a file is usually at both ends.
struct CleanseFileRow: View {
    let file: ScannedFile
    let isSelected: Bool
    let isBusy: Bool
    let toggle: () -> Void
    let reveal: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: BrandSpace.sm) {
            Button(action: toggle) {
                Image(systemName: isSelected ? "checkmark.square.fill" : "square")
                    .font(.system(size: 22))
                    .foregroundStyle(isSelected ? BrandColor.accent : Color.secondary)
                    .frame(width: 28, height: 40)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(isBusy)
            .accessibilityLabel("\(isSelected ? "Deselect" : "Select") \(file.name)")
            .accessibilityValue(isSelected ? "Selected" : "Not selected")

            VStack(alignment: .leading, spacing: BrandSpace.xxs) {
                Text(file.name)
                    .font(BrandFont.rowTitle)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
                Text(file.url.deletingLastPathComponent().path)
                    .font(BrandFont.detail)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                if let browser = file.browser {
                    Label(browser.rawValue, systemImage: "globe")
                        .font(BrandFont.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .help(file.url.path)

            VStack(alignment: .trailing, spacing: BrandSpace.xxs) {
                Text(formattedBytes(file.byteCount))
                    .font(BrandFont.rowTitle)
                    .monospacedDigit()
                Text(file.modifiedAt, format: .dateTime.day().month(.abbreviated).year())
                    .font(BrandFont.detail)
                    .foregroundStyle(.secondary)
            }
            .frame(width: 118, alignment: .trailing)

            Button(action: reveal) {
                Image(systemName: "folder")
                    .font(.system(size: 17))
                    .frame(width: 34, height: 40)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
            .help("Show in Finder")
            .accessibilityLabel("Show \(file.name) in Finder")
        }
        .padding(.horizontal, BrandSpace.md)
        .padding(.vertical, BrandSpace.sm)
        .background(isSelected ? BrandColor.accentWash : BrandColor.panel)
    }
}

struct CleanseEmptyState: View {
    let symbol: String
    let title: String
    let detail: String

    var body: some View {
        VStack(spacing: BrandSpace.sm) {
            CleanseIconTile(symbol: symbol, size: 70)
            Text(title).font(BrandFont.heading)
            Text(detail)
                .font(BrandFont.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 480)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, BrandSpace.lg)
        .padding(.vertical, BrandSpace.xxl)
        .frame(maxWidth: .infinity)
    }
}

/// The storage bar. Used space is quiet; free space carries the accent, because
/// free space is the thing the app is trying to give back.
struct CleanseStorageMeter: View {
    let usedFraction: CGFloat
    let accessibilityText: String

    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 2) {
                Rectangle()
                    .fill(BrandColor.silver.opacity(0.45))
                    .frame(width: max(0, (geometry.size.width - 2) * min(1, max(0, usedFraction))))
                Rectangle().fill(BrandColor.accentBright)
            }
            .clipShape(Capsule())
        }
        .frame(height: 10)
        .accessibilityElement()
        .accessibilityLabel(accessibilityText)
    }
}
