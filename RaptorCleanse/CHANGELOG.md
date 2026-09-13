# Changelog

## 0.4.0 Alpha — Build 5

Acts on two things the previous build only reported on.

### Added

- **One-click browser clearing.** A single Clear panel at the top of Browser
  cleaner: pick a time range (last hour, 24 hours, 7 days, 4 weeks, all time),
  tick history, cookies and/or cache, press once. It applies to every detected
  browser and profile at the same time. Previously the app only *opened* each
  browser's own privacy controls and left the work to you.
- **Virus scan works in one click.** Downloads is pre-selected on arrival, with
  Desktop and Documents one tap away, and a single Scan now button. The page
  opens ready to scan rather than ready to be configured.
- **Actionable setup when ClamAV is missing.** The old message named a
  documentation page. The new panel gives the exact command
  (`brew install clamav && freshclam`) with a Copy button and a "detect again"
  step. "ClamAV is not installed" is by far the most likely reason a scan does
  nothing, and the app now says so plainly.
- **Scan at login.** Registers the app itself as a login item via
  `SMAppService`; on launch it scans the selected folder. No helper tool, no
  background agent — closing the app stops everything.
- 22 new tests in `BrowserCleanupTests.swift`.

### Safety of the clearing feature

Clearing writes to a browser's own databases, which is the only irreversible
thing this app does. Three rules bound it:

1. **The browser must be quit.** Running browsers are skipped, named in the UI
   before you press the button, and re-checked at the moment of clearing.
2. **Every database is copied before it is touched.** On success the copy goes to
   Trash, so a mistake is recoverable; on failure the original is put back and
   the copy removed.
3. **Time bounds are tested.** Chromium counts microseconds from 1601, Firefox
   microseconds from 1970, Safari seconds from 2001. A wrong conversion would
   silently delete far more than asked, so each is a pure function with exact
   assertions, and the delete statements run against synthetic databases in the
   test suite.

Firefox bookmarks are protected explicitly: pages are only removed when they have
no remaining visits **and** `foreign_count = 0`, so clearing history never takes a
bookmark with it. Safari's history and cookies are protected by macOS from other
apps; the app says so and leaves Safari's own controls as the route, while still
clearing Safari's cache.

Cache files always go to Trash rather than being deleted.

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
