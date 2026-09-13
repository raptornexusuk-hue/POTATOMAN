import SwiftUI
import AppKit

/// The single source of truth for Raptor Cleanse identity, colour, spacing and type.
///
/// Nothing else in the app hard-codes the product name, a version string, a hex
/// colour, a corner radius or a point size. Earlier builds spelled the version in
/// four places and drifted out of step; the version now always comes from the
/// built bundle, so the Xcode project is the only place it is set.
enum Brand {
    /// Full product name. Used in windows, alerts, panels and exported reports.
    static let name = "Raptor Cleanse"
    /// The two halves of the wordmark lockup.
    static let nameLeading = "RAPTOR"
    static let nameTrailing = "CLEANSE"
    static let vendor = "Raptor Nexus"
    /// Primary promise, shown on the Overview and in the About panel.
    static let tagline = "More space. Less clutter."
    /// Secondary promise, shown under the sidebar lockup.
    static let promise = "Local. On your terms."

    /// Marketing version from the bundle, e.g. "0.3.0".
    static var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
    }
    /// Build number from the bundle, e.g. "4".
    static var build: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0"
    }
    /// Release stage. Alpha builds say so everywhere they show a version.
    static let stage = "Alpha"
    /// "v0.3.0 Alpha" — the short form for the sidebar and settings footer.
    static var shortVersion: String { "v\(version) \(stage)" }
    /// "Raptor Cleanse v0.3.0 Alpha (Build 4)" — the long form for reports.
    static var fullVersion: String { "\(name) \(shortVersion) (Build \(build))" }
    /// Filename-safe stem for exported files, e.g. "RaptorCleanse-v0.3.0".
    static var fileStem: String { "RaptorCleanse-v\(version)" }

    /// Smallest window the layout is designed for. One constant, applied once.
    static let minimumWindowWidth: CGFloat = 980
    static let minimumWindowHeight: CGFloat = 680
    static let defaultWindowWidth: CGFloat = 1180
    static let defaultWindowHeight: CGFloat = 820
    static let sidebarWidth: CGFloat = 244
}

// MARK: - Colour

/// Silver and emerald, from the Raptor Cleanse mark.
///
/// Every colour resolves per appearance, so light and dark are defined together
/// and neither is an afterthought. Semantic roles (positive, caution, critical)
/// exist so views never reach for a raw `Color.orange` again.
enum BrandColor {
    /// Resolve one colour for light and one for dark in a single value.
    private static func dynamic(light: NSColor, dark: NSColor) -> Color {
        Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? dark : light
        }))
    }

    /// Accent for text, icons and selection. Darker on light, brighter on dark,
    /// so it keeps contrast against the background in both appearances.
    static let accent = dynamic(
        light: NSColor(red: 0.03, green: 0.44, blue: 0.31, alpha: 1),
        dark: NSColor(red: 0.36, green: 0.84, blue: 0.66, alpha: 1)
    )
    /// Fill behind white text. Fixed, because the text on it is always white.
    static let accentFill = Color(red: 0.04, green: 0.45, blue: 0.32)
    /// Pressed state for `accentFill`.
    static let accentFillPressed = Color(red: 0.02, green: 0.34, blue: 0.24)
    /// Saturated emerald for meters and progress, where fill area carries the meaning.
    static let accentBright = Color(red: 0.11, green: 0.66, blue: 0.47)
    /// Tint behind accent content: selected rows, icon tiles, quiet banners.
    static let accentWash = dynamic(
        light: NSColor(red: 0.11, green: 0.66, blue: 0.47, alpha: 0.10),
        dark: NSColor(red: 0.36, green: 0.84, blue: 0.66, alpha: 0.14)
    )
    /// The silver of the mark, for the wordmark and rule details.
    static let silver = dynamic(
        light: NSColor(red: 0.38, green: 0.41, blue: 0.43, alpha: 1),
        dark: NSColor(red: 0.72, green: 0.75, blue: 0.78, alpha: 1)
    )

    /// Window background.
    static let canvas = Color(nsColor: .windowBackgroundColor)
    /// Card and control background.
    static let panel = Color(nsColor: .controlBackgroundColor)
    /// Sidebar background: a touch away from the canvas, not a different colour.
    static let sidebar = dynamic(
        light: NSColor(red: 0.96, green: 0.97, blue: 0.97, alpha: 1),
        dark: NSColor(red: 0.13, green: 0.14, blue: 0.15, alpha: 1)
    )
    /// Recessed wells inside a panel.
    static let well = dynamic(
        light: NSColor(red: 0.98, green: 0.98, blue: 0.99, alpha: 1),
        dark: NSColor(red: 0.11, green: 0.12, blue: 0.13, alpha: 1)
    )
    /// Hairline borders.
    static let line = Color(nsColor: .separatorColor).opacity(0.55)

    /// Something is confirmed good.
    static let positive = accent
    /// Attention needed, nothing is wrong yet: coverage limits, busy databases.
    static let caution = dynamic(
        light: NSColor(red: 0.62, green: 0.38, blue: 0.02, alpha: 1),
        dark: NSColor(red: 0.98, green: 0.72, blue: 0.30, alpha: 1)
    )
    static let cautionWash = dynamic(
        light: NSColor(red: 0.85, green: 0.55, blue: 0.05, alpha: 0.12),
        dark: NSColor(red: 0.98, green: 0.72, blue: 0.30, alpha: 0.16)
    )
    /// A malware alert the person must read.
    static let critical = dynamic(
        light: NSColor(red: 0.70, green: 0.13, blue: 0.11, alpha: 1),
        dark: NSColor(red: 1.00, green: 0.49, blue: 0.44, alpha: 1)
    )
    static let criticalWash = dynamic(
        light: NSColor(red: 0.80, green: 0.16, blue: 0.13, alpha: 0.10),
        dark: NSColor(red: 1.00, green: 0.49, blue: 0.44, alpha: 0.15)
    )
    /// Nothing to report.
    static let neutralWash = Color.secondary.opacity(0.10)
}

