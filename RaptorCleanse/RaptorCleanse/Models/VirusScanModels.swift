import Foundation

struct VirusEngine: Sendable {
    let executableURL: URL
    let version: String
}

struct VirusScanProgress: Sendable {
    let completed: Int
    let total: Int
    let message: String
}

struct VirusFinding: Identifiable, Sendable {
    let id = UUID()
    let path: String
    let signature: String
    var isCoverageAlert: Bool {
        signature.hasPrefix("Heuristics.Limits.") || signature.hasPrefix("Heuristics.Encrypted.")
    }
}

enum VirusScanOutcome: String, Sendable {
    case noDetections = "No detections in scanned files"
    case detections = "ClamAV alerts need review"
    case incomplete = "Scan incomplete"
    case cancelled = "Scan cancelled"
    case noFiles = "No eligible files scanned"
}

struct VirusScanReport: Sendable {
    let folder: URL
    let includedSubfolders: Bool
    let engineVersion: String
    let startedAt: Date
    var finishedAt = Date()
    var scannedFiles = 0
    var alertedFiles = 0
    var skippedEntries = 0
    var findings: [VirusFinding] = []
    var warnings: [String] = []
    var outcome: VirusScanOutcome = .incomplete
    var rawOutput = ""

    var exportText: String {
        """
        \(Brand.name) — on-demand virus scan
        Produced by: \(Brand.fullVersion)
        Result: \(outcome.rawValue)
        Folder: \(folder.path)
        Include subfolders: \(includedSubfolders ? "Yes" : "No")
        Engine: \(engineVersion)
        Started: \(startedAt)
        Finished: \(finishedAt)
        Scanned files reported by ClamAV: \(scannedFiles)
        Files with ClamAV alerts: \(alertedFiles)
        Entries skipped: \(skippedEntries)

        This result covers eligible files in the selected folder only. It is not a whole-Mac health verdict or continuous protection. Files were not removed or quarantined. Encrypted content and scan limits can produce coverage alerts rather than malware detections.

        Warnings:
        \(warnings.isEmpty ? "None reported." : warnings.joined(separator: "\n"))

        ClamAV output:
        \(rawOutput)
        """
    }
}

/// ClamAV exits 0 for no detections, 1 for detections, and 2 for errors.
/// A successful exit alone is never accepted as proof of a completed scan.
struct VirusBatchSummary: Sendable {
    var scannedFiles: Int?
    var alertedFiles: Int?
    var totalErrors = 0
    var findings: [VirusFinding] = []
    var warnings: [String] = []
    var hasSummary = false

    var hasCoverageAlerts: Bool { findings.contains { $0.isCoverageAlert } }

    static func parse(_ output: String, allowedPaths: Set<String>) -> VirusBatchSummary {
        var value = VirusBatchSummary()
        // Only parse totals after ClamAV's delimiter. Filenames cannot forge a summary.
        var inSummary = false
        for rawLine in output.split(separator: "\n", omittingEmptySubsequences: false) {
            let line = String(rawLine).trimmingCharacters(in: .whitespacesAndNewlines)
            if line == "----------- SCAN SUMMARY -----------" {
                inSummary = true
                value.hasSummary = true
                continue
            }
            if inSummary {
                if line.hasPrefix("Scanned files:") { value.scannedFiles = integer(after: "Scanned files:", in: line) }
                if line.hasPrefix("Infected files:") { value.alertedFiles = integer(after: "Infected files:", in: line) }
                if line.hasPrefix("Total errors:") { value.totalErrors = integer(after: "Total errors:", in: line) ?? 1 }
            }
            if line.hasSuffix(" FOUND"), let split = line.range(of: ": ", options: .backwards) {
                let path = String(line[..<split.lowerBound])
                let signature = String(line[split.upperBound...].dropLast(6))
                if allowedPaths.contains(path), !signature.isEmpty {
                    value.findings.append(VirusFinding(path: path, signature: signature))
                }
            }
            if line.hasPrefix("WARNING:") || line.hasPrefix("ERROR:") || line.hasPrefix("LibClamAV Warning:") || line.hasPrefix("LibClamAV Error:") || line.hasSuffix(" ERROR") {
                if value.warnings.count < 80 { value.warnings.append(line) }
            }
        }
        return value
    }

    private static func integer(after prefix: String, in line: String) -> Int? {
        let text = line.dropFirst(prefix.count).trimmingCharacters(in: .whitespaces)
        guard let result = Int(text), result >= 0 else { return nil }
        return result
    }

    func completedSuccessfully(exitCode: Int32, expectedFiles: Int, cancelled: Bool, outputTruncated: Bool) -> Bool {
        guard !cancelled, !outputTruncated, [0, 1].contains(exitCode), hasSummary,
              let scannedFiles, let alertedFiles, scannedFiles == expectedFiles, scannedFiles > 0,
              totalErrors == 0, warnings.isEmpty, !hasCoverageAlerts else { return false }
        // A detection exit without matching alert details is incomplete, not silently clean.
        if exitCode == 0 { return alertedFiles == 0 && findings.isEmpty }
        return alertedFiles > 0 && Set(findings.map { $0.path }).count == alertedFiles
    }
}
