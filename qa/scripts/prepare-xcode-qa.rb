#!/usr/bin/env ruby
# Post-prebuild only. Adds a UI-test target and wires qa/Klenzer.storekit into the
# shared scheme for the simulator QA run. Must never be invoked from an Expo
# config plugin or from EAS — ios/ is gitignored and EAS generates its own ios/.
require 'fileutils'
require 'xcodeproj'

REPO = File.expand_path('../..', __dir__)
IOS  = File.join(REPO, 'ios')
STOREKIT_SRC = File.join(REPO, 'qa', 'Klenzer.storekit')
TEST_SRC_DIR = File.join(REPO, 'qa', 'KlenzerQATests')

abort("ios/ is missing — run expo prebuild first") unless Dir.exist?(IOS)
abort("missing #{STOREKIT_SRC}") unless File.exist?(STOREKIT_SRC)

proj_path = Dir[File.join(IOS, '*.xcodeproj')].reject { |p| p.include?('.xcodeproj/') }.first
abort("no .xcodeproj under ios/") unless proj_path

project = Xcodeproj::Project.open(proj_path)
app_target = project.targets.find { |t| t.product_type == 'com.apple.product-type.application' }
abort("no application target in #{proj_path}") unless app_target

test_name = 'KlenzerQATests'
if project.targets.any? { |t| t.name == test_name }
  puts "target #{test_name} already exists — leaving it in place"
else
  # Copy sources into ios/ so Xcode sees them inside the generated project tree.
  dest = File.join(IOS, test_name)
  FileUtils.rm_rf(dest)
  FileUtils.mkdir_p(dest)
  FileUtils.cp(File.join(TEST_SRC_DIR, 'SimQATests.swift'), File.join(dest, 'SimQATests.swift'))
  FileUtils.cp(STOREKIT_SRC, File.join(dest, 'Klenzer.storekit'))

  test_target = project.new_target(:ui_test_bundle, test_name, :ios, '16.0')
  test_target.product_name = test_name
  test_target.add_dependency(app_target)

  group = project.main_group.find_subpath(test_name, true)
  group.set_source_tree('SOURCE_ROOT')
  group.set_path(test_name)
  swift_ref = group.new_file('SimQATests.swift')
  storekit_ref = group.new_file('Klenzer.storekit')
  test_target.add_file_references([swift_ref])
  # Keep the .storekit in the test target resources only — never the app target.
  test_target.add_resources([storekit_ref])

  test_target.build_configurations.each do |cfg|
    # Explicit, so the runner app and .xctest never get an empty name ("-Runner.app/PlugIns/.xctest").
    cfg.build_settings['PRODUCT_NAME'] = test_name
    cfg.build_settings['PRODUCT_MODULE_NAME'] = test_name
    cfg.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.krosz.klenzer.qatests'
    cfg.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
    cfg.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
    cfg.build_settings['SWIFT_VERSION'] = '5.0'
    cfg.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
    cfg.build_settings['TEST_TARGET_NAME'] = app_target.name
    cfg.build_settings['BUNDLE_LOADER'] = '$(TEST_HOST)'
    cfg.build_settings['TEST_HOST'] = ''
    # UI tests don't use TEST_HOST the same way unit tests do; clear it.
    cfg.build_settings.delete('BUNDLE_LOADER')
    cfg.build_settings.delete('TEST_HOST')
    cfg.build_settings['LD_RUNPATH_SEARCH_PATHS'] = '$(inherited) @executable_path/Frameworks @loader_path/Frameworks'
  end

  # Don't add StoreKit.framework to the app; the test file imports StoreKitTest.
  # Linking happens automatically via the import when the SDK is present.

  project.save
  puts "added UI test target #{test_name} to #{proj_path}"
  test_target.build_configurations.each do |cfg|
    puts "#{test_name} #{cfg.name}: PRODUCT_NAME=#{cfg.build_settings['PRODUCT_NAME']} TEST_TARGET_NAME=#{cfg.build_settings['TEST_TARGET_NAME']}"
  end
end

# Shared scheme: include the test target and a StoreKitConfigurationFileReference.
scheme_dir = File.join(proj_path, 'xcshareddata', 'xcschemes')
scheme_path = Dir[File.join(scheme_dir, '*.xcscheme')].find { |p| File.basename(p, '.xcscheme') == app_target.name }
scheme_path ||= Dir[File.join(scheme_dir, '*.xcscheme')].first
abort("no shared scheme under #{scheme_dir}") unless scheme_path

scheme = Xcodeproj::XCScheme.new(scheme_path)

# Ensure the test target is built for test and listed as a testable.
test_target = project.targets.find { |t| t.name == test_name }
unless scheme.test_action.testables.any? { |t| t.buildable_references.any? { |r| r.target_name == test_name } }
  scheme.add_test_target(test_target)
end

# Build the test target in the Build action too (needed for test-without-building later).
already = scheme.build_action.entries.any? do |e|
  e.buildable_references.any? { |r| r.target_name == test_name }
end
unless already
  entry = Xcodeproj::XCScheme::BuildAction::Entry.new(test_target)
  entry.build_for_testing = true
  entry.build_for_running = false
  entry.build_for_profiling = false
  entry.build_for_archiving = false
  entry.build_for_analyzing = false
  scheme.build_action.add_entry(entry)
end

# Environment for the test runner.
xml = File.read(scheme_path)
# Re-serialize after the ruby edits first, then patch StoreKit + env vars in XML
# because xcodeproj's scheme API does not expose StoreKitConfigurationFileReference.
scheme.save!

xml = File.read(scheme_path)

# StoreKit configuration for Run (LaunchAction) and Test (TestAction).
# The identifier is relative to the .xcodeproj: ios/Klenzer.xcodeproj -> ../../qa/Klenzer.storekit
ref = %(<StoreKitConfigurationFileReference\n         identifier = "../../qa/Klenzer.storekit">\n      </StoreKitConfigurationFileReference>\n)
unless xml.include?('StoreKitConfigurationFileReference')
  %w[TestAction LaunchAction].each do |tag|
    xml.sub!(%r{</#{tag}>}) { "   #{ref}   </#{tag}>" }
  end
end

File.write(scheme_path, xml)
puts "updated scheme #{scheme_path}"
puts "storekit reference: ../../qa/Klenzer.storekit in LaunchAction and TestAction, plus test-target resource"
