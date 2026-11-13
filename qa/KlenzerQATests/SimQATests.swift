import XCTest
import StoreKitTest

/// Klenzer iOS simulator flow: launch, home, Similar, Swipe, Merge Contacts preview,
/// Secret Album, paywall, StoreKit test purchase, restore.
/// Screenshots and results.json go to $SIM_QA_OUT (pass TEST_RUNNER_SIM_QA_OUT to xcodebuild).
final class SimQATests: XCTestCase {
    private var session: SKTestSession?
    private var results: [[String: Any]] = []
    private let outDir: URL = {
        let path = ProcessInfo.processInfo.environment["SIM_QA_OUT"] ?? "/tmp/sim-qa"
        let url = URL(fileURLWithPath: path, isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }()
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = true
        let candidates: [String] = [
            ProcessInfo.processInfo.environment["STOREKIT_CONFIG"],
            Bundle(for: SimQATests.self).path(forResource: "Klenzer", ofType: "storekit"),
        ].compactMap { $0 }
        for path in candidates where FileManager.default.fileExists(atPath: path) {
            do {
                let s = try SKTestSession(contentsOf: URL(fileURLWithPath: path))
                s.resetToDefaultState()
                s.disableDialogs = true
                s.clearTransactions()
                session = s
                NSLog("[klenzer-qa] SKTestSession from \(path)")
                break
            } catch {
                NSLog("[klenzer-qa] SKTestSession failed for \(path): \(error)")
            }
        }
        addUIInterruptionMonitor(withDescription: "System alerts") { alert in
            for label in ["Allow Full Access", "Allow Access to All Photos", "Allow", "OK", "Continue", "Not Now", "Don’t Allow"] {
                let b = alert.buttons[label]
                if b.exists { b.tap(); return true }
            }
            return false
        }
    }

    override func tearDownWithError() throws {
        writeResults()
    }

