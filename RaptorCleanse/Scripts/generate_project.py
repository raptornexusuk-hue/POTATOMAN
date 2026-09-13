#!/usr/bin/env python3
"""Regenerate the dependency-free Xcode project. Python 3; no external packages."""
from pathlib import Path
import hashlib
import json
import plistlib

ROOT = Path(__file__).resolve().parents[1]
objects = {}

def ident(name):
    return hashlib.sha256(name.encode()).hexdigest()[:24].upper()

def obj(object_name, isa, **fields):
    key = ident(object_name)
    objects[key] = dict(isa=isa, **fields)
    return key

def serialize(value, depth=0):
    indent = "\t" * depth
    if isinstance(value, dict):
        return "{\n" + "".join(indent + "\t" + json.dumps(k) + " = " + serialize(v, depth + 1) + ";\n" for k, v in value.items()) + indent + "}"
    if isinstance(value, list):
        return "(\n" + "".join(indent + "\t" + serialize(v, depth + 1) + ",\n" for v in value) + indent + ")"
    if isinstance(value, int):
        return str(value)
    return json.dumps(value, ensure_ascii=False)

sources = ["RaptorCleanseApp.swift", "Brand.swift", "CleanseModel.swift", "Models/CleanseModels.swift",
           "Services/SafetyPolicy.swift", "Services/ScanEngine.swift", "Services/TrashService.swift",
           "Views/ContentView.swift", "Views/Components.swift", "Views/BrowserCleanerView.swift",
           "BrowserModel.swift", "Models/BrowserModels.swift", "Services/BrowserDiscovery.swift",
           "Services/BrowserHistoryReader.swift", "VirusScanModel.swift", "Models/VirusScanModels.swift",
           "Services/VirusScanner.swift", "Views/VirusScanView.swift"]
# Files the standalone test bundle compiles for itself, with no app host.
# Brand.swift is included because the virus report header is built from it.
core_sources = ["Brand.swift", "Models/CleanseModels.swift", "Services/SafetyPolicy.swift",
                "Services/ScanEngine.swift", "Services/TrashService.swift",
                "Models/BrowserModels.swift", "Services/BrowserDiscovery.swift", "Services/BrowserHistoryReader.swift",
                "Models/VirusScanModels.swift", "Services/VirusScanner.swift"]
# A source listed twice would be compiled twice and fail to link. A source in
# core_sources that is not in sources would be referenced but never declared.
assert len(sources) == len(set(sources)), "duplicate entry in sources"
assert len(core_sources) == len(set(core_sources)), "duplicate entry in core_sources"
assert set(core_sources) <= set(sources), f"core_sources not in sources: {set(core_sources) - set(sources)}"
for source in sources:
    assert (ROOT / "RaptorCleanse" / source).exists(), f"missing source file: {source}"

refs = {}
for source in sources:
    refs[source] = obj("source:" + source, "PBXFileReference", lastKnownFileType="sourcecode.swift", path=source, sourceTree="<group>")
assets = obj("assets", "PBXFileReference", lastKnownFileType="folder.assetcatalog", path="Assets.xcassets", sourceTree="<group>")
privacy = obj("privacy", "PBXFileReference", lastKnownFileType="text.xml", path="PrivacyInfo.xcprivacy", sourceTree="<group>")
entitlements = obj("entitlements", "PBXFileReference", lastKnownFileType="text.plist.entitlements", path="RaptorCleanse.entitlements", sourceTree="<group>")
test_source = obj("test-source", "PBXFileReference", lastKnownFileType="sourcecode.swift", path="EngineTests.swift", sourceTree="<group>")
browser_tests = obj("browser-tests", "PBXFileReference", lastKnownFileType="sourcecode.swift", path="BrowserTests.swift", sourceTree="<group>")
virus_tests = obj("virus-tests", "PBXFileReference", lastKnownFileType="sourcecode.swift", path="VirusScannerTests.swift", sourceTree="<group>")
sorting_tests = obj("sorting-tests", "PBXFileReference", lastKnownFileType="sourcecode.swift", path="SortingTests.swift", sourceTree="<group>")
app_product = obj("app-product", "PBXFileReference", explicitFileType="wrapper.application", includeInIndex=0, path="Raptor Cleanse.app", sourceTree="BUILT_PRODUCTS_DIR")
test_product = obj("test-product", "PBXFileReference", explicitFileType="wrapper.cfbundle", includeInIndex=0, path="RaptorCleanseTests.xctest", sourceTree="BUILT_PRODUCTS_DIR")
app_group = obj("app-group", "PBXGroup", children=list(refs.values()) + [assets, privacy, entitlements], path="RaptorCleanse", sourceTree="<group>")
test_group = obj("test-group", "PBXGroup", children=[test_source, browser_tests, virus_tests, sorting_tests], path="RaptorCleanseTests", sourceTree="<group>")
products = obj("products", "PBXGroup", children=[app_product, test_product], name="Products", sourceTree="<group>")
main = obj("main-group", "PBXGroup", children=[app_group, test_group, products], sourceTree="<group>")

