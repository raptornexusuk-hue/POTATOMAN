import Foundation
import CryptoKit
import Darwin

enum ScanEngine {
    static func scan(roots: [ScanRoot], options: ScanOptions, cancellation: CancellationFlag, progress: @escaping @Sendable (ScanProgress) -> Void) -> ScanResult {
        let manager = FileManager.default
        var files: [ScannedFile] = []
        var warnings: [String] = []
        var skipped = 0
        var visited = 0
        var identities = Set<String>()
        var paths = Set<String>()
        var acceptedRoots: [ScanRoot] = []
        let maximum = max(1, min(50_000, options.maximumFiles))
        let minimumCacheAge = TimeInterval(max(24, options.minimumCacheAgeHours)) * 3_600
        let referenceDate = Date()
        var hitLimit = false

        func warn(_ message: String) {
            if warnings.count < 100 { warnings.append(message) }
        }

        // Visit shallower roots first so overlap cannot duplicate a result or assign it ambiguously.
        for root in roots.sorted(by: { $0.url.pathComponents.count < $1.url.pathComponents.count }) {
            if cancellation.isCancelled || hitLimit { break }
            if acceptedRoots.contains(where: { $0.url.standardizedFileURL == root.url.standardizedFileURL || (options.includeSubfolders && SafetyPolicy.isStrictDescendant(root.url, of: $0.url)) }) { continue }
            let rootSnapshot: FileSnapshot
            do {
                try SafetyPolicy.validateRoot(root.url)
                rootSnapshot = SafetyPolicy.snapshot(try SafetyPolicy.metadata(root.url))
                acceptedRoots.append(root)
            } catch {
                warn("Skipped \(root.url.path): \(error.localizedDescription)")
                skipped += 1
                continue
            }

            var enumerationOptions: FileManager.DirectoryEnumerationOptions = [.skipsPackageDescendants]
            if !options.includeSubfolders { enumerationOptions.insert(.skipsSubdirectoryDescendants) }
            guard let enumerator = manager.enumerator(at: root.url, includingPropertiesForKeys: [.isDirectoryKey, .isSymbolicLinkKey, .isRegularFileKey, .isPackageKey, .isAliasFileKey, .isUbiquitousItemKey, .totalFileAllocatedSizeKey, .fileAllocatedSizeKey], options: enumerationOptions, errorHandler: { url, error in
                warn("Could not read \(url.path): \(error.localizedDescription)")
                skipped += 1
                return !cancellation.isCancelled
            }) else {
                warn("Could not enumerate \(root.url.path). Check its folder permission.")
                continue
            }

            while let entry = enumerator.nextObject() as? URL {
                if cancellation.isCancelled { break }
                if visited >= maximum {
                    hitLimit = true
                    warnings.insert("Stopped after \(maximum) filesystem entries. Review these results, then scan a smaller folder for the remainder.", at: 0)
                    break
                }
                visited += 1
                if visited == 1 || visited % 50 == 0 {
                    progress(ScanProgress(visitedCount: visited, foundCount: files.count, message: "Scanning \(entry.deletingLastPathComponent().lastPathComponent)…"))
                }
                // Extremely deep directory structures are not useful cleanup targets.
                if entry.pathComponents.count - root.url.pathComponents.count > 64 {
                    enumerator.skipDescendants()
                    skipped += 1
                    continue
                }
                do {
                    try SafetyPolicy.validateScopedEntry(entry, root: root.url, rootSnapshot: rootSnapshot, includeSubfolders: options.includeSubfolders)
                    let info = try SafetyPolicy.metadata(entry)
                    let type = info.st_mode & S_IFMT
                    if type == S_IFDIR {
                        try SafetyPolicy.validateLocation(entry, isDirectory: true)
                        continue
                    }
                    guard type == S_IFREG else {
                        enumerator.skipDescendants()
                        skipped += 1
                        continue
                    }
                    try SafetyPolicy.validateLocation(entry, isDirectory: false)
                    try SafetyPolicy.validateScopedEntry(entry, root: root.url, rootSnapshot: rootSnapshot, includeSubfolders: options.includeSubfolders)
                    let currentInfo = try SafetyPolicy.metadata(entry)
                    let fileSnapshot = SafetyPolicy.snapshot(currentInfo)
                    guard (currentInfo.st_mode & S_IFMT) == S_IFREG, fileSnapshot == SafetyPolicy.snapshot(info) else {
                        throw CleanseSafetyError.rejected("The file changed during enumeration.")
                    }
                    let browser = SafetyPolicy.browserCacheKind(for: entry)
                    let modified = Date(timeIntervalSince1970: TimeInterval(fileSnapshot.modifiedSeconds) + TimeInterval(fileSnapshot.modifiedNanoseconds) / 1_000_000_000)
                    if browser != nil && referenceDate.timeIntervalSince(modified) < minimumCacheAge { skipped += 1; continue }
                    let identity = "\(fileSnapshot.device):\(fileSnapshot.inode)"
                    guard !identities.contains(identity), !paths.contains(entry.standardizedFileURL.path) else { continue }
                    let allocation = try entry.resourceValues(forKeys: [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey])
                    let bytes = max(0, fileSnapshot.byteCount)
                    let allocated = max(0, Int64(allocation.totalFileAllocatedSize ?? allocation.fileAllocatedSize ?? Int(bytes)))
                    files.append(ScannedFile(url: entry.standardizedFileURL, rootID: root.id, byteCount: bytes, allocatedBytes: allocated, modifiedAt: modified, snapshot: fileSnapshot, browser: browser, duplicateGroup: nil))
                    identities.insert(identity)
                    paths.insert(entry.standardizedFileURL.path)
                } catch {
                    enumerator.skipDescendants()
                    skipped += 1
                    // Expected policy exclusions are counted; I/O failures remain actionable warnings.
                    if !(error is CleanseSafetyError) { warn("Skipped \(entry.path): \(error.localizedDescription)") }
                }
            }
        }

        if options.detectDuplicates && !cancellation.isCancelled {
            let sizeGroups = Dictionary(grouping: files.indices.filter { files[$0].byteCount > 0 }, by: { files[$0].byteCount })
            var hashedCount = 0
            for indices in sizeGroups.values where indices.count > 1 {
                if cancellation.isCancelled { break }
                var hashes: [String: [Int]] = [:]
                for index in indices {
                    if cancellation.isCancelled { break }
                    do {
                        let hash = try digest(file: files[index], roots: roots, cancellation: cancellation)
                        hashes[hash, default: []].append(index)
                    } catch {
                        if !cancellation.isCancelled { warn("Could not compare \(files[index].url.path): \(error.localizedDescription)") }
                    }
                    hashedCount += 1
                    if hashedCount == 1 || hashedCount % 10 == 0 {
                        progress(ScanProgress(visitedCount: visited, foundCount: files.count, message: "Comparing file contents: \(hashedCount) checked…"))
                    }
                }
                if cancellation.isCancelled { break }
                for (hash, matching) in hashes where matching.count > 1 {
                    for index in matching { files[index].duplicateGroup = hash }
                }
            }
        }
        let completionMessage = cancellation.isCancelled ? "Scan stopped. Partial results retained." : (hitLimit ? "Entry limit reached. Partial results retained." : "Scan complete.")
        progress(ScanProgress(visitedCount: visited, foundCount: files.count, message: completionMessage))
        return ScanResult(files: files.sorted { $0.byteCount > $1.byteCount }, warnings: warnings, skippedCount: skipped, wasCancelled: cancellation.isCancelled)
    }

