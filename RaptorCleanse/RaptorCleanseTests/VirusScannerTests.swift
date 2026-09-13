import XCTest
import Foundation

final class VirusScannerTests: XCTestCase {
    private let samplePath = "/Users/test/Downloads/example.txt"

    private func summary(scanned: Int = 1, infected: Int = 0, errors: Int = 0, before: String = "") -> String {
        """
        \(before)
        ----------- SCAN SUMMARY -----------
        Known viruses: 9000000
        Engine version: test
        Scanned directories: 0
        Scanned files: \(scanned)
        Infected files: \(infected)
        Total errors: \(errors)
        Time: 1.00 sec (0 m 1 s)
        """
    }

    private func parse(_ text: String) -> VirusBatchSummary {
        VirusBatchSummary.parse(text, allowedPaths: [samplePath])
    }

    private func complete(_ parsed: VirusBatchSummary, exit: Int32 = 0, expected: Int = 1, cancelled: Bool = false, truncated: Bool = false) -> Bool {
        parsed.completedSuccessfully(exitCode: exit, expectedFiles: expected, cancelled: cancelled, outputTruncated: truncated)
    }

    func testZeroExitRequiresCompleteSummaryAndExpectedCount() {
        XCTAssertTrue(complete(parse(summary())))
        XCTAssertFalse(complete(parse("ClamAV engine ready")))
        XCTAssertFalse(complete(parse(summary(scanned: 1)), expected: 2))
    }

    func testDetectionExitPreservesFinding() {
        let parsed = parse(summary(infected: 1, before: "\(samplePath): Test.Signature FOUND"))
        XCTAssertTrue(complete(parsed, exit: 1))
        XCTAssertEqual(parsed.findings.first?.path, samplePath)
        XCTAssertEqual(parsed.findings.first?.signature, "Test.Signature")
    }

    func testErrorExitCannotBeCleanEvenWithNominalSummary() {
        XCTAssertFalse(complete(parse(summary()), exit: 2))
        XCTAssertFalse(complete(parse(summary()), exit: 15))
    }

    func testMissingDatabaseDoesNotMasqueradeAsNoDetections() {
        let parsed = parse("LibClamAV Error: cli_loaddbdir: No supported database files found\nERROR: Can't open file or directory")
        XCTAssertFalse(complete(parsed, exit: 2))
        XCTAssertNil(parsed.scannedFiles)
        XCTAssertEqual(parsed.warnings.count, 2)
    }

    func testCancelledOrTruncatedResultsNeverComplete() {
        let parsed = parse(summary())
        XCTAssertFalse(complete(parsed, cancelled: true))
        XCTAssertFalse(complete(parsed, truncated: true))
    }

    func testEmptyScanDoesNotProduceCleanVerdict() {
        XCTAssertFalse(complete(parse(summary(scanned: 0)), expected: 0))
    }

    func testPermissionErrorsAndWarningsMarkPartialCoverage() {
        XCTAssertFalse(complete(parse(summary(errors: 1))))
        XCTAssertFalse(complete(parse(summary(before: "\(samplePath): Permission denied ERROR"))))
        XCTAssertFalse(complete(parse(summary(before: "LibClamAV Warning: database too old"))))
    }

    func testEncryptedAndLimitAlertsAreCoverageAlerts() {
        for signature in ["Heuristics.Encrypted.Zip", "Heuristics.Limits.Exceeded.MaxFileSize"] {
            let parsed = parse(summary(infected: 1, before: "\(samplePath): \(signature) FOUND"))
            XCTAssertTrue(parsed.hasCoverageAlerts)
            XCTAssertFalse(complete(parsed, exit: 1))
        }
    }

    func testMissingOrUnscopedDetectionDetailsAreIncomplete() {
        XCTAssertFalse(complete(parse(summary(infected: 1)), exit: 1))
        let parsed = parse(summary(infected: 1, before: "/outside/folder/file: Test.Signature FOUND"))
        XCTAssertTrue(parsed.findings.isEmpty)
        XCTAssertFalse(complete(parsed, exit: 1))
    }

    func testSummaryNumbersOutsideDelimiterCannotForgeCompletion() {
        let parsed = parse("Scanned files: 1\nInfected files: 0")
        XCTAssertFalse(parsed.hasSummary)
        XCTAssertNil(parsed.scannedFiles)
        XCTAssertFalse(complete(parsed))
    }

