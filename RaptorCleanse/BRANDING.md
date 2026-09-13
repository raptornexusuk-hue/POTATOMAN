# Raptor Cleanse — brand and interface guide

Everything here is defined once, in `RaptorCleanse/Brand.swift`. If a value is not in that
file, it should not appear in a view. `Scripts/validate_package.py` enforces the one rule
that has actually caused a bug: no Swift file outside `Brand.swift` may spell a version.

## Identity

| | |
|---|---|
| Name | **Raptor Cleanse** — always both words, never "Cleanse" alone |
| Wordmark | `RAPTOR` in tracked caps above `CLEANSE`, both rounded |
| Vendor | Raptor Nexus |
| Tagline | *More space. Less clutter.* |
| Promise | *Local. On your terms.* |
| Version | Read from the bundle. Set it in `Scripts/generate_project.py` and nowhere else |

The mark is a brushed-silver **R** wrapped by an emerald ring. Silver is the material,
emerald is the action — the ring is the thing that moves, and emerald is therefore the
accent colour for anything the person can act on.

## Colour

Every colour is defined for light and dark together, in `BrandColor`. Neither appearance is
a tint of the other.

| Token | Light | Dark | Use |
|---|---|---|---|
| `accent` | `#088750` | `#5CD6A8` | Accent text, icons, selection |
| `accentFill` | `#0B7352` | same | Fill behind white text |
| `accentBright` | `#1CA878` | same | Meters and progress |
| `accentWash` | accent @ 10% | accent @ 14% | Selected rows, icon tiles, quiet banners |
| `silver` | `#616A6E` | `#B8BFC7` | Wordmark, meter track |
| `canvas` / `panel` | system | system | Window and card backgrounds |
| `sidebar` / `well` | `#F5F7F7` / `#FAFAFC` | `#212426` / `#1C1F21` | Sidebar, recessed areas |
| `caution` | `#9E6105` | `#FAB84D` | Attention needed; nothing is wrong yet |
| `critical` | `#B32220` | `#FF7D70` | A malware alert to read now |

### Choosing a colour

Views never name a colour. They name a **role** — `BrandTone.positive`, `.neutral`,
`.caution` or `.critical` — and the tone supplies both foreground and wash. This exists
because the previous build used one hard-coded orange for two different events:

- a **detection** is a signature match — `critical`;
- a **coverage alert** means the engine could not see inside a file — `caution`;
- a **running browser** is a step to complete before cache cleanup, not a success —
  `caution`, not green;
- **history that could not be read** is a state to resolve, not a failure — `neutral`.

## Spacing

A 4pt scale. The previous build used 5, 7, 9, 11, 13, 17, 18, 21, 22, 23, 25, 26 and 27
interchangeably.

| Token | Value | Use |
|---|---:|---|
| `xxs` | 4 | Label to its own value |
| `xs` | 8 | Inside a control |
| `sm` | 12 | Between related controls |
| `md` | 16 | Between rows of a card |
| `lg` | 20 | Card padding |
| `xl` | 28 | Page margins, gaps between cards |
| `xxl` | 36 | Above a new section |

## Shape

`sm` 8 (pills, tabs), `md` 10 (buttons, fields), `lg` 14 (wells, icon tiles), `xl` 18
(cards, sheets). Radius follows the size of the thing it belongs to.

## Type

Sizes stay generous on purpose: this app shows file paths and destructive confirmations,
and both need to be read rather than squinted at.

| Token | Size | Use |
|---|---:|---|
| `display` | 34 rounded | The one number a page is about |
| `title` | 28 | Page title |
| `heading` | 22 | Card title, section heading |
| `subheading` | 18 | Sub-heading, emphasised value |
| `rowTitle` | 17 | A row's primary line |
| `body` | 16 | Body copy and controls — the default |
| `bodyStrong` | 16 semibold | Button labels |
| `detail` | 15 | Secondary detail under a row |
| `mono` | 15 mono | Paths, versions, engine output |
| `caption` | 13 | The smallest text in the app: metadata only |

Every figure uses `.monospacedDigit()` so numbers do not jitter as they update.

## Components

Defined in `Views/Components.swift`. Build pages from these rather than from raw stacks.

- `CleansePrimaryButtonStyle` — filled emerald. **At most one per view**: the action the
  page exists for.
- `CleanseSecondaryButtonStyle` — bordered. Real actions that are not the main one.
- `CleanseQuietButtonStyle` — text only. Reversible in-place actions such as Deselect.
- `CleansePanel` — the card every page is a stack of.
- `CleanseWell` — recessed area for figures a card reports rather than acts on.
- `CleanseIconTile`, `CleanseSectionHeading`, `CleanseStepHeading`, `CleanseStatusPill`,
  `CleanseCallout`, `CleanseMetric`, `CleanseTaskCard`, `CleanseFileRow`,
  `CleanseEmptyState`, `CleanseStorageMeter`.

Button styles resolve `isEnabled` and hover state inside a nested view. Reading the
environment on the style value itself does not reliably update.

## Voice

Plain, second person, no exclamation marks and no urgency the situation does not have. State
what happened and what the person can do about it.

- Say what the app **did**, not what it protected you from: "No detections in scanned files",
  never "You're protected".
- Never imply a file is junk. It is "an ordinary file for your review".
- Never claim space has been freed. Moving to Trash does not free space until Trash is emptied.
- Name the limit when there is one: "recorded visits", not "websites"; "in the files it
  scanned", not "your Mac is clean".

## App icon

`Scripts/generate_icons.py` builds every size from `Artwork/App-Icon-Master.png`.

The icon shape is an **824pt superellipse inside a 1024pt canvas**, Apple's macOS icon grid,
leaving the 100pt margin macOS expects. The base is a graphite gradient, `#30363A` to
`#131618`, so brushed silver has something to read against in both the light and the dark
Dock. The mark fills 70% of the shape, nudged up 1.2% because the ring puts its visual mass
low, with a soft drop shadow.

At 16 and 32 points the sheen and shadow are dropped and the mark is given 80% of the shape,
because the detail is lost at that size and only the silhouette survives.

The base is deliberately plain. An emerald rim was tried and removed: it added noise at 1024
and was invisible by 128.

The in-app `BrandIcon` is the mark alone on a transparent background at 1x and 2x. It must
stay transparent — the old white-backed PNG only worked because it was clipped to a rounded
square, and would show as a white tile on the sidebar in dark mode.