    func testKlenzerFlow() throws {
        app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()

        // 1. Launch
        sleep(3)
        shot("01-launch")
        let onboardingSeen = any("onboarding-continue").exists || any("onboarding-start").exists
        dismissOnboarding()
        let home = any("home-screen")
        let homeUp = home.waitForExistence(timeout: 20)
        record(1, "Launch", homeUp, onboardingSeen ? "onboarding shown, then home" : "home shown directly")
        guard homeUp else { shot("01-launch-fail"); XCTFail("home never appeared"); return }

        // 2. Home with scan results
        let smart = any("smart-clean")
        if smart.waitForExistence(timeout: 5) { tapEl(smart) }
        sleep(2)
        if allowPhotosIfAsked() { sleep(2) }
        shot("02a-home-mid-scan")
        let midNote = containing("Scanning ").exists
        let noneYetMid = any("scan-bar").exists && containing("None yet").exists
        record(21, "Mid-scan cards show progress, not None yet", !noneYetMid, "scanningNote=\(midNote) noneYetWhileScanning=\(noneYetMid)")
        // Background during the scan so the local scan-complete notification can appear.
        XCUIDevice.shared.press(.home)
        sleep(2)
        let notif = waitForScanNotification(timeout: 300)
        shot("10-scan-notification")
        record(10, "Scan-complete notification", notif != nil, "banner=\(notif ?? "none")")
        app.activate()
        sleep(2)
        if allowPhotosIfAsked() { sleep(2) }
        dismissAppAlert()
        let finished = waitForScan(timeout: 120)
        dismissAppAlert()
        sleep(1)
        let nonZero = firstNonZeroCategory()
        shot("02-home")
        record(2, "Home after scan", finished && nonZero != nil, "scanFinished=\(finished) firstNonZero=\(nonZero ?? "none")")

        // 2b. Duplicate and Blurry counts (seeded: 5 exact pairs, 5 blurry)
        for (label, minCount, name) in [("Duplicate, ", 5, "02b-duplicate"), ("Blurry, ", 5, "02c-blurry")] {
            let tile = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", label)).firstMatch
            var n = 0
            if tile.waitForExistence(timeout: 5) {
                let digits = tile.label.dropFirst(label.count).prefix { $0.isNumber || $0 == "," }.replacingOccurrences(of: ",", with: "")
                n = Int(digits) ?? 0
            }
            var opened = false
            if n > 0 {
                tapEl(tile)
                opened = hittable("Back") != nil && !(any("smart-clean").exists && any("smart-clean").isHittable)
                sleep(1)
            }
            shot(name)
            record(name == "02b-duplicate" ? 22 : 23, "\(label.dropLast(2)) card count and review", n >= minCount && opened, "tile=\(tile.exists ? tile.label : "missing") count=\(n) min=\(minCount) reviewOpened=\(opened)")
            goHome()
        }

        // 3. Similar
        let similarTile = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "Similar, ")).firstMatch
        var similarOK = false
        var similarDetail = "Similar tile not found"
        if similarTile.waitForExistence(timeout: 5) {
            similarDetail = "tile: \(similarTile.label)"
            if !similarTile.label.hasSuffix(" 0 items") {
                tapEl(similarTile)
                let meta = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", " similar")).firstMatch
                similarOK = meta.waitForExistence(timeout: 10)
                similarDetail += similarOK ? "; group shown: \(meta.label)" : "; no similar group rendered"
            } else {
                similarDetail += "; zero items, not opened"
            }
        }
        shot("03-similar")
        record(3, "Similar review", similarOK, similarDetail)
        goHome()

        // 4. Swipe to Organize
        var swipeOK = false
        if scrollTo(any("open-swipe")) {
            tapEl(any("open-swipe"))
            swipeOK = any("swipe-screen").waitForExistence(timeout: 10)
            sleep(2)
            shot("04-swipe")
            let keep = any("swipe-keep")
            if swipeOK && keep.exists && keep.isEnabled {
                tapEl(keep)
                sleep(1)
                shot("04-swipe-after-keep")
            }
        } else {
            shot("04-swipe")
        }
        record(4, "Swipe to Organize", swipeOK, swipeOK ? "swipe-screen shown" : "swipe screen not reached")
        goHome()

        // 5. Merge Contacts preview
        var contactsOK = false
        var contactsDetail = ""
        scrollTop()
        let seg = any("home-switch-contacts")
        if seg.waitForExistence(timeout: 5) { tapEl(seg) } else { tapEl(any("Contacts")) }
        let card = any("open-contacts")
        if card.waitForExistence(timeout: 5) {
            tapEl(card)
            let allow = any("contacts-allow")
            if allow.waitForExistence(timeout: 4) { tapEl(allow); sleep(2); app.tap() }
            let group = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "Group of ")).firstMatch
            if group.waitForExistence(timeout: 15) {
                contactsDetail = "group: \(group.label)"
                shot("05-contacts-list")
                tapEl(group)
                contactsOK = any("contacts-preview").waitForExistence(timeout: 8)
                sleep(1)
                shot("05-contacts-preview")
                contactsDetail += contactsOK ? "; preview shown" : "; preview did not open"
                let close = hittable("Close")
                if let c = close { c.tap(); sleep(1) }
            } else {
                contactsDetail = "no duplicate group listed"
                shot("05-contacts-preview")
            }
        } else {
            contactsDetail = "Merge duplicate contacts card not found"
            shot("05-contacts-preview")
        }
        record(5, "Merge Contacts preview", contactsOK, contactsDetail)
        goHome()

        // 6. Secret Album
        scrollTop()
        let photosSeg = any("home-switch-photos")
        if photosSeg.waitForExistence(timeout: 5) { tapEl(photosSeg) }
        var vaultOK = false
        var vaultDetail = ""
        if scrollTo(any("open-secret-album")) {
            tapEl(any("open-secret-album"))
            if any("vault-lock").waitForExistence(timeout: 10) {
                shot("06-secret-album-pin")
                for round in 0..<2 {
                    for d in ["1", "2", "3", "4"] { tapLabel(d) }
                    tapLabel("Next")
                    sleep(1)
                    if round == 0 { shot("06-secret-album-confirm") }
                }
                dismissAppAlert(prefer: ["Not now"])
                vaultOK = any("vault-open").waitForExistence(timeout: 10)
                vaultDetail = vaultOK ? "PIN set, album open" : "album did not open after PIN"
            } else if any("vault-open").exists {
                vaultOK = true
                vaultDetail = "album already open"
            } else {
                vaultDetail = "lock screen not shown"
            }
        } else {
            vaultDetail = "Secret Album row not found"
        }
        sleep(1)
        shot("06-secret-album")
        record(6, "Secret Album", vaultOK, vaultDetail)
        goHome()

        // 7. Paywall
        scrollTop()
        let pro = any("open-paywall")
        var payOK = false
        var payDetail = "Pro button not found"
        if pro.waitForExistence(timeout: 5) {
            tapEl(pro)
            let paywall = any("paywall-screen")
            if paywall.waitForExistence(timeout: 10) {
                let y = hasText(["$19.99"])
                let m = hasText(["$3.99"])
                let l = hasText(["$29.99"])
                payOK = y && m && l
                payDetail = "yearly $19.99=\(y) monthly $3.99=\(m) lifetime $29.99=\(l) unavailable=\(any("plans-unavailable").exists)"
            } else {
                payDetail = "paywall did not open"
            }
        }
        shot("07-paywall")
        record(7, "Paywall prices", payOK, payDetail)

        // 8. StoreKit test purchase (monthly)
        var buyOK = false
        var buyDetail = "session=\(session != nil)"
        if payOK {
            tapEl(any("plan-monthly"))
            sleep(1)
            shot("08-paywall-monthly-selected")
            tapEl(any("unlock"))
            confirmStoreSheet()
            let gone = waitGone(any("paywall-screen"), timeout: 20)
            if !gone {
                shot("08-purchase-stuck")
                dismissAppAlert()
                if let c = hittable("Close") { c.tap(); sleep(1) }
            }
            buyDetail += " paywallClosed=\(gone)"
            if any("open-settings").waitForExistence(timeout: 8) {
                tapEl(any("open-settings"))
                buyOK = containing("Plan: Pro").waitForExistence(timeout: 10)
                buyDetail += buyOK ? "; Settings shows Plan: Pro" : "; Settings does not show Plan: Pro"
            }
        } else {
            buyDetail += "; skipped, paywall prices missing"
        }
        shot("08-purchase-settings")
        record(8, "StoreKit test purchase (monthly)", buyOK, buyDetail)

        // 9. Restore purchases (Settings)
        var restoreOK = false
        var restoreDetail = "not on Settings"
        if containing("Plan: Pro").exists || containing("Restore purchases").exists {
            if scrollTo(containing("Restore purchases")) {
                tapEl(containing("Restore purchases"))
                let alert = app.alerts.firstMatch
                if alert.waitForExistence(timeout: 15) {
                    restoreDetail = "alert: \(alert.label)"
                    restoreOK = alert.label == "Restored"
                    shot("09-restore")
                    dismissAppAlert()
                } else {
                    restoreDetail = "no restore alert"
                    shot("09-restore")
                }
            }
        }
        record(9, "Restore purchases", restoreOK, restoreDetail)
    }

    // MARK: - Helpers

    private func any(_ key: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "identifier == %@ OR label == %@", key, key)).firstMatch
    }

    private func containing(_ text: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func hittable(_ key: String) -> XCUIElement? {
        let all = app.descendants(matching: .any).matching(NSPredicate(format: "identifier == %@ OR label == %@", key, key)).allElementsBoundByIndex
        return all.last(where: { $0.exists && $0.isHittable })
    }

    private func tapEl(_ el: XCUIElement) {
        guard el.waitForExistence(timeout: 5) else { NSLog("[klenzer-qa] tap: missing element"); return }
        if el.isHittable { el.tap() } else { el.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap() }
        Thread.sleep(forTimeInterval: 0.8)
    }

    private func tapLabel(_ label: String) {
        if let el = hittable(label) { el.tap() } else { tapEl(any(label)) }
        Thread.sleep(forTimeInterval: 0.3)
    }

    @discardableResult
    private func scrollTo(_ el: XCUIElement) -> Bool {
        for _ in 0..<6 {
            if el.exists && el.isHittable { return true }
            app.swipeUp()
            Thread.sleep(forTimeInterval: 0.6)
        }
        return el.exists && el.isHittable
    }

    private func scrollTop() {
        for _ in 0..<3 { app.swipeDown(); Thread.sleep(forTimeInterval: 0.3) }
    }

    private func goHome() {
        dismissAppAlert()
        for _ in 0..<4 {
            let h = any("smart-clean")
            if h.exists && h.isHittable { return }
            if let b = hittable("Back") { b.tap() } else if let c = hittable("Close") { c.tap() } else { break }
            Thread.sleep(forTimeInterval: 1.0)
        }
    }

    private func dismissOnboarding() {
        let deadline = Date().addingTimeInterval(25)
        var hops = 0
        while Date() < deadline && hops < 8 {
            if any("home-screen").exists { return }
            if let s = hittable("onboarding-start") { s.tap(); hops += 1; Thread.sleep(forTimeInterval: 1.5); continue }
            if let c = hittable("onboarding-continue") { c.tap(); hops += 1; Thread.sleep(forTimeInterval: 0.8); continue }
            Thread.sleep(forTimeInterval: 0.5)
        }
    }

    private func dismissAppAlert(prefer: [String] = []) {
        let alert = app.alerts.firstMatch
        guard alert.waitForExistence(timeout: 2) else { return }
        NSLog("[klenzer-qa] app alert: \(alert.label)")
        for label in prefer + ["Not now", "OK", "Cancel"] {
            let b = alert.buttons[label]
            if b.exists { b.tap(); Thread.sleep(forTimeInterval: 0.8); return }
        }
        alert.buttons.firstMatch.tap()
    }

    private func confirmStoreSheet() {
        // With SKTestSession.disableDialogs no sheet appears. If one does, confirm it.
        Thread.sleep(forTimeInterval: 3)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for target in [app!, springboard] {
            for label in ["Subscribe", "Purchase", "Buy", "Confirm", "OK"] {
                let b = target.buttons[label]
                if b.exists && b.isHittable { shot("08-store-sheet"); b.tap(); Thread.sleep(forTimeInterval: 2); return }
            }
        }
    }


    /// Look for the scan-complete banner or an entry in Notification Center.
    private func waitForScanNotification(timeout: TimeInterval) -> String? {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let pred = NSPredicate(format: "label CONTAINS[c] %@", "Scan complete")
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            let banner = springboard.descendants(matching: .any).matching(pred).firstMatch
            if banner.exists {
                return banner.label
            }
            Thread.sleep(forTimeInterval: 1)
        }
        // Banner may have already dismissed; open Notification Center and look again.
        openNotificationCenter(springboard)
        Thread.sleep(forTimeInterval: 1)
        let row = springboard.descendants(matching: .any).matching(pred).firstMatch
        if row.exists { return row.label }
        return nil
    }

    private func openNotificationCenter(_ springboard: XCUIApplication) {
        let frame = springboard.frame
        guard frame.height > 0 else { return }
        let start = springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.01))
        let end = springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.7))
        start.press(forDuration: 0.05, thenDragTo: end)
    }

    /// The Photos access sheet belongs to SpringBoard, so the interruption monitor does not see it while
    /// the test only polls. Tap Allow Full Access directly when it shows.
    @discardableResult
    private func allowPhotosIfAsked() -> Bool {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for label in ["Allow Full Access", "Allow Access to All Photos"] {
            let b = springboard.buttons[label]
            if b.exists && b.isHittable {
                NSLog("[klenzer-qa] tapped Photos access: \(label)")
                b.tap()
                Thread.sleep(forTimeInterval: 1)
                return true
            }
        }
        return false
    }

    private func waitForScan(timeout: TimeInterval) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        let bar = any("scan-bar")
        var sawBar = false
        while Date() < deadline {
            allowPhotosIfAsked()
            if app.alerts.firstMatch.exists { return true } // reminder prompt appears when a scan finishes
            if bar.exists { sawBar = true }
            if sawBar && !bar.exists { return true }
            if !sawBar && firstNonZeroCategory() != nil && Date() > deadline.addingTimeInterval(-timeout + 20) { return true }
            Thread.sleep(forTimeInterval: 1)
        }
        return false
    }

    private func firstNonZeroCategory() -> String? {
        let pred = NSPredicate(format: "label MATCHES %@", "^(Similar|Duplicate|Blurry|Screenshots|Live Photos), [1-9][0-9,]* items$")
        let m = app.descendants(matching: .any).matching(pred).firstMatch
        return m.exists ? m.label : nil
    }

    private func hasText(_ candidates: [String]) -> Bool {
        let deadline = Date().addingTimeInterval(12)
        while Date() < deadline {
            for t in candidates {
                if app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", t)).firstMatch.exists { return true }
            }
            Thread.sleep(forTimeInterval: 0.5)
        }
        return false
    }

    private func waitGone(_ el: XCUIElement, timeout: TimeInterval) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if !el.exists { return true }
            Thread.sleep(forTimeInterval: 0.5)
        }
        return !el.exists
    }

    private func shot(_ name: String) {
        let s = XCUIScreen.main.screenshot()
        try? s.pngRepresentation.write(to: outDir.appendingPathComponent("\(name).png"))
        let a = XCTAttachment(screenshot: s)
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }

    private func record(_ step: Int, _ name: String, _ pass: Bool, _ detail: String) {
        results.append(["step": step, "name": name, "pass": pass, "detail": detail])
        writeResults()
        NSLog("[klenzer-qa] step \(step) \(pass ? "PASS" : "FAIL") \(name): \(detail)")
    }

    private func writeResults() {
        if let data = try? JSONSerialization.data(withJSONObject: ["steps": results], options: [.prettyPrinted]) {
            try? data.write(to: outDir.appendingPathComponent("results.json"))
        }
    }
}
