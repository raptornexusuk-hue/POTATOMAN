import Foundation
import AppKit

enum TrashService {
    private static let cleanupLock = NSLock()

    /// No permanent-deletion fallback. A failure to move to Trash leaves the original in place.
    /// Tests supply an operation that only records requests, so tests never use the user's Trash.
    static func clean(files: [ScannedFile], allFiles: [ScannedFile], roots: [ScanRoot], runningBrowserIDs: Set<String>, trashOperation: ((URL) throws -> Void)? = nil) -> CleanupResult {
        cleanupLock.lock()
        defer { cleanupLock.unlock() }
        var result = CleanupResult(trashedIDs: [], movedBytes: 0, failures: [])
        let selectedIDs = Set(files.map(\.id))
        let knownFiles = Dictionary(grouping: allFiles, by: \.id)
        let duplicateGroups = Dictionary(grouping: allFiles.filter { $0.duplicateGroup != nil }, by: { $0.duplicateGroup! })
        var attempted = Set<String>()
        let cancellation = CancellationFlag()

        for file in files {
            guard attempted.insert(file.id).inserted else { continue }
            do {
                guard let records = knownFiles[file.id], records.count == 1, records[0] == file else {
                    throw CleanseSafetyError.rejected("This selection does not match the current scan. Scan again.")
                }
                try SafetyPolicy.validateFile(file, roots: roots)
                try requireClosedBrowser(for: file, previouslyRunning: runningBrowserIDs)

                if let group = file.duplicateGroup {
                    let keepers = (duplicateGroups[group] ?? []).filter { !selectedIDs.contains($0.id) && !result.trashedIDs.contains($0.id) }
                    guard !keepers.isEmpty else {
                        throw CleanseSafetyError.rejected("Keep at least one unselected copy of this duplicate group.")
                    }
                    // Hash both sides again. A changed, missing, or replaced keeper is not protection.
                    let selectedDigest = try ScanEngine.digest(file: file, roots: roots, cancellation: cancellation)
                    guard selectedDigest == group else { throw CleanseSafetyError.rejected("The selected duplicate no longer matches its scan. Scan again.") }
                    var verifiedKeeper: ScannedFile?
                    for keeper in keepers {
                        do {
                            let keeperDigest = try ScanEngine.digest(file: keeper, roots: roots, cancellation: cancellation)
                            if keeperDigest == selectedDigest {
                                verifiedKeeper = keeper
                                break
                            }
                        } catch { continue }
                    }
                    guard let keeper = verifiedKeeper else {
                        throw CleanseSafetyError.rejected("No unchanged, identical retained copy could be verified. Scan again.")
                    }
                    try SafetyPolicy.validateFile(keeper, roots: roots)
                }

                // This is the last path check before the reversible OS operation. Foundation's
                // Trash API is pathname-based; no user-space check can eliminate every rename race.
                try requireClosedBrowser(for: file, previouslyRunning: runningBrowserIDs)
                try SafetyPolicy.validateFile(file, roots: roots)
                if let operation = trashOperation {
                    try operation(file.url)
                } else {
                    try FileManager.default.trashItem(at: file.url, resultingItemURL: nil)
                }
                result.trashedIDs.insert(file.id)
                result.movedBytes += file.allocatedBytes
            } catch {
                result.failures.append(CleanupFailure(path: file.url.path, reason: error.localizedDescription))
            }
        }
        return result
    }

    private static func requireClosedBrowser(for file: ScannedFile, previouslyRunning: Set<String>) throws {
        guard let browser = file.browser else { return }
        let runningNow = Set(NSWorkspace.shared.runningApplications.compactMap(\.bundleIdentifier))
        guard browser.bundleIdentifiers.allSatisfy({ !previouslyRunning.contains($0) && !runningNow.contains($0) }) else {
            throw CleanseSafetyError.rejected("Quit \(browser.rawValue) fully, then try again. Its cache may be in use.")
        }
    }
}
