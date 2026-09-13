# Validation record — v0.3.0 Alpha, Build 4

This build is a branding, interface and behaviour revision of v0.2.1. This record separates
what was checked in the authoring environment from what still requires a Mac.

Reproduce the first section with:

```
python3 Scripts/validate_package.py
```

## Completed in the authoring environment

| Check | Result |
|---|---|
| Swift syntax, all sources and tests, via tree-sitter Swift | Passed: 22 files, no syntax errors |
| Xcode project parses; every referenced source exists | Passed: 83 objects, 22 Swift references |
| Every Swift file on disk is a member of a target | Passed: no orphaned sources |
| No duplicate or missing source declarations | Asserted by `generate_project.py` at generation time |
| Asset catalogs declare exactly the files present | Passed: AppIcon 10/10, BrandIcon 2/2 |
| App icon pixel dimensions for all 10 macOS slots | Passed |
| App icon corners are transparent | Passed: macOS renders an icon shape, not a white square |
| Entitlements and privacy manifest parse as property lists | Passed: App Sandbox off (direct distribution), no tracking declaration |
| Shared scheme is well-formed XML; target identifiers resolve | Passed: 2 references |
| No Swift source outside `Brand.swift` spells a version | Passed — this is the regression that shipped in 0.2.1 |
| Build configuration | v0.3.0 / Build 4; macOS 14 minimum; local signing; SQLite linked to both targets |
| `Build-and-Test.command` | Bash syntax check passed |
| Cleanup and scanner mutation review | Cleanup still uses `FileManager.trashItem`; the virus engine still has no deletion, quarantine or shell invocation |

**Syntax parsing is not type checking, and source review is not runtime validation.** The
authoring environment is Linux with no Swift compiler, macOS SDK or Xcode. Native
compilation, XCTest execution, UI rendering, macOS permission prompts and real ClamAV scans
were **not run here**. Build with ⌘R on your Mac first.

## What this revision did and did not touch

Unchanged, and still covered by the existing suites: `SafetyPolicy`, `ScanEngine`,
`TrashService`, `BrowserDiscovery`, `BrowserHistoryReader` and `VirusScanner`. Folder
boundaries, the browser permission model, duplicate retention, Trash-only cleanup and ClamAV
subprocess handling are byte-for-byte the same except for one added engine search path
(`/opt/local/bin/clamscan`, for MacPorts).

Changed: `Brand.swift` (new), all four view files, `CleanseModel`, `VirusScanModel`,
`BrowserModel`, `RaptorCleanseApp`, `CleanseModels` (sorting), `VirusScanModels` (report
header), the icon assets and the project generator.

## Packaged tests: 67 methods, not executed here

| Suite | Methods | Coverage |
|---|---:|---|
| EngineTests.swift | 30 | Selected-folder containment, direct-only versus recursive scans, sibling boundaries, protected locations, links/aliases/packages/cloud roots, identity changes, duplicates and retained copies, injected Trash failures, cancellation, bounds, narrow browser-cache permission roots |
| BrowserTests.swift | 14 | Bounded profile discovery, metadata names, custom profile boundaries, SQLite visit counts, bookmarks unchanged, denied/missing/corrupt/unsupported formats, malicious views, links, active WAL handling |
| VirusScannerTests.swift | 12 | Complete-summary requirements, detections, errors and missing databases, cancellation, output truncation, empty and partial scans, encrypted and limit alerts, scoped findings, literal file arguments, absence of mutation and traversal flags, cancellation before launch |
| SortingTests.swift | 11 | **New.** Each of the five review orders, determinism when keys tie, no file lost or duplicated by any order, duplicate groups kept adjacent, group order following the chosen order, empty input, stored-preference round trip |

Filesystem tests use isolated fixtures; Trash is injected rather than using your real Trash.
Virus tests use synthetic engine output and need neither ClamAV nor live malware. These
tests establish behaviour, not detection efficacy, native permission behaviour or
performance.

## Interface changes: reviewed, not rendered

No SwiftUI view in this package has been rendered. The interface was revised by source
review against the token definitions in `Brand.swift`, and the following need checking by
eye on your Mac:

1. **Sidebar and Overview in both appearances.** Switch System Settings → Appearance between
   Light and Dark. The mark must have no white tile behind it, and the version in the
   sidebar footer must match Settings → About and the project's `MARKETING_VERSION`.
2. **The Dock icon.** It should have the rounded macOS icon shape with a margin, not a
   square, and should read at small sizes in the Dock and in Finder list view.
3. **The three Overview task cards** at the 980pt minimum width and at full width; they
   should reflow rather than squeeze.
4. **Sort control** in Folder review: each order, and that duplicate groups stay together in
   the Duplicates tab.
5. **⌘R, ⇧⌘B, ⇧⌘F, ⇧⌘V** from every section, and that ⌘R is no longer ambiguous.
6. **A virus scan with findings** — detections should read as critical and coverage alerts
   as caution, and they should be visibly different from each other.
7. **Hover, pressed and disabled states** on primary, secondary and quiet buttons.

## Changes confirmed by source review

- Version and build are read from `Bundle.main`; no Swift source outside `Brand.swift`
  contains a version literal (checked mechanically).
- `keyboardShortcut("r", modifiers: .command)` appears exactly once in the package.
- The sidebar's Folder review entry calls `showFolderReview()`, which never presents an
  `NSOpenPanel`.
- Review tab counts read cached `largeFileCount` / `duplicateFileCount`, refreshed on scan,
  cleanup, scope change and threshold change.
- `CleanseSorting.sorted` is pure, main-actor-free and total-ordered; ordering behaviour is
  asserted by tests rather than by review.
- Selecting a folder still replaces the previous roots and results, subfolders still default
  off, and saved folder roots are still not restored at launch.
