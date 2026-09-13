import Foundation
import Darwin

enum VirusScannerError: LocalizedError {
    case unavailable(String)
    var errorDescription: String? {
        switch self { case .unavailable(let text): return text }
    }
}

/// Shared by the background worker and main-actor Cancel button.
final class VirusScanCancellation: @unchecked Sendable {
    private let lock = NSLock()
    private var cancelled = false
    private var process: Process?
    var isCancelled: Bool { lock.lock(); defer { lock.unlock() }; return cancelled }

    func start(_ child: Process) throws {
        lock.lock()
        defer { lock.unlock() }
        guard !cancelled else { throw CancellationError() }
        try child.run()
        process = child
    }

    func completed(_ child: Process) {
        lock.lock()
        defer { lock.unlock() }
        if process === child { process = nil }
    }

    func cancel() {
        lock.lock()
        cancelled = true
        lock.unlock()
        stopCurrentProcess()
    }

    func stopCurrentProcess() {
        lock.lock()
        let child = process
        if let child, child.isRunning { child.terminate() }
        lock.unlock()
        // clamscan normally exits on SIGTERM. Bound shutdown for a stuck engine.
        if let child {
            DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 2) { [weak self, weak child] in
                guard let self, let child else { return }
                self.lock.lock()
                defer { self.lock.unlock() }
                if self.process === child, child.isRunning { Darwin.kill(child.processIdentifier, SIGKILL) }
            }
        }
    }
}

enum VirusScanner {
    static let installationURL = URL(string: "https://docs.clamav.net/manual/Installing.html#macos")!
    static let signaturesURL = URL(string: "https://docs.clamav.net/manual/Usage/SignatureManagement.html")!
    static let maximumEntries = 50_000
    static let maximumFileBytes: Int64 = 512 * 1_024 * 1_024
    static let maximumOutputBytes = 15 * 1_024 * 1_024

    // Apple Silicon Homebrew, Intel Homebrew, the official PKG, and MacPorts.
    // A recognised installation outside these paths is still selectable by hand.
    static let enginePaths = ["/opt/homebrew/bin/clamscan", "/usr/local/bin/clamscan",
                             "/usr/local/clamav/bin/clamscan", "/opt/local/bin/clamscan"]

    static func discover(cancellation: VirusScanCancellation = VirusScanCancellation()) -> VirusEngine? {
        for path in enginePaths {
            if cancellation.isCancelled { return nil }
            if let engine = try? inspectEngine(URL(fileURLWithPath: path), cancellation: cancellation) { return engine }
        }
        return nil
    }

