# Changelog

## 0.3.0 Alpha — Build 4

Branding, interface and behaviour revision. No safety rule was relaxed: folder boundaries,
the browser permission model, duplicate retention checks and ClamAV subprocess handling are
unchanged, and the existing test suites still cover them.

### Fixed

- **The app reported the wrong version in three places.** The sidebar, the settings footer
  and the diagnostics export all said `0.2.0` in a `0.2.1` release. Version and build now
  come from the bundle, set only in `Scripts/generate_project.py`, and
  `Scripts/validate_package.py` fails if a Swift file spells one again.
- **⌘R was claimed by two views.** The Scan menu command and the Scan button both declared
  it. The button's duplicate is removed; the menu command works from any section.
- **The sidebar opened a file picker unasked.** Choosing "Folder review" during a
  browser-cache review opened an `NSOpenPanel` immediately. It now returns to Folder review.
- **The window and the layout disagreed on the minimum size** — 960pt against 980pt. Both
  now come from `Brand.minimumWindowWidth`.
- **Review redraws re-scanned the whole result set.** The three tab counts re-filtered every
  file on each redraw, and the list was re-filtered and re-sorted three or four times per
  frame. Counts are cached against the results; each redraw resolves the list once.
- **MacPorts ClamAV installations were reported as missing.** `/opt/local/bin/clamscan` is
  now checked alongside both Homebrew prefixes and the official package.
- **The app icon was a flat white square** with no icon shape and no margin, and the in-app
  mark was a white-backed PNG that would show as a white tile on a dark sidebar.
- **Cleanup could strand its progress state.** `confirmCleanup` held `self` weakly, so a
  deallocation mid-cleanup would have left `isCleaning` set; it now matches `scan()`.
- Copy that called the product "Cleanse" now calls it Raptor Cleanse; a status message
  named a "Scan folder" button that is labelled "Scan this folder".

### Added

- **Sort control in Folder review** — largest, smallest, newest, oldest or name, remembered
  between launches. Ordering is a pure function in `CleanseSorting`, covered by 10 new tests
  in `SortingTests.swift`, including that equal keys produce a deterministic order and that
  duplicate groups stay adjacent.
- **⇧⌘F** opens Folder review.
- `Brand.swift`: name, version, tagline, colour roles, spacing scale, radius scale and type
  scale in one place.
- `Scripts/generate_icons.py` — rebuilds every icon size from the master artwork.
- `Scripts/validate_package.py` — every check possible without a Mac, and an explicit
  statement of what it does not cover.
- `BRANDING.md` — the brand and interface guide.
- Exported diagnostics and virus reports name the build that produced them.
- An About panel in Settings showing the real bundle version.

### Changed

- **Colour has defined roles.** `positive`, `neutral`, `caution` and `critical`, each
  resolved for light and dark. A malware detection and a coverage alert no longer share one
  hard-coded orange, and a running browser reads as a step to complete rather than a success.
- **Virus scan is one of three equal task cards** on the Overview rather than a strip below
  the other two. The cards reflow to two columns or one on a narrow window.
- Buttons have hover, pressed and disabled states, and resolve `isEnabled` in a nested view,
  which is the pattern that updates reliably.
- Spacing, radius and type come from scales rather than from ad-hoc numbers.
- `BrandIcon` ships at 1x and 2x with an alpha channel.
- `generate_project.py` asserts that every declared source exists and is declared once.

## 0.2.1 Alpha — Build 3

Removed the redundant `sqlite3_enable_load_extension(database, 0)` call that is unavailable
in the reported macOS SDK. Every history read opens a fresh connection and extension loading
is disabled by default; the app never enables it. No other behaviour changed.

## 0.2.0 Alpha — Build 2

Centred silver/emerald icon and native wordmark. Six destinations: Overview, Browser
cleaner, Folder review, Virus scan, Activity and Settings. Choosing a folder replaces the
previous scope, with subfolders excluded unless enabled, and old folder selections are no
longer restored into a combined scan. Automatic discovery of installed browsers, profiles
and recorded history visits. Separate browser-cache review with a narrow permission request.
New optional ClamAV virus scanner with progress, cancellation, alerts and an exportable
report.
