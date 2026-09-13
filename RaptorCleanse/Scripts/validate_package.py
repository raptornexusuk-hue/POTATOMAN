#!/usr/bin/env python3
"""Check what can be checked without a Mac, and say plainly what it does not cover.

    python3 Scripts/validate_package.py

This is not a build. The authoring environment has no Xcode, macOS SDK or Swift
compiler, so native compilation, XCTest execution, UI rendering and real ClamAV
scans are only possible on your Mac. What this script does verify:

  * every Swift file parses (tree-sitter Swift — syntax only, not type checking),
  * the generated Xcode project references every source that exists on disk,
    and every source it references exists,
  * the asset catalogs declare exactly the files present, at the right pixel
    dimensions for every macOS icon slot,
  * the entitlements and privacy manifest are valid property lists,
  * the shared scheme is well-formed XML whose target identifiers resolve,
  * no Swift source hard-codes a version string, which is how the sidebar,
    settings page and diagnostics export previously drifted apart.

Exit status is non-zero if any check fails.
"""
from pathlib import Path
import json
import plistlib
import re
import subprocess
import sys
import xml.etree.ElementTree as ElementTree

ROOT = Path(__file__).resolve().parents[1]
failures: list[str] = []
notes: list[str] = []


def report(name: str, ok: bool, detail: str) -> None:
    print(f"{'PASS' if ok else 'FAIL'}  {name}: {detail}")
    if not ok:
        failures.append(name)


def check_swift_syntax() -> None:
    try:
        from tree_sitter import Language, Parser
        import tree_sitter_swift
    except ImportError:
        notes.append("Swift syntax parsing skipped: pip install tree_sitter tree_sitter_swift")
        print("SKIP  Swift syntax: tree-sitter-swift not installed")
        return
    parser = Parser(Language(tree_sitter_swift.language()))
    files = sorted(ROOT.rglob("*.swift"))
    broken = []
    for path in files:
        tree = parser.parse(path.read_bytes())
        stack = [tree.root_node]
        while stack:
            node = stack.pop()
            if node.type == "ERROR" or node.is_missing:
                broken.append(f"{path.relative_to(ROOT)}:{node.start_point[0] + 1}")
                break
            stack.extend(node.children)
    report("Swift syntax", not broken, f"{len(files)} files parsed" + (f"; errors at {broken}" if broken else ", no syntax errors"))


def check_project() -> None:
    project = ROOT / "RaptorCleanse.xcodeproj" / "project.pbxproj"
    if not project.exists():
        report("Xcode project", False, "project.pbxproj is missing; run Scripts/generate_project.py")
        return
    text = project.read_text()
    objects = len(re.findall(r'"isa" = "', text))

    referenced = set(re.findall(r'"path" = "([^"]+\.swift)"', text))
    on_disk = {
        str(path.relative_to(ROOT / "RaptorCleanse")) for path in (ROOT / "RaptorCleanse").rglob("*.swift")
    } | {
        path.name for path in (ROOT / "RaptorCleanseTests").rglob("*.swift")
    }
    missing = sorted(referenced - on_disk)
    unreferenced = sorted(on_disk - referenced)
    report("Project source references", not missing and not unreferenced,
           f"{objects} objects, {len(referenced)} Swift references"
           + (f"; referenced but absent: {missing}" if missing else "")
           + (f"; on disk but not in the project: {unreferenced}" if unreferenced else ""))

    for resource in ["Assets.xcassets", "PrivacyInfo.xcprivacy", "RaptorCleanse.entitlements"]:
        report(f"Project resource {resource}", f'"path" = "{resource}"' in text, "referenced")