    static func inspectEngine(_ url: URL, cancellation: VirusScanCancellation = VirusScanCancellation()) throws -> VirusEngine {
        let resolved = url.resolvingSymlinksInPath().standardizedFileURL
        guard url.isFileURL, url.lastPathComponent == "clamscan", resolved.lastPathComponent == "clamscan",
              FileManager.default.isExecutableFile(atPath: resolved.path) else {
            throw VirusScannerError.unavailable("Choose the installed executable named clamscan from a trusted ClamAV installation.")
        }
        let info = try SafetyPolicy.metadata(resolved)
        guard (info.st_mode & S_IFMT) == S_IFREG else {
            throw VirusScannerError.unavailable("The selected ClamAV engine is not a regular executable file.")
        }
        let timeout = DispatchWorkItem { cancellation.cancel() }
        DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 10, execute: timeout)
        defer { timeout.cancel() }
        let output = try run(executable: resolved, arguments: ["--version"], cancellation: cancellation, outputLimit: 32_768)
        guard output.exitCode == 0, !output.truncated, !cancellation.isCancelled,
              let version = output.text.split(separator: "\n").map(String.init).first(where: { $0.hasPrefix("ClamAV ") }) else {
            throw VirusScannerError.unavailable("The selected engine did not return a valid ClamAV version. Check its installation and try again.")
        }
        return VirusEngine(executableURL: resolved, version: version)
    }

    /// Files are enumerated by our consent policy; ClamAV never receives a directory argument.
    /// This makes recursive mode an app-controlled option and prevents engine traversal.
    static func arguments(paths: [String]) -> [String] {
        ["--recursive=no", "--follow-dir-symlinks=0", "--follow-file-symlinks=0", "--cross-fs=no",
         "--suppress-ok-results", "--official-db-only=yes", "--fail-if-cvd-older-than=7",
         "--max-filesize=512M", "--max-scansize=1024M", "--max-scantime=120000",
         "--alert-exceeds-max=yes", "--alert-encrypted=yes", "--"] + paths
    }

    private struct Candidate {
        let url: URL
        let snapshot: FileSnapshot
    }

    static func scan(engine: VirusEngine, folder: URL, includeSubfolders: Bool, cancellation: VirusScanCancellation,
                     progress: @escaping @Sendable (VirusScanProgress) -> Void) -> VirusScanReport {
        var report = VirusScanReport(folder: folder, includedSubfolders: includeSubfolders,
                                     engineVersion: engine.version, startedAt: Date())
        var hadIncompleteBatch = false
        do {
            try SafetyPolicy.validateRoot(folder)
            let rootSnapshot = SafetyPolicy.snapshot(try SafetyPolicy.metadata(folder))
            var entries = 0
            var candidates: [Candidate] = []
            var pending = [folder]
            var hitLimit = false
            progress(VirusScanProgress(completed: 0, total: 0, message: "Checking eligible files in the selected folder…"))
            while !pending.isEmpty, !hitLimit, !cancellation.isCancelled {
                let directory = pending.removeLast()
                if directory != folder {
                    try SafetyPolicy.validateScopedEntry(directory, root: folder, rootSnapshot: rootSnapshot)
                    try SafetyPolicy.validateLocation(directory, isDirectory: true)
                }
                // Directory enumeration is streamed so a huge folder cannot allocate an unbounded list.
                var enumerationFailed = false
                guard let enumerator = FileManager.default.enumerator(at: directory, includingPropertiesForKeys: nil,
                    options: [.skipsSubdirectoryDescendants], errorHandler: { _, _ in enumerationFailed = true; return false }) else {
                    report.skippedEntries += 1
                    hadIncompleteBatch = true
                    continue
                }
                while let url = enumerator.nextObject() as? URL {
                    if cancellation.isCancelled { break }
                    entries += 1
                    if entries > maximumEntries { hitLimit = true; break }
                    do {
                        try SafetyPolicy.validateScopedEntry(url, root: folder, rootSnapshot: rootSnapshot, includeSubfolders: includeSubfolders)
                        let metadata = try SafetyPolicy.metadata(url)
                        let isDirectory = (metadata.st_mode & S_IFMT) == S_IFDIR
                        try SafetyPolicy.validateLocation(url, isDirectory: isDirectory)
                        if isDirectory {
                            if includeSubfolders { pending.append(url) }
                            continue
                        }
                        let snapshot = SafetyPolicy.snapshot(metadata)
                        guard (metadata.st_mode & S_IFMT) == S_IFREG, snapshot.byteCount > 0,
                              snapshot.byteCount <= maximumFileBytes,
                              !url.path.contains("\n"), !url.path.contains("\r"),
                              FileManager.default.isReadableFile(atPath: url.path) else {
                            report.skippedEntries += 1
                            continue
                        }
                        candidates.append(Candidate(url: url, snapshot: snapshot))
                    } catch { report.skippedEntries += 1 }
                    if entries % 250 == 0 {
                        progress(VirusScanProgress(completed: 0, total: candidates.count, message: "Checked \(entries) entries; \(candidates.count) eligible files…"))
                    }
                }
                if enumerationFailed {
                    report.skippedEntries += 1
                    hadIncompleteBatch = true
                    if report.warnings.count < 80 { report.warnings.append("Could not finish reading a folder: \(directory.path)") }
                }
            }
            if hitLimit { report.warnings.append("The 50,000-entry limit was reached. Choose a smaller folder to check the remaining entries.") }
            if report.skippedEntries > 0 {
                report.warnings.append("\(report.skippedEntries) entries were skipped: protected/cloud locations, links, packages, unreadable or changed files, empty files, unusual line-break filenames, or files larger than 512 MB.")
            }
            hadIncompleteBatch = hadIncompleteBatch || hitLimit || report.skippedEntries > 0
            var offset = 0
            while offset < candidates.count, !cancellation.isCancelled {
                var batch: [Candidate] = []
                var argumentBytes = 0
                while offset < candidates.count, batch.count < 200 {
                    let next = candidates[offset]
                    let nextBytes = next.url.path.utf8.count + 1
                    if !batch.isEmpty, argumentBytes + nextBytes > 48_000 { break }
                    batch.append(next)
                    argumentBytes += nextBytes
                    offset += 1
                }
                var paths: [String] = []
                // Recheck root, containment, no links, volume and exact identity just before launch.
                try SafetyPolicy.validateRoot(folder)
                for candidate in batch {
                    do {
                        try SafetyPolicy.validateScopedEntry(candidate.url, root: folder, rootSnapshot: rootSnapshot, includeSubfolders: includeSubfolders)
                        try SafetyPolicy.validateLocation(candidate.url, isDirectory: false)
                        guard SafetyPolicy.snapshot(try SafetyPolicy.metadata(candidate.url)) == candidate.snapshot else {
                            throw VirusScannerError.unavailable("A file changed before the scan.")
                        }
                        paths.append(candidate.url.path)
                    } catch {
                        report.skippedEntries += 1
                        hadIncompleteBatch = true
                    }
                }
                guard !paths.isEmpty else { continue }
                progress(VirusScanProgress(completed: offset - batch.count, total: candidates.count,
                                          message: "ClamAV is checking \(paths.count) files. Loading signatures can take a moment…"))
                let remainingOutput = max(0, maximumOutputBytes - report.rawOutput.utf8.count)
                let processOutput = try run(executable: engine.executableURL, arguments: arguments(paths: paths), cancellation: cancellation, outputLimit: remainingOutput)
                report.rawOutput += processOutput.text
                let parsed = VirusBatchSummary.parse(processOutput.text, allowedPaths: Set(paths))
                report.scannedFiles += parsed.scannedFiles ?? 0
                report.alertedFiles += parsed.alertedFiles ?? parsed.findings.count
                report.findings.append(contentsOf: parsed.findings)
                report.warnings.append(contentsOf: parsed.warnings.prefix(max(0, 80 - report.warnings.count)))
                for candidate in batch where paths.contains(candidate.url.path) {
                    do {
                        try SafetyPolicy.validateScopedEntry(candidate.url, root: folder, rootSnapshot: rootSnapshot, includeSubfolders: includeSubfolders)
                        try SafetyPolicy.validateLocation(candidate.url, isDirectory: false)
                        guard SafetyPolicy.snapshot(try SafetyPolicy.metadata(candidate.url)) == candidate.snapshot else {
                            throw VirusScannerError.unavailable("A file changed during the scan.")
                        }
                    } catch {
                        report.skippedEntries += 1
                        hadIncompleteBatch = true
                        if report.warnings.count < 80 { report.warnings.append("A file changed during scanning; check it again: \(candidate.url.path)") }
                    }
                }
                if !parsed.completedSuccessfully(exitCode: processOutput.exitCode, expectedFiles: paths.count,
                                                 cancelled: cancellation.isCancelled, outputTruncated: processOutput.truncated) {
                    hadIncompleteBatch = true
                    report.warnings.append("A ClamAV batch did not complete fully (exit \(processOutput.exitCode)). Check the report for missing/stale signatures, permissions, encrypted content or scan limits.")
                }
                if processOutput.truncated {
                    report.warnings.append("The 15 MB report limit was reached. Scanning stopped; choose a smaller folder.")
                    break
                }
                // An engine/setup error should not be repeated once per batch.
                if processOutput.exitCode != 0 && processOutput.exitCode != 1 { break }
                progress(VirusScanProgress(completed: offset, total: candidates.count, message: "Checked \(offset) of \(candidates.count) eligible files."))
            }
            if cancellation.isCancelled { report.outcome = .cancelled }
            else if hadIncompleteBatch { report.outcome = .incomplete }
            else if report.scannedFiles == 0 { report.outcome = .noFiles }
            else if report.alertedFiles > 0 { report.outcome = .detections }
            else { report.outcome = .noDetections }
        } catch {
            report.outcome = cancellation.isCancelled ? .cancelled : .incomplete
            report.warnings.append(error.localizedDescription)
        }
        report.finishedAt = Date()
        return report
    }

    private struct ProcessOutput {
        let text: String
        let exitCode: Int32
        let truncated: Bool
    }

    /// Called on a utility worker only. The main actor never waits for a process or pipe.
    private static func run(executable: URL, arguments: [String], cancellation: VirusScanCancellation,
                            outputLimit: Int) throws -> ProcessOutput {
        let child = Process()
        child.executableURL = executable
        child.arguments = arguments
        child.currentDirectoryURL = URL(fileURLWithPath: "/", isDirectory: true)
        var environment = ProcessInfo.processInfo.environment
        environment["LC_ALL"] = "C"
        environment["LANG"] = "C"
        child.environment = environment
        child.standardInput = FileHandle.nullDevice
        let pipe = Pipe()
        child.standardOutput = pipe
        child.standardError = pipe
        try cancellation.start(child)
        // Close the parent's write end so EOF arrives when the child finishes.
        try? pipe.fileHandleForWriting.close()
        defer {
            try? pipe.fileHandleForReading.close()
            cancellation.completed(child)
        }
        var bytes = Data()
        var truncated = false
        do {
            while let chunk = try pipe.fileHandleForReading.read(upToCount: 65_536), !chunk.isEmpty {
                let remaining = max(0, outputLimit - bytes.count)
                bytes.append(chunk.prefix(remaining))
                if chunk.count > remaining {
                    if !truncated {
                        truncated = true
                        cancellation.stopCurrentProcess()
                    }
                    // Continue draining, with bounded storage, to allow the child to exit.
                }
            }
        } catch {
            cancellation.stopCurrentProcess()
            child.waitUntilExit()
            throw error
        }
        child.waitUntilExit()
        return ProcessOutput(text: String(decoding: bytes, as: UTF8.self), exitCode: child.terminationStatus, truncated: truncated)
    }
}
