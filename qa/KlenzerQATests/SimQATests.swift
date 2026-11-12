import XCTest
import StoreKitTest

/// Four-gate iOS simulator QA for Klenzer.
/// Results are written to $SIM_QA_OUT/results.json for the workflow step summary.
final class SimQATests: XCTestCase {
    private var session: SKTestSession?
    private var results: [[String: Any]] = []
    private let outDir: URL = {
        let path = ProcessInfo.processInfo.environment["SIM_QA_OUT"] ?? "/tmp/klenzer-sim-qa"
        let url = URL(fileURLWithPath: path, isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }()

    override func setUpWithError() throws {
        continueAfterFailure = true
        let envPath = ProcessInfo.processInfo.environment["STOREKIT_CONFIG"]
        let candidates = [
            envPath,
            // Copied next to the test sources during CI prepare
            Bundle(for: SimQATests.self).path(forResource: "Klenzer", ofType: "storekit"),
        ].compactMap { $0 }

        if session == nil {
            for path in candidates {
                if FileManager.default.fileExists(atPath: path) {
                    let s = try SKTestSession(contentsOf: URL(fileURLWithPath: path))
                    s.resetToDefaultState()
                    s.disableDialogs = true
                    s.clearTransactions()
                    session = s
                    break
                }
            }
        }
        if session == nil {
            // Fall back to a configuration already loaded via -storeKitConfigurationPath
            // SKTestSession still needs a file to disable dialogs.
            NSLog("[klenzer-qa] warning: could not create SKTestSession from a .storekit file")
        }
    }

    override func tearDownWithError() throws {
        writeResults()
    }

    func testSimulatorQAGates() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]

        // First launch: dismiss onboarding if it appears (fresh sim container).
        app.launch()
        dismissOnboardingIfNeeded(app)
        // Warm launch completed; terminate so the timed run is a real cold-ish start.
        app.terminate()
        sleep(1)

        // --- Step 1: launch, no Apple ID / system prompt, home under 2 s ---
        let t0 = Date()
        app.launch()
        let home = app.otherElements["home-screen"]
        let appeared = home.waitForExistence(timeout: 8)
        let launchMs = Int(Date().timeIntervalSince(t0) * 1000)
        let prompt = visibleSystemPrompt(app)
        let shot1 = screenshot(app, name: "01-home")
        let step1Pass = appeared && prompt == nil && launchMs < 2000
        record(
            step: 1,
            name: "Launch: no Apple ID or system prompt, home under 2s",
            pass: step1Pass,
            ms: launchMs,
            detail: appeared
                ? (prompt.map { "system prompt visible: \($0)" } ?? "home visible")
                : "home-screen did not appear"
        )
        XCTAssertTrue(appeared, "Home did not appear after launch")
        XCTAssertNil(prompt, "Unexpected system prompt: \(prompt ?? "")")
        XCTAssertLessThan(launchMs, 2000, "Home took \(launchMs) ms (limit 2000)")
        _ = shot1

        // Permission banner would mean the pre-grant failed.
        if app.staticTexts["Photo access is off"].waitForExistence(timeout: 1) {
            record(step: 2, name: "Scan: first results within 10s, then finishes", pass: false, ms: 0, detail: "Photo access is off banner — privacy grant failed")
            record(step: 3, name: "Paywall shows yearly $19.99, monthly $3.99, lifetime $29.99", pass: false, ms: 0, detail: "skipped")
            record(step: 4, name: "Test monthly purchase unlocks Pro", pass: false, ms: 0, detail: "skipped")
            XCTFail("Photo permission was not granted on the simulator")
            return
        }

        // --- Step 2: scan first results within 10s, then finish ---
        let smart = app.descendants(matching: .any)["smart-clean"]
        XCTAssertTrue(smart.waitForExistence(timeout: 3), "Smart Clean not found")
        let tScan = Date()
        smart.tap()

        // First results: any category count > 0, or "Looking through" plus a non-zero card.
        let firstResults = waitForFirstScanResults(app, timeout: 15)
        let firstMs = Int(Date().timeIntervalSince(tScan) * 1000)
        _ = screenshot(app, name: "02-scan-first-results")
        let firstPass = firstResults != nil && firstMs < 10_000
        // Continue waiting for the scan to finish even if first-results missed the 10s gate.
        let finished = waitForScanFinished(app, timeout: 240)
        let totalMs = Int(Date().timeIntervalSince(tScan) * 1000)
        _ = screenshot(app, name: "02-scan-finished")
        record(
            step: 2,
            name: "Scan: first results within 10s, then finishes",
            pass: firstPass && finished,
            ms: totalMs,
            detail: "firstResults=\(firstResults ?? "none") at \(firstMs)ms; finished=\(finished) at \(totalMs)ms"
        )
        XCTAssertNotNil(firstResults, "No scan results appeared")
        XCTAssertLessThan(firstMs, 10_000, "First results took \(firstMs) ms (limit 10000)")
        XCTAssertTrue(finished, "Scan did not finish within 240s")