app_builds = [obj("app-build:" + name, "PBXBuildFile", fileRef=ref) for name, ref in refs.items()]
test_builds = [obj("test-build:" + name, "PBXBuildFile", fileRef=refs[name]) for name in core_sources]
test_builds.append(obj("test-build:tests", "PBXBuildFile", fileRef=test_source))
test_builds.append(obj("test-build:browser-tests", "PBXBuildFile", fileRef=browser_tests))
test_builds.append(obj("test-build:virus-tests", "PBXBuildFile", fileRef=virus_tests))
test_builds.append(obj("test-build:sorting-tests", "PBXBuildFile", fileRef=sorting_tests))
resource_builds = [obj("resource-build:" + name, "PBXBuildFile", fileRef=ref) for name, ref in [("assets", assets), ("privacy", privacy)]]

def phase(name, isa, files):
    return obj(name, isa, buildActionMask=2147483647, files=files, runOnlyForDeploymentPostprocessing=0)

app_phases = [phase("app-sources", "PBXSourcesBuildPhase", app_builds), phase("app-frameworks", "PBXFrameworksBuildPhase", []), phase("app-resources", "PBXResourcesBuildPhase", resource_builds)]
test_phases = [phase("test-sources", "PBXSourcesBuildPhase", test_builds), phase("test-frameworks", "PBXFrameworksBuildPhase", []), phase("test-resources", "PBXResourcesBuildPhase", [])]

project_settings = {
    "SDKROOT": "macosx", "MACOSX_DEPLOYMENT_TARGET": "14.0", "SWIFT_VERSION": "5.0",
    "CLANG_ENABLE_MODULES": "YES", "CLANG_ENABLE_OBJC_ARC": "YES",
    "CLANG_WARN_DOCUMENTATION_COMMENTS": "YES", "CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER": "YES",
    "GCC_WARN_ABOUT_RETURN_TYPE": "YES_ERROR", "GCC_WARN_UNINITIALIZED_AUTOS": "YES_AGGRESSIVE",
    "ENABLE_USER_SCRIPT_SANDBOXING": "YES", "SWIFT_STRICT_CONCURRENCY": "targeted",
    "ALWAYS_SEARCH_USER_PATHS": "NO", "COPY_PHASE_STRIP": "NO",
    "OTHER_LDFLAGS": ["$(inherited)", "-lsqlite3"]
}
app_settings = {
    "PRODUCT_NAME": "Raptor Cleanse", "PRODUCT_MODULE_NAME": "RaptorCleanse",
    "PRODUCT_BUNDLE_IDENTIFIER": "com.raptornexus.cleanse",
    "GENERATE_INFOPLIST_FILE": "YES", "INFOPLIST_KEY_CFBundleDisplayName": "Raptor Cleanse",
    "INFOPLIST_KEY_LSApplicationCategoryType": "public.app-category.utilities",
    "INFOPLIST_KEY_NSHumanReadableCopyright": "Raptor Nexus",
    "INFOPLIST_KEY_CFBundleName": "Raptor Cleanse",
    "MARKETING_VERSION": "0.3.0", "CURRENT_PROJECT_VERSION": "4",
    "ASSETCATALOG_COMPILER_APPICON_NAME": "AppIcon",
    "CODE_SIGN_STYLE": "Manual", "CODE_SIGN_IDENTITY": "-",
    "CODE_SIGN_ENTITLEMENTS": "RaptorCleanse/RaptorCleanse.entitlements",
    "ENABLE_APP_SANDBOX": "NO", "ENABLE_HARDENED_RUNTIME": "YES",
    "COMBINE_HIDPI_IMAGES": "YES", "SUPPORTED_PLATFORMS": "macosx",
    "LD_RUNPATH_SEARCH_PATHS": ["$(inherited)", "@executable_path/../Frameworks"]
}
test_settings = {
    "PRODUCT_NAME": "RaptorCleanseTests", "PRODUCT_MODULE_NAME": "RaptorCleanseTests",
    "PRODUCT_BUNDLE_IDENTIFIER": "com.raptornexus.cleanse.tests", "GENERATE_INFOPLIST_FILE": "YES",
    "CODE_SIGN_STYLE": "Manual", "CODE_SIGN_IDENTITY": "-", "ENABLE_APP_SANDBOX": "NO",
    "SUPPORTED_PLATFORMS": "macosx", "SKIP_INSTALL": "YES",
    "LD_RUNPATH_SEARCH_PATHS": ["$(inherited)", "@loader_path/../Frameworks"]
}

