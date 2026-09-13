# Raptor Cleanse — macOS

**Dev Build v0.4.1 Alpha · Build 6**
More space. Less clutter.

A native SwiftUI app for macOS 14 Sonoma or later, on Apple Silicon or Intel. It does
three things, and only when you ask it to:

| | |
|---|---|
| **Browser cleaner** | Clears history, cookies and cache across every detected browser in one click, for a time range you choose. |
| **Folder review** | Scans exactly one folder you choose, lists large files and content-matched duplicates, and moves only what you select to Trash. |
| **Virus scan** | One button. Downloads is pre-selected; optionally scans at login. Uses a **separately installed ClamAV** engine, and never removes or quarantines anything for you. |

This package contains the complete source, the Xcode project, the artwork, isolated test
fixtures and a CCleaner Mac scope comparison. It is source code, not a compiled or
notarised application — see [Validation](#validation-and-what-is-still-unverified).

## Build and run on your Mac

1. Extract the folder somewhere local.
2. Open **RaptorCleanse.xcodeproj** in Xcode 26 or later.
3. Select the **RaptorCleanse** scheme and **My Mac**.
4. Press **⌘R** to build and run, **⌘U** to run the tests.

The project uses **Sign to Run Locally** (ad-hoc signing), so no paid Developer account is
needed. If Xcode changes that, set it back in the target's Signing & Capabilities.

App Sandbox is off so the app can run an independently installed ClamAV executable, which
makes this a **direct-distribution** build rather than an App Store one. macOS privacy
protection still applies in full: the app asks for each folder and browser location it
touches, and never requests administrator access.

## What changed in 0.3.0

This release is a branding, interface and behaviour pass. No safety rule was relaxed: the
folder boundaries, browser permission model, duplicate retention checks and ClamAV
subprocess handling are unchanged.

### Branding

The product identity now lives in exactly one file, `RaptorCleanse/Brand.swift`.

- **The version is read from the built bundle.** It was previously typed into four
  places, and three of them still said `0.2.0` in a `0.2.1` release — the sidebar, the
  settings footer and the diagnostics export all shipped the wrong number. `Scripts/generate_project.py`
  is now the only place a version is set, and `Scripts/validate_package.py` fails the build
  package if any Swift file spells a version again.
- **The product has one name.** Copy that called it "Cleanse" now calls it Raptor Cleanse,
  and the name, wordmark and tagline are drawn from constants rather than literals.
- **The app icon is a real macOS icon.** The old one was the logo on a flat white square,
  which showed as a white block in the Dock with no icon shape and no margin. The new icon
  is composed on Apple's macOS icon grid — an 824pt superellipse inside a 1024pt canvas —
  over a graphite base that gives the brushed silver of the mark something to read against
  in both the light and the dark Dock.
- **The in-app mark is transparent.** It was a white-backed PNG, so it only worked because
  it was clipped to a rounded square; on the new sidebar it would have shown as a white
  tile in dark mode. It now ships at 1x and 2x with an alpha channel.
- `Scripts/generate_icons.py` regenerates every icon size from `Artwork/App-Icon-Master.png`.

See **BRANDING.md** for the colour, type and spacing definitions.

### Interface

- **A design system instead of loose numbers.** Spacing used thirteen different values
  interchangeably and type used sixteen sizes; they are now a seven-step spacing scale, a
  four-step radius scale and an eleven-step type scale, all in `Brand.swift`.
- **Colour has meaning.** Alongside the emerald accent there are now defined roles for
  positive, caution and critical states, each resolved for light and dark. Views choose a
  role, not a colour. A malware detection and a coverage alert used to share one hard-coded
  orange; they are now clearly different things, and a running browser reads as "quit this
  first" rather than as a success.
- **Virus scan is one of three equal choices** on the Overview, not a strip below the other
  two. The three task cards reflow to two columns or one on a narrow window.
- **Controls respond.** Buttons have hover, pressed and disabled states. Button styles read
  their enabled state from a nested view, which is the pattern that actually updates.
- **Review results can be ordered** — see below.

### Behaviour

- **Folder review has a sort control.** Largest, smallest, newest, oldest or name. It was
  fixed at largest-first, so "what did I download yesterday?" could not be answered here.
  The order is remembered between launches and covered by `SortingTests.swift`.
- **⌘R is no longer claimed twice.** The Scan menu command and the Scan button both
  declared it; the button's duplicate is gone and the menu command works from any section.
  **⇧⌘F** now opens Folder review.
- **The sidebar no longer throws up an open panel.** Choosing "Folder review" during a
  browser-cache review used to open a file picker immediately; it now returns you to
  Folder review and lets you choose when you are ready.
- **Large windows stay responsive.** The review tab counts came from re-filtering every
  scanned file on each redraw, and the file list was re-filtered and re-sorted three or four
  times per frame. Counts are cached against the results, and each redraw resolves the list
  once.
- **One minimum window size.** The window and the layout disagreed, at 960pt and 980pt.
- **MacPorts installations of ClamAV are found.** Only the two Homebrew paths and the
  official package were checked, so a working MacPorts install reported "not installed".
- Exported diagnostics and virus reports now name the build that produced them.

## Folder review

Choosing a folder **replaces** the previous scope. Subfolders are excluded unless you turn
them on. Nothing is selected for you: every file listed is an ordinary file for your review,
not a claim that it is junk.

Duplicate groups use streamed SHA-256 and always require an unselected retained copy, which
is re-hashed immediately before cleanup. Location, file identity, size and modification time
are all checked again before each move; changed or inaccessible files are skipped.

Confirmed cleanup uses **Move to Trash** only. That does not immediately free storage —
review and empty Trash yourself in Finder. The app never empties Trash and has no
permanent-deletion path. APFS clones, compression, sparse files and snapshots all make file
size differ from recoverable space.

### First test: verify folder scope

1. **Settings → Create test folder**, and choose a local parent such as Downloads.
2. In Folder review, leave **Include subfolders** off and scan. Expect **four files**, none selected.
3. Turn Include subfolders on and rescan. Expect **five**, including `Nested/Nested-sample.txt`.
4. Choose a different disposable folder. The scope line must show only the new folder.
5. Back in the sample folder, open **Duplicates**, select one matching text file, then **Move to Trash**. Read the filenames and paths before confirming.
6. Check Activity and Finder's Trash. Quit and reopen: no folder is remembered.

The 60 MiB sample file is sparse. It exercises size filtering while using almost no physical
space, so its apparent size is not a promise of recoverable space.

## Browser cleaner

### Clearing in one click

Pick a time range, tick what to remove, press **Clear now**. It covers every
detected browser and profile at once.

If any browsers are open, the confirmation offers **Close browsers and clear**.
Each browser is asked to quit exactly the way ⌘Q asks, so anything with unsaved
work can still prompt you; any that ignore it after eight seconds are forced to
close, and unsaved work in those is lost. Skipping the open ones stays available.

A running browser has to be closed because it holds its databases open and would
rewrite whatever was removed.

This writes to the browser's own databases and is the only irreversible thing the
app does, so it is bounded three ways: every database is **copied to Trash before
it is touched** (recover it from there if the result was not what you wanted); a
failure puts the original back; and the time bounds are covered by tests, because
Chromium, Firefox and Safari each count time from a different epoch and a wrong
conversion would delete far more than you asked for.

Two things it deliberately will not do:

- **Firefox bookmarks are never removed.** A page is only deleted when it has no
  remaining visits *and* no bookmark referring to it.
- **Safari history and cookies are protected by macOS** from other applications.
  The app says so rather than failing obscurely, clears Safari's cache, and leaves
  Safari → History → Clear History as the route for the rest.

Clearing cookies signs you out of websites. It is off by default for that reason.
Cache files go to Trash, never straight to deletion.

### Reviewing in detail

Supported families are Safari, Chrome, Edge, Brave and Firefox. Installed applications are
detected without a whole-disk search. Grant access to your home **Library** folder, or to a
recognised browser subtree, to discover standard local profiles and history counts. This
permission is separate from Folder review.

The app reports **recorded visits** — not unique sites, and not reclaimable bytes. Missing,
denied, unsupported, changing and unreadable history are distinct states and are never shown
as zero. Active SQLite journal data is reported as busy: quit the browser and refresh. macOS
may separately restrict Safari history.

**Clear in browser…** opens that browser's own privacy controls. Check the active profile
and time range and confirm there, then come back and refresh. The app does not rewrite
browser databases or claim that opening settings cleared anything. Safari may also clear
history on other devices via iCloud.
[Apple's Safari history guide](https://support.apple.com/guide/safari/clear-your-browsing-history-sfri47acf5d6/mac)

**Review cache** asks permission for the specific detected cache folder, or the narrow
parent shared by that profile's cache folders. Only recognised cache leaves are scanned.
Cache review includes their subfolders and excludes anything modified in the last 24 hours.
Quit the browser fully with **⌘Q** before cleanup. Clearing cache does not clear history,
cookies, passwords, bookmarks or sign-ins.

| Browser | Supported cache branches below home `Library/Caches` |
|---|---|
| Chrome | `Google/Chrome/Default` or `Profile N`, then `Cache`, `Code Cache` or `GPUCache` |
| Edge | `Microsoft Edge/Default` or `Profile N`, then those cache directories |
| Brave | `BraveSoftware/Brave-Browser/Default` or `Profile N`, then those cache directories |
| Firefox | `Firefox/Profiles/<profile>/cache2` |
| Safari | `com.apple.Safari/WebKitCache` or `com.apple.Safari/fsCachedData` |

Modern browser versions may store data elsewhere. Unsupported locations are never silently
added. **Settings → Forget access** discards browser permissions and the current cache
review. The scope comparison is in **CCLEANER-COMPARISON.md**.

## Virus scan

Open the page and press **Scan now**. Downloads is already selected, because that
is where files arrive; Desktop and Documents are one tap away, and **Choose…**
takes any other folder. **Scan at login** makes the app open at login and scan
that folder — it registers the app itself as a login item, with no helper tool and
no background agent, so quitting the app stops everything.

### First-time setup

The scanner uses a real, separately installed **ClamAV** engine with local official
signatures. ClamAV is **not bundled**. Browser cleaner and Folder review work without it.

If the page says ClamAV is not installed, that is almost certainly why a scan does
nothing. The panel gives you the command to paste, with a Copy button:

```
brew install clamav && freshclam
```

`freshclam` matters as much as the install: the engine on its own has no malware
signatures, and this app refuses definitions more than seven days old rather than
reporting a clean result it cannot stand behind.

If definitions are missing or stale, the app now says so **before** you scan and
offers an **Update definitions** button that runs `freshclam` for you. If that
fails with a permission error the database belongs to another user — run
`sudo freshclam` in Terminal. You can also tick **Scan anyway with out-of-date
definitions**, which lets a scan produce results at the cost of missing anything
discovered since those signatures were published.

macOS gates Desktop, Documents and Downloads for every app. The first scan of one
of those folders prompts for access; if you decline, the scanner sees an empty
folder and reports nothing found. Grant it under System Settings → Privacy &
Security → Files and Folders.

1. Install ClamAV using the [official macOS instructions](https://docs.clamav.net/manual/Installing.html#macos).
2. Configure and update its signature database — see [signature management](https://docs.clamav.net/manual/Usage/SignatureManagement.html). Installing the engine alone may not install usable definitions.
3. Open **Virus scan** and detect the engine. Apple Silicon Homebrew, Intel Homebrew, the official package and MacPorts locations are checked, and you can point at any installed `clamscan`.
4. Choose a small local test folder, confirm its path and whether to include subfolders, then start.
5. Read the alerts and coverage warnings. Export the report if useful — it contains local file paths, so check it before sharing.

The engine is handed an explicit list of eligible files and never a folder to traverse, so
recursion is the app's decision and not ClamAV's. Scans are bounded to 50,000 entries and
512 MiB per file. Links, cloud and network locations, application packages, protected
locations and empty files are excluded. Changed and unreadable files are reported as
incomplete coverage. Definitions older than seven days are refused, and missing definitions,
engine errors, cancellation, limits and incomplete output never produce a clean result.

This is an **on-demand file checker**, not continuous protection and not a whole-Mac
verdict. Files are never removed or quarantined, and the app neither installs software nor
updates definitions for you. ClamAV's engine, signatures and limits determine the result.
[ClamAV scanning documentation](https://docs.clamav.net/manual/Usage/Scanning.html)

### ClamAV licensing

ClamAV is licensed under **GPL-2.0**. This app runs `clamscan` as a separate process and
does not link, bundle or redistribute any ClamAV code, which is the usual arrangement for
staying clear of the GPL's linking obligations. That is not legal advice: take your own
before distributing commercially, and in particular before considering linking `libclamav`
into the app, which is a materially different licensing position.

## Platform scope: macOS only, and why

This is a macOS application. There is no iOS target and none is planned for this design,
which is a technical limit rather than a missing feature:

- **ClamAV cannot run on iOS.** iOS does not let an app launch a separate executable —
  `Process`/`NSTask` is not in the iOS SDK — so the scanner this app is built around has
  nothing to invoke.
- **The iOS sandbox makes "cleaning" impossible.** An iOS app can only see its own
  container. It cannot read another app's caches, another browser's history, or the system,
  so there is nothing for a cleaner or an on-device scanner to look at. This is why
  general-purpose antivirus apps do not exist on iOS in the sense they do on macOS, and why
  App Review treats such claims sceptically.
- **Linking libclamav would not fix it,** because the sandbox limit is the binding one, and
  it would replace a clean process boundary with the GPL question above.

What an iOS companion could honestly do, if you want one, is narrow and worth being explicit
about: scan files the user deliberately imports into it, clear data belonging to a Safari
Web Extension you ship, or walk someone through iOS's own **Settings → Apps → Safari →
Clear History and Website Data**. None of that is an antivirus, and it should not be
marketed as one. Say the word and it can be scoped as its own project.

## Privacy

No analytics, advertising, login, background agent or privileged helper. Browser permission
bookmarks and preferences stay local. Folder scan results and activity stay in memory for
the session. History URLs and page titles are never collected. External links open only when
you choose them. Diagnostic exports omit local filenames and paths; the separate virus report
deliberately includes the paths to its findings.

## Validation and what is still unverified

Run `python3 Scripts/validate_package.py` for a full report. It checks Swift syntax, that
the Xcode project references every source that exists and vice versa, asset catalog
completeness and icon dimensions, property lists, the shared scheme, and that no Swift file
hard-codes a version.

It is **not a build**. The authoring environment is Linux with no Xcode, macOS SDK or Swift
compiler, so **native compilation, type checking, XCTest execution, UI rendering, macOS
permission behaviour and real ClamAV scans have not been run**. The first thing to do on
your Mac is ⌘R. See **VALIDATION.md** for the detail.

## Tests and feedback

Run **⌘U**, or `./Build-and-Test.command`. The standalone XCTest bundle covers scan
boundaries, duplicate retention, Trash failure handling, browser discovery, read-only SQLite
history, virus output interpretation and review ordering. Fixtures are isolated: tests never
scan personal folders, never use your real Trash, and never need ClamAV or live malware.

For build problems, send the first compiler error with its file and line. For behaviour,
describe the exact steps and use **Settings → Export diagnostics**. A screenshot helps with
layout — check visible paths before sharing it.

## Repository layout

```
RaptorCleanse/            Swift sources (Brand, Models, Views, Services)
RaptorCleanseTests/       XCTest bundle, isolated fixtures
Artwork/                  Master artwork and rendered brand references
Scripts/generate_icons.py     Rebuild every app icon size from the master
Scripts/generate_project.py   Rebuild the Xcode project, scheme and entitlements
Scripts/validate_package.py   Everything checkable without a Mac
```

`Scripts/generate_project.py` regenerates the project and entitlements with Python 3 alone;
it changes no Swift source or artwork, and asserts that every declared source exists and is
declared only once.