        // --- Step 3: paywall prices ---
        let pro = app.descendants(matching: .any)["open-paywall"]
        XCTAssertTrue(pro.waitForExistence(timeout: 5), "PRO / Klenzer Pro button not found")
        let tPay = Date()
        pro.tap()
        let paywall = app.otherElements["paywall-screen"]
        XCTAssertTrue(paywall.waitForExistence(timeout: 8), "Paywall did not appear")

        // StoreKit localizations typically include a currency symbol.
        let yearly = hasPrice(app, candidates: ["$19.99", "US$19.99", "19.99"])
        let monthly = hasPrice(app, candidates: ["$3.99", "US$3.99", "3.99"])
        let lifetime = hasPrice(app, candidates: ["$29.99", "US$29.99", "29.99"])
        let payMs = Int(Date().timeIntervalSince(tPay) * 1000)
        _ = screenshot(app, name: "03-paywall")
        let pricesPass = yearly && monthly && lifetime
        record(
            step: 3,
            name: "Paywall shows yearly $19.99, monthly $3.99, lifetime $29.99",
            pass: pricesPass,
            ms: payMs,
            detail: "yearly=\(yearly) monthly=\(monthly) lifetime=\(lifetime)"
        )
        XCTAssertTrue(yearly, "Yearly $19.99 not visible")
        XCTAssertTrue(monthly, "Monthly $3.99 not visible")
        XCTAssertTrue(lifetime, "Lifetime $29.99 not visible")

        // --- Step 4: test monthly purchase unlocks Pro ---
        if session == nil {
            record(step: 4, name: "Test monthly purchase unlocks Pro", pass: false, ms: 0, detail: "SKTestSession could not be created (StoreKit test purchase blocker)")
            XCTFail("SKTestSession was not created; cannot disable StoreKit dialogs on CI")
            return
        }

        let tBuy = Date()
        let monthlyPlan = app.descendants(matching: .any)["plan-monthly"]
        if monthlyPlan.waitForExistence(timeout: 3) {
            monthlyPlan.tap()
        } else if app.staticTexts["Monthly"].waitForExistence(timeout: 2) {
            app.staticTexts["Monthly"].tap()
        }
        let unlock = app.descendants(matching: .any)["unlock"]
        XCTAssertTrue(unlock.waitForExistence(timeout: 5), "Unlock button not found")
        unlock.tap()

        // With SKTestSession.disableDialogs the purchase should complete without a sheet.
        // completeUnlock pops the paywall. Then open Settings and look for Plan: Pro.
        let paywallGone = !paywall.waitForExistence(timeout: 12) || app.otherElements["home-screen"].waitForExistence(timeout: 8)
        // If still on paywall (e.g. error copy), capture and fail clearly.
        if app.staticTexts["Purchase didn’t go through"].exists || app.staticTexts["Plans unavailable right now, try again later"].exists {
            _ = screenshot(app, name: "04-purchase-failed")
            let buyMs = Int(Date().timeIntervalSince(tBuy) * 1000)
            record(step: 4, name: "Test monthly purchase unlocks Pro", pass: false, ms: buyMs, detail: "purchase error copy visible")
            XCTFail("Purchase did not complete")
            return
        }

        // Back to home if the paywall is still up (purchase may have succeeded without a pop).
        if paywall.exists {
            if app.buttons["Close"].waitForExistence(timeout: 2) {
                app.buttons["Close"].tap()
            } else if app.buttons["Back"].waitForExistence(timeout: 1) {
                app.buttons["Back"].tap()
            }
        }

        XCTAssertTrue(app.otherElements["home-screen"].waitForExistence(timeout: 8), "Did not return to home after purchase")

