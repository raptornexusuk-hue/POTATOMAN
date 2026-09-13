# Raptor Cleanse 0.3.0 Alpha — CCleaner Mac comparison

Reviewed 8 September 2026. This comparison sets the scope of the current Alpha; it does not claim feature parity or measured performance equivalence.

CCleaner presents separate tasks for clutter, browser cleaning, duplicates, photos, application removal and startup management. Its browser cleaner includes browsing history, cookies and autofill data, with automatic cleaning also advertised. These are product descriptions, not an independent assessment of their results. [CCleaner for Mac](https://www.ccleaner.com/ccleaner-mac)

| Task | CCleaner Mac advertised scope | Raptor Cleanse 0.3.0 Alpha scope |
|---|---|---|
| Storage cleanup | Cache, temporary files, downloads and Trash cleanup | Review supported browser-cache candidates and selected-folder files; confirm selected moves to Trash. Moving files to Trash does not itself release their occupied storage. |
| Browser privacy | History, cookies, autofill and automatic cleaning | Discover supported installed browsers and standard profiles automatically. After browser-specific Library permission, inspect history counts read-only. The history action opens the browser's own controls for the user to finish clearing. |
| Folder inspection | Clutter and duplicate-finding tools | Scan exactly one selected folder, with an explicit option to include its subfolders. Browser scanning is a separate action. |
| Duplicates | Identify identical files | SHA-256 duplicate review within the chosen scan scope. Review and select files before moving them to Trash. |
| Virus scan | Antivirus capabilities are not assessed on the referenced Mac cleaner page. | Optional on-demand scanning of the selected folder using a separately installed ClamAV engine; report findings without automatic quarantine or deletion. |
| Additional tools | Photo analysis, uninstalling apps and startup management | Outside the current Alpha scope. |

## Browser workflow and limits

1. Open Browser cleaner and review the detected applications and profiles.
2. Grant access to the requested browser location where needed, then inspect cache candidates and history counts. A denied or unreadable location must be reported as unavailable, not as an empty history.
3. Review cache selections and confirm moves to Trash. For history, open that browser's own controls and complete its confirmation there.
4. Return and refresh the browser scan to inspect the result.

**Opening a browser or its settings is not confirmation that history has been cleared.** This Alpha does not directly delete or rewrite browser history databases, schedule history deletion, or claim to clear cookies, passwords or autofill.

Standard-path discovery has limits: Chromium documents both the usual Mac profile/cache locations and custom `--user-data-dir` overrides. A custom or inaccessible profile may require a separate supported access path; the app must not silently broaden a folder scan to find it. [Chromium profile and cache locations](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/user_data_dir.md)

Firefox's `places.sqlite` includes bookmarks, downloaded-file records and visited websites. Removing that database is not history-only cleanup. [Mozilla profile files](https://support.mozilla.org/en-US/kb/profiles-where-firefox-stores-user-data)

Safari's own Clear History action can also remove history from other Apple devices using Safari with iCloud. Its confirmation is therefore a privacy decision, not simply a storage operation. [Apple Safari Clear History](https://support.apple.com/guide/safari/clear-your-browsing-history-sfri47acf5d6/mac)

## Optional virus scanning

Virus scan uses the separate ClamAV `clamscan` command to inspect the selected folder on demand. The engine and usable signature databases must be installed and maintained separately. ClamAV provides a macOS installer and documents the required configuration. [ClamAV installation](https://docs.clamav.net/manual/Installing.html#macos)

Raptor Cleanse reports findings without automatically quarantining or deleting files. This is a manual scan, not continuous protection. A completed scan with no findings describes only the files and signatures checked; missing signatures, skipped files or scan errors must not be reported as proof that the Mac is clean. ClamAV documents one-time scanning, scan limits and explicit file-removal options. [ClamAV scanning](https://docs.clamav.net/manual/Usage/Scanning.html)

## Next validation priorities

- Build and launch on the target Mac, then test a disposable folder containing a sibling folder, nested files and a symbolic link. Verify that recursion changes only the selected folder's scope and links do not escape it.
- Check each installed supported browser with multiple profiles, permission granted and denied, and the browser both open and closed. Compare reported history counts with the intended record definition; counts are not estimates of reclaimable bytes.
- Verify native history controls open in the intended browser, refresh after manual clearing, and show unavailable access separately from zero records.
- Test cache selection and Trash recovery with disposable browser profiles. Verify bookmarks, saved credentials and unrelated files remain intact.
- Validate Virus scan with ClamAV installed and absent, signature databases missing, scan cancellation and harmless test fixtures; verify scope, error reporting and that findings are never moved or deleted automatically.
- Review window resizing, keyboard operation, text readability and logo alignment on the user's display before extending cleanup coverage.