/// The tone of a status message, so a view picks a role rather than a colour.
enum BrandTone {
    case positive, neutral, caution, critical

    var foreground: Color {
        switch self {
        case .positive: return BrandColor.positive
        case .neutral: return .secondary
        case .caution: return BrandColor.caution
        case .critical: return BrandColor.critical
        }
    }

    var wash: Color {
        switch self {
        case .positive: return BrandColor.accentWash
        case .neutral: return BrandColor.neutralWash
        case .caution: return BrandColor.cautionWash
        case .critical: return BrandColor.criticalWash
        }
    }
}

// MARK: - Spacing and shape

/// A 4-point spacing scale. Previous builds used 5, 7, 9, 11, 13, 17, 18, 21, 22,
/// 23, 25, 26 and 27 interchangeably; these seven steps replace all of them.
enum BrandSpace {
    /// 4 — between a label and its own value.
    static let xxs: CGFloat = 4
    /// 8 — inside a control.
    static let xs: CGFloat = 8
    /// 12 — between related controls.
    static let sm: CGFloat = 12
    /// 16 — between rows of a card.
    static let md: CGFloat = 16
    /// 20 — card padding.
    static let lg: CGFloat = 20
    /// 28 — page margins and the gap between cards.
    static let xl: CGFloat = 28
    /// 36 — above a new section of a page.
    static let xxl: CGFloat = 36
}

/// Corner radii, paired with the control size they belong to.
enum BrandRadius {
    /// 8 — pills, tabs, small tiles.
    static let sm: CGFloat = 8
    /// 10 — buttons and fields.
    static let md: CGFloat = 10
    /// 14 — wells and icon tiles.
    static let lg: CGFloat = 14
    /// 18 — cards and sheets.
    static let xl: CGFloat = 18
}

/// A type scale with one job per step. Sizes stay generous: this app shows file
/// paths and destructive confirmations, and both need to be read, not squinted at.
enum BrandFont {
    /// 34 — the single number a page is about (space available).
    static let display = Font.system(size: 34, weight: .semibold, design: .rounded)
    /// 28 — page title.
    static let title = Font.system(size: 28, weight: .semibold)
    /// 22 — card title and section heading.
    static let heading = Font.system(size: 22, weight: .semibold)
    /// 18 — sub-heading and emphasised value.
    static let subheading = Font.system(size: 18, weight: .semibold)
    /// 17 — a row's primary line.
    static let rowTitle = Font.system(size: 17, weight: .medium)
    /// 16 — body copy and controls. The app's default.
    static let body = Font.system(size: 16)
    /// 16 semibold — button labels and emphasised body.
    static let bodyStrong = Font.system(size: 16, weight: .semibold)
    /// 15 — secondary detail under a row.
    static let detail = Font.system(size: 15)
    /// 15 monospaced — paths, versions and engine output.
    static let mono = Font.system(size: 15, design: .monospaced)
    /// 13 — the smallest text in the app: metadata captions only.
    static let caption = Font.system(size: 13)
}

// MARK: - Marks

/// The sidebar lockup: mark above the two-line wordmark.
///
/// The wordmark is drawn from `Brand.nameLeading`/`nameTrailing` rather than
/// literal strings, so the product cannot be renamed in one place and not another.
struct BrandLockup: View {
    var iconSize: CGFloat = 96

    var body: some View {
        VStack(spacing: BrandSpace.sm) {
            Image("BrandIcon")
                .resizable()
                .scaledToFit()
                .frame(width: iconSize, height: iconSize)
                .accessibilityHidden(true)
            VStack(spacing: 2) {
                Text(Brand.nameLeading)
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .tracking(6)
                    .foregroundStyle(BrandColor.silver)
                Text(Brand.nameTrailing)
                    .font(.system(size: 27, weight: .semibold, design: .rounded))
                    .tracking(1)
                    .foregroundStyle(.primary)
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Brand.name)
    }
}