        // Open Settings (tab or nav).
        let settingsTab = app.descendants(matching: .any)["open-settings"]
        if !settingsTab.waitForExistence(timeout: 3) {
            app.descendants(matching: .any)["Settings"].tap()
        } else {
            settingsTab.tap()
        }
        let proPlan = app.staticTexts["Plan: Pro"].waitForExistence(timeout: 10)
        let buyMs = Int(Date().timeIntervalSince(tBuy) * 1000)
        _ = screenshot(app, name: "04-settings-plan")
        record(
            step: 4,
            name: "Test monthly purchase unlocks Pro",
            pass: proPlan,
            ms: buyMs,
            detail: proPlan ? "Plan: Pro visible in Settings" : "Plan: Pro not visible (paywallGone=\(paywallGone))"
        )
        XCTAssertTrue(proPlan, "Settings did not show Plan: Pro after the test monthly purchase")
    }

    // MARK: - Helpers

    private func dismissOnboardingIfNeeded(_ app: XCUIApplication) {
        let continueBtn = app.descendants(matching: .any)["onboarding-continue"]
        let startBtn = app.descendants(matching: .any)["onboarding-start"]
        let deadline = Date().addingTimeInterval(12)
        var hops = 0
        while Date() < deadline && hops < 6 {
            if startBtn.exists {
                startBtn.tap()
                _ = app.otherElements["home-screen"].waitForExistence(timeout: 6)
                return
            }
            if continueBtn.exists {
                continueBtn.tap()
                hops += 1
                Thread.sleep(forTimeInterval: 0.4)
                continue
            }
            if app.buttons["Get started"].exists {
                app.buttons["Get started"].tap()
                _ = app.otherElements["home-screen"].waitForExistence(timeout: 6)
                return
            }
            if app.buttons["Continue"].exists {
                app.buttons["Continue"].tap()
                hops += 1
                Thread.sleep(forTimeInterval: 0.4)
                continue
            }
            if app.otherElements["home-screen"].exists { return }
            Thread.sleep(forTimeInterval: 0.3)
        }
    }

    private func visibleSystemPrompt(_ app: XCUIApplication) -> String? {
        // Catch Apple ID / permission / StoreKit sheets at launch.
        let phrases = [
            "Sign in to Apple Account",
            "Sign In to Apple Account",
            "Sign in with Apple",
            "Apple ID",
            "Password",
            "Allow Access to Your Photos",
            "Allow Access to All Photos",
            "Would Like to Access Your Photos",
            "Don’t Allow",
            "Don't Allow",
        ]
        // Give any modal a brief moment to animate in.
        Thread.sleep(forTimeInterval: 0.4)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for phrase in phrases {
            if app.staticTexts[phrase].exists || app.alerts[phrase].exists || springboard.staticTexts[phrase].exists {
                // "Apple ID" / "Password" can be too broad if they appear in Settings later;
                // at launch they are prompts. Ignore if home is already up and no alert exists.
                if app.alerts.element.exists || springboard.alerts.element.exists || springboard.staticTexts[phrase].exists {
                    return phrase
                }
            }
        }
        if springboard.alerts.element.exists {
            return springboard.alerts.element.label
        }
        if app.alerts.element.exists {
            return app.alerts.element.label
        }
        return nil
    }

    private func waitForFirstScanResults(_ app: XCUIApplication, timeout: TimeInterval) -> String? {
        let deadline = Date().addingTimeInterval(timeout)
        // CatCard uses accessibilityLabel "Screenshots, N items" with a raw count.
        let pred = NSPredicate(format: "label MATCHES %@", "^(Screenshots|Duplicates|Similar|Blurry|Videos|Live Photos|Large videos), (?!0 items)\\d+ items$")
        let match = app.descendants(matching: .any).matching(pred).firstMatch
        if match.waitForExistence(timeout: timeout) {
            return match.label
        }
        _ = deadline
        return nil
    }

    private func waitForScanFinished(_ app: XCUIApplication, timeout: TimeInterval) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        // ScanProgress uses accessibilityLabel "Looking through {N} photos · {P}%"
        // and "Start cleaning anytime while we finish up."
        // When scanning ends, those texts go away.
        // Wait until "Looking through" has been seen, then until it disappears —
        // or until 100% has been seen and the progress view is gone.
        var sawProgress = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Looking through")).firstMatch.exists
        while Date() < deadline {
            let looking = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Looking through")).firstMatch
            if looking.exists { sawProgress = true }
            if sawProgress && !looking.exists {
                // Progress unmounted — scan finished (or user navigated away).
                if app.otherElements["home-screen"].exists { return true }
            }
            // 100% is also a finish signal even if the view lingers a moment.
            if app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "· 100%")).firstMatch.exists {
                // wait a beat for unmount
                Thread.sleep(forTimeInterval: 1.0)
                if !looking.exists { return true }
            }
            Thread.sleep(forTimeInterval: 0.4)
        }
        // If we never saw progress (very fast scan on a tiny library) but Smart Clean is back and
        // at least one category has items, treat as finished.
        if app.descendants(matching: .any)["smart-clean"].exists, waitForFirstScanResults(app, timeout: 1) != nil {
            return true
        }
        return false
    }

    private func hasPrice(_ app: XCUIApplication, candidates: [String]) -> Bool {
        let deadline = Date().addingTimeInterval(8)
        while Date() < deadline {
            for text in candidates {
                if app.staticTexts[text].exists { return true }
                // Partial match in case of surrounding whitespace or "US$19.99 / year"
                let pred = NSPredicate(format: "label CONTAINS %@", text)
                if app.staticTexts.matching(pred).firstMatch.exists { return true }
            }
            Thread.sleep(forTimeInterval: 0.3)
        }
        return false
    }

    @discardableResult
    private func screenshot(_ app: XCUIApplication, name: String) -> String {
        let data = app.screenshot().pngRepresentation
        let url = outDir.appendingPathComponent("\(name).png")
        try? data.write(to: url)
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        return url.path
    }

    private func record(step: Int, name: String, pass: Bool, ms: Int, detail: String) {
        results.append([
            "step": step,
            "name": name,
            "pass": pass,
            "ms": ms,
            "detail": detail,
        ])
        writeResults()
        NSLog("[klenzer-qa] step \(step) \(pass ? "PASS" : "FAIL") \(ms)ms — \(name) — \(detail)")
    }

    private func writeResults() {
        let url = outDir.appendingPathComponent("results.json")
        if let data = try? JSONSerialization.data(withJSONObject: ["steps": results], options: [.prettyPrinted]) {
            try? data.write(to: url)
        }
    }
}