    func testArgumentsKeepLiteralFilenamesAndNeverEnableMutationOrTraversal() {
        let unusual = "/Users/test/Downloads/$(touch surprise); file.txt"
        let arguments = VirusScanner.arguments(paths: [unusual])
        XCTAssertEqual(arguments.last, unusual)
        XCTAssertEqual(arguments[arguments.count - 2], "--")
        XCTAssertTrue(arguments.contains("--recursive=no"))
        XCTAssertTrue(arguments.contains("--follow-file-symlinks=0"))
        XCTAssertTrue(arguments.contains("--follow-dir-symlinks=0"))
        XCTAssertTrue(arguments.contains("--fail-if-cvd-older-than=7"))
        XCTAssertFalse(arguments.contains { $0.hasPrefix("--remove") || $0.hasPrefix("--move") || $0.hasPrefix("--copy") })
    }

    func testCancellationBeforeLaunchPreventsChildStarting() {
        let token = VirusScanCancellation()
        token.cancel()
        let process = Process()
        XCTAssertThrowsError(try token.start(process)) { error in XCTAssertTrue(error is CancellationError) }
        XCTAssertFalse(process.isRunning)
    }
}

/// The engine's version line is the only place the database date is available
/// before a scan runs, and reading it wrong means either nagging about fresh
/// definitions or staying quiet about stale ones.
extension VirusScannerTests {
    func testVersionLineWithDatabaseYieldsSignaturesAndDate() {
        let parsed = VirusScanner.parseVersionLine("ClamAV 1.4.1/27500/Thu Jan 30 09:00:00 2025")
        XCTAssertEqual(parsed.signatures, 27_500)
        XCTAssertNotNil(parsed.date)
        var components = DateComponents()
        components.year = 2025; components.month = 1; components.day = 30
        components.hour = 9; components.minute = 0; components.second = 0
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        XCTAssertEqual(parsed.date, calendar.date(from: components))
    }

    func testVersionLineWithoutDatabaseYieldsNothing() {
        // What a fresh install prints before freshclam has ever run.
        let parsed = VirusScanner.parseVersionLine("ClamAV 1.4.1")
        XCTAssertNil(parsed.signatures)
        XCTAssertNil(parsed.date)
    }

    func testUnparsableDateDoesNotInventOne() {
        let parsed = VirusScanner.parseVersionLine("ClamAV 1.4.1/27500/not a date")
        XCTAssertEqual(parsed.signatures, 27_500)
        XCTAssertNil(parsed.date)
    }

    func testEngineWithNoDatabaseCountsAsStale() {
        let engine = VirusEngine(executableURL: URL(fileURLWithPath: "/opt/homebrew/bin/clamscan"),
                                 version: "ClamAV 1.4.1")
        XCTAssertFalse(engine.hasDefinitions)
        XCTAssertTrue(engine.definitionsAreStale)
        XCTAssertNil(engine.definitionsAgeInDays)
    }

    func testFreshDatabaseIsNotStaleAndOldOneIs() {
        let fresh = VirusEngine(executableURL: URL(fileURLWithPath: "/opt/homebrew/bin/clamscan"),
                                version: "ClamAV 1.4.1", signatureCount: 100,
                                databaseDate: Date().addingTimeInterval(-2 * 86_400))
        XCTAssertTrue(fresh.hasDefinitions)
        XCTAssertFalse(fresh.definitionsAreStale)

        let stale = VirusEngine(executableURL: URL(fileURLWithPath: "/opt/homebrew/bin/clamscan"),
                                version: "ClamAV 1.4.1", signatureCount: 100,
                                databaseDate: Date().addingTimeInterval(-30 * 86_400))
        XCTAssertTrue(stale.definitionsAreStale)
        XCTAssertEqual(stale.definitionsAgeInDays, 30)
    }

    /// The seven-day refusal is the default, and relaxing it must be a visible,
    /// deliberate change to the command rather than something that drifts.
    func testStaleOverrideChangesOnlyTheAgeBound() {
        let strict = VirusScanner.arguments(paths: ["/tmp/a"])
        let relaxed = VirusScanner.arguments(paths: ["/tmp/a"], allowStaleDefinitions: true)
        XCTAssertTrue(strict.contains("--fail-if-cvd-older-than=7"))
        XCTAssertTrue(relaxed.contains("--fail-if-cvd-older-than=3650"))
        XCTAssertEqual(strict.count, relaxed.count)
        XCTAssertTrue(relaxed.contains("--official-db-only=yes"))
        // Still nothing that could remove or quarantine a file.
        for argument in relaxed {
            XCTAssertFalse(argument.contains("--remove"))
            XCTAssertFalse(argument.contains("--move"))
            XCTAssertFalse(argument.contains("--copy"))
        }
    }
}
