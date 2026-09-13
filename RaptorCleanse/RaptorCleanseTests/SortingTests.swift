import Foundation
import XCTest

/// Folder review ordering. These build `ScannedFile` values directly and touch
/// no filesystem: ordering is a pure function of the list and the chosen order.
final class SortingTests: XCTestCase {
    private func file(_ name: String, bytes: Int64, secondsAgo: TimeInterval, group: String? = nil) -> ScannedFile {
        let url = URL(fileURLWithPath: "/Users/test/Downloads/\(name)")
        let modified = Date(timeIntervalSince1970: 1_700_000_000 - secondsAgo)
        let snapshot = FileSnapshot(device: 1, inode: UInt64(abs(name.hashValue % 100_000)), byteCount: bytes,
                                    modifiedSeconds: Int64(modified.timeIntervalSince1970), modifiedNanoseconds: 0)
        return ScannedFile(url: url, rootID: UUID(), byteCount: bytes, allocatedBytes: bytes,
                           modifiedAt: modified, snapshot: snapshot, browser: nil, duplicateGroup: group)
    }

    private var sample: [ScannedFile] {
        [file("banana.txt", bytes: 300, secondsAgo: 10),
         file("apple.txt", bytes: 100, secondsAgo: 30),
         file("cherry.txt", bytes: 200, secondsAgo: 20)]
    }

    func testLargestFirstOrdersBySizeDescending() {
        let names = CleanseSorting.sorted(sample, order: .largestFirst).map(\.name)
        XCTAssertEqual(names, ["banana.txt", "cherry.txt", "apple.txt"])
    }

    func testSmallestFirstOrdersBySizeAscending() {
        let names = CleanseSorting.sorted(sample, order: .smallestFirst).map(\.name)
        XCTAssertEqual(names, ["apple.txt", "cherry.txt", "banana.txt"])
    }

    func testNewestFirstOrdersByModificationDateDescending() {
        let names = CleanseSorting.sorted(sample, order: .newestFirst).map(\.name)
        XCTAssertEqual(names, ["banana.txt", "cherry.txt", "apple.txt"])
    }

    func testOldestFirstOrdersByModificationDateAscending() {
        let names = CleanseSorting.sorted(sample, order: .oldestFirst).map(\.name)
        XCTAssertEqual(names, ["apple.txt", "cherry.txt", "banana.txt"])
    }

    func testNameOrderIsAlphabeticalRegardlessOfSize() {
        let names = CleanseSorting.sorted(sample, order: .nameAscending).map(\.name)
        XCTAssertEqual(names, ["apple.txt", "banana.txt", "cherry.txt"])
    }

    /// Swift's sort is not stable, so equal keys must still produce one fixed
    /// order or the list would reshuffle between redraws.
    func testEqualKeysFallBackToThePathSoOrderIsDeterministic() {
        let files = [file("zebra.txt", bytes: 500, secondsAgo: 1),
                     file("alpha.txt", bytes: 500, secondsAgo: 1),
                     file("mango.txt", bytes: 500, secondsAgo: 1)]
        let first = CleanseSorting.sorted(files, order: .largestFirst).map(\.id)
        let second = CleanseSorting.sorted(files.reversed(), order: .largestFirst).map(\.id)
        XCTAssertEqual(first, second)
        XCTAssertEqual(first, files.map(\.id).sorted())
    }

    func testEveryOrderReturnsEveryFileExactlyOnce() {
        for order in CleanseSortOrder.allCases {
            let sorted = CleanseSorting.sorted(sample, order: order)
            XCTAssertEqual(Set(sorted.map(\.id)), Set(sample.map(\.id)), "\(order) lost or duplicated a file")
            XCTAssertEqual(sorted.count, sample.count)
        }
    }

    func testDuplicateGroupingKeepsMatchingCopiesAdjacent() {
        let files = [file("big-unique.bin", bytes: 900, secondsAgo: 5),
                     file("copy-a.txt", bytes: 400, secondsAgo: 5, group: "hash-a"),
                     file("other.bin", bytes: 600, secondsAgo: 5),
                     file("copy-b.txt", bytes: 400, secondsAgo: 5, group: "hash-a")]
        let sorted = CleanseSorting.sorted(files, order: .largestFirst, groupingDuplicates: true)
        let names = sorted.map(\.name)
        let firstCopy = try? XCTUnwrap(names.firstIndex(of: "copy-a.txt"))
        let secondCopy = try? XCTUnwrap(names.firstIndex(of: "copy-b.txt"))
        XCTAssertNotNil(firstCopy)
        XCTAssertNotNil(secondCopy)
        if let firstCopy, let secondCopy {
            XCTAssertEqual(abs(firstCopy - secondCopy), 1, "matching copies must stay next to each other")
        }
        XCTAssertEqual(sorted.count, files.count)
    }

    /// Grouping ranks groups by their best-placed member, so the chosen order
    /// still decides which group appears first.
    func testGroupOrderFollowsTheChosenOrder() {
        let files = [file("small-copy-a.txt", bytes: 100, secondsAgo: 5, group: "hash-small"),
                     file("small-copy-b.txt", bytes: 100, secondsAgo: 5, group: "hash-small"),
                     file("large-copy-a.bin", bytes: 800, secondsAgo: 5, group: "hash-large"),
                     file("large-copy-b.bin", bytes: 800, secondsAgo: 5, group: "hash-large")]
        let largest = CleanseSorting.sorted(files, order: .largestFirst, groupingDuplicates: true).map(\.name)
        XCTAssertEqual(largest.first, "large-copy-a.bin")
        let smallest = CleanseSorting.sorted(files, order: .smallestFirst, groupingDuplicates: true).map(\.name)
        XCTAssertEqual(smallest.first, "small-copy-a.txt")
    }

    func testSortingAnEmptyListIsEmpty() {
        XCTAssertTrue(CleanseSorting.sorted([], order: .largestFirst).isEmpty)
        XCTAssertTrue(CleanseSorting.sorted([], order: .nameAscending, groupingDuplicates: true).isEmpty)
    }

    /// The stored preference is a raw string; an unknown value must not decode.
    func testSortOrderRoundTripsThroughItsStoredValue() {
        for order in CleanseSortOrder.allCases {
            XCTAssertEqual(CleanseSortOrder(rawValue: order.rawValue), order)
            XCTAssertFalse(order.title.isEmpty)
            XCTAssertFalse(order.symbol.isEmpty)
        }
        XCTAssertNil(CleanseSortOrder(rawValue: "notAnOrder"))
    }
}