def check_asset_catalogs() -> None:
    try:
        from PIL import Image
    except ImportError:
        Image = None
        notes.append("Icon dimension checks skipped: pip install Pillow")

    for catalog in sorted((ROOT / "RaptorCleanse" / "Assets.xcassets").glob("*.*set")):
        meta = json.loads((catalog / "Contents.json").read_text())
        declared = {entry["filename"] for entry in meta["images"]}
        present = {path.name for path in catalog.glob("*.png")}
        report(f"Asset catalog {catalog.name}", declared == present,
               f"{len(declared)} declared, {len(present)} present"
               + (f"; missing {sorted(declared - present)}" if declared - present else "")
               + (f"; undeclared {sorted(present - declared)}" if present - declared else ""))

        if Image is None or catalog.name != "AppIcon.appiconset":
            continue
        wrong = []
        for entry in meta["images"]:
            expected = int(entry["size"].split("x")[0]) * int(entry["scale"][0])
            actual = Image.open(catalog / entry["filename"]).size
            if actual != (expected, expected):
                wrong.append(f"{entry['filename']} is {actual}, expected {expected}px")
        report("App icon dimensions", not wrong, f"{len(meta['images'])} macOS slots" + (f"; {wrong}" if wrong else " correct"))

        transparent = []
        for entry in meta["images"]:
            image = Image.open(catalog / entry["filename"]).convert("RGBA")
            if image.getpixel((0, 0))[3] != 0:
                transparent.append(entry["filename"])
        report("App icon shape", not transparent,
               "corners are transparent, so macOS shows an icon shape rather than a square"
               if not transparent else f"opaque corners in {transparent}")


def check_plists() -> None:
    for name in ["RaptorCleanse/RaptorCleanse.entitlements", "RaptorCleanse/PrivacyInfo.xcprivacy"]:
        try:
            with (ROOT / name).open("rb") as handle:
                plistlib.load(handle)
            report(f"Property list {Path(name).name}", True, "parsed")
        except Exception as error:  # noqa: BLE001 - the message is the report
            report(f"Property list {Path(name).name}", False, str(error))


def check_scheme() -> None:
    scheme = ROOT / "RaptorCleanse.xcodeproj/xcshareddata/xcschemes/RaptorCleanse.xcscheme"
    try:
        tree = ElementTree.parse(scheme)
    except Exception as error:  # noqa: BLE001
        report("Shared scheme", False, str(error))
        return
    identifiers = {node.get("BlueprintIdentifier") for node in tree.iter("BuildableReference")}
    project = (ROOT / "RaptorCleanse.xcodeproj" / "project.pbxproj").read_text()
    unresolved = sorted(i for i in identifiers if i and i not in project)
    report("Shared scheme", not unresolved,
           f"{len(identifiers)} target references" + (f"; unresolved {unresolved}" if unresolved else " resolve"))


def check_version_single_source() -> None:
    """A literal version in Swift is what let four places disagree before."""
    pattern = re.compile(r'"[^"]*\bv?\d+\.\d+\.\d+[^"]*"')
    offenders = []
    for path in sorted((ROOT / "RaptorCleanse").rglob("*.swift")):
        if path.name == "Brand.swift":
            continue
        for number, line in enumerate(path.read_text().splitlines(), start=1):
            if "http" in line:
                continue
            if pattern.search(line):
                offenders.append(f"{path.relative_to(ROOT)}:{number}")
    report("Version single source", not offenders,
           "no Swift source outside Brand.swift spells a version"
           if not offenders else f"hard-coded version strings at {offenders}")


def check_build_script() -> None:
    script = ROOT / "Build-and-Test.command"
    result = subprocess.run(["bash", "-n", str(script)], capture_output=True, text=True)
    report("Build-and-Test.command", result.returncode == 0, result.stderr.strip() or "bash syntax check passed")


def main() -> int:
    print(f"Validating {ROOT.name}\n")
    check_swift_syntax()
    check_project()
    check_asset_catalogs()
    check_plists()
    check_scheme()
    check_version_single_source()
    check_build_script()
    print()
    for note in notes:
        print(f"NOTE  {note}")
    print("\nNot covered here: Swift type checking, native compilation, XCTest execution,")
    print("UI rendering, macOS permission prompts and real ClamAV scans. Run those on your Mac.")
    if failures:
        print(f"\n{len(failures)} check(s) failed: {', '.join(failures)}")
        return 1
    print("\nAll checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