    /// Stream through a no-follow descriptor; verify both the opened inode and its pathname.
    static func digest(file: ScannedFile, roots: [ScanRoot], cancellation: CancellationFlag) throws -> String {
        if cancellation.isCancelled { throw CleanseSafetyError.rejected("Comparison cancelled.") }
        try SafetyPolicy.validateFile(file, roots: roots)
        let descriptor = file.url.withUnsafeFileSystemRepresentation { path -> Int32 in
            guard let path = path else { return -1 }
            return Darwin.open(path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC)
        }
        guard descriptor >= 0 else { throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno)) }
        defer { Darwin.close(descriptor) }
        var opened = stat()
        guard fstat(descriptor, &opened) == 0, (opened.st_mode & S_IFMT) == S_IFREG, SafetyPolicy.snapshot(opened) == file.snapshot else {
            throw CleanseSafetyError.rejected("The file changed before comparison.")
        }
        var hasher = SHA256()
        var buffer = [UInt8](repeating: 0, count: 1_048_576)
        var totalRead: Int64 = 0
        while true {
            if cancellation.isCancelled { throw CleanseSafetyError.rejected("Comparison cancelled.") }
            let count = buffer.withUnsafeMutableBytes { raw in Darwin.read(descriptor, raw.baseAddress!, raw.count) }
            if count == 0 { break }
            if count < 0 {
                if errno == EINTR { continue }
                throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno))
            }
            totalRead += Int64(count)
            guard totalRead <= file.byteCount else { throw CleanseSafetyError.rejected("The file grew during comparison.") }
            hasher.update(data: Data(buffer.prefix(count)))
        }
        var final = stat()
        guard totalRead == file.byteCount, fstat(descriptor, &final) == 0, SafetyPolicy.snapshot(final) == file.snapshot else {
            throw CleanseSafetyError.rejected("The file changed during comparison.")
        }
        try SafetyPolicy.validateFile(file, roots: roots)
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }
}