def configurations(name, base):
    configs = []
    for mode in ["Debug", "Release"]:
        settings = dict(base)
        if mode == "Debug":
            settings.update(SWIFT_OPTIMIZATION_LEVEL="-Onone", DEBUG_INFORMATION_FORMAT="dwarf", ENABLE_TESTABILITY="YES", ONLY_ACTIVE_ARCH="YES", SWIFT_ACTIVE_COMPILATION_CONDITIONS="DEBUG $(inherited)")
        else:
            settings.update(SWIFT_OPTIMIZATION_LEVEL="-O", SWIFT_COMPILATION_MODE="wholemodule", DEBUG_INFORMATION_FORMAT="dwarf-with-dsym", ONLY_ACTIVE_ARCH="NO")
        configs.append(obj(name + ":" + mode, "XCBuildConfiguration", buildSettings=settings, name=mode))
    return obj(name + ":config-list", "XCConfigurationList", buildConfigurations=configs, defaultConfigurationIsVisible=0, defaultConfigurationName="Release")

project_configs = configurations("project", project_settings)
app_configs = configurations("app", app_settings)
test_configs = configurations("test", test_settings)
app_target = obj("app-target", "PBXNativeTarget", buildConfigurationList=app_configs, buildPhases=app_phases, buildRules=[], dependencies=[], name="RaptorCleanse", productName="Raptor Cleanse", productReference=app_product, productType="com.apple.product-type.application")
test_target = obj("test-target", "PBXNativeTarget", buildConfigurationList=test_configs, buildPhases=test_phases, buildRules=[], dependencies=[], name="RaptorCleanseTests", productName="RaptorCleanseTests", productReference=test_product, productType="com.apple.product-type.bundle.unit-test")
project = obj("project", "PBXProject", attributes={"BuildIndependentTargetsInParallel": "YES", "LastUpgradeCheck": "2600", "LastSwiftUpdateCheck": "2600", "TargetAttributes": {app_target: {"CreatedOnToolsVersion": "26.0"}, test_target: {"CreatedOnToolsVersion": "26.0"}}}, buildConfigurationList=project_configs, compatibilityVersion="Xcode 14.0", developmentRegion="en", hasScannedForEncodings=0, knownRegions=["en", "Base"], mainGroup=main, productRefGroup=products, projectDirPath="", projectRoot="", targets=[app_target, test_target])
project_dir = ROOT / "RaptorCleanse.xcodeproj"
project_dir.mkdir(exist_ok=True)
data = dict(archiveVersion=1, classes={}, objectVersion=56, objects=objects, rootObject=project)
(project_dir / "project.pbxproj").write_text("// !$*UTF8*$!\n" + serialize(data) + "\n")

scheme_dir = project_dir / "xcshareddata/xcschemes"
scheme_dir.mkdir(parents=True, exist_ok=True)
def reference(target, product, name):
    return f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="{product}" BlueprintName="{name}" ReferencedContainer="container:RaptorCleanse.xcodeproj"/>'
app_reference = reference(app_target, "Raptor Cleanse.app", "RaptorCleanse")
test_reference = reference(test_target, "RaptorCleanseTests.xctest", "RaptorCleanseTests")
(scheme_dir / "RaptorCleanse.xcscheme").write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2600" version="1.3">
  <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries>
    <BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{app_reference}</BuildActionEntry>
    <BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="YES">{test_reference}</BuildActionEntry>
  </BuildActionEntries></BuildAction>
  <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">{test_reference}</TestableReference></Testables></TestAction>
  <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{app_reference}</BuildableProductRunnable></LaunchAction>
  <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{app_reference}</BuildableProductRunnable></ProfileAction>
  <AnalyzeAction buildConfiguration="Debug"/>
  <ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
''')
workspace = project_dir / "project.xcworkspace"
workspace.mkdir(exist_ok=True)
(workspace / "contents.xcworkspacedata").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<Workspace version="1.0"><FileRef location="self:"/></Workspace>\n')

# Direct-distribution Mac utility: running an independently installed ClamAV engine
# requires a non-sandboxed target. In-app folder grants/scope checks still apply;
# this does not grant Full Disk Access or bypass macOS privacy protections.
entitlement_data = {"com.apple.security.files.bookmarks.app-scope": True}
with (ROOT / "RaptorCleanse/RaptorCleanse.entitlements").open("wb") as handle:
    plistlib.dump(entitlement_data, handle)
print("Generated direct-distribution Xcode project, shared scheme and local signing entitlements.")
