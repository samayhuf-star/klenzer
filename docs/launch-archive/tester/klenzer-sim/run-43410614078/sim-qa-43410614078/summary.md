# Klenzer iOS Simulator QA

xcodebuild test exit: 0

| Step | Result | Detail |
| --- | --- | --- |
| 1. Launch | PASS | home shown directly |
| 21. Mid-scan cards show progress, not None yet | PASS | scanningNote=false noneYetWhileScanning=false |
| 10. Scan-complete notification | FAIL | banner=none |
| 2. Home after scan | FAIL | scanFinished=false firstNonZero=none |
| 22. Duplicate card count and review | FAIL | tile=Duplicate, 0 items count=0 min=5 reviewOpened=false |
| 23. Blurry card count and review | FAIL | tile=Blurry, 0 items count=0 min=5 reviewOpened=false |
| 3. Similar review | FAIL | tile: Similar, 0 items; zero items, not opened |
| 4. Swipe to Organize | FAIL | swipe screen not reached |
| 5. Merge Contacts preview | PASS | group: Group of 3 contacts, Chris Park; preview shown |
| 6. Secret Album | PASS | PIN set, album open |
| 7. Paywall prices and trial copy | FAIL | yearly $19.99=true monthly $3.99=true lifetime $29.99=true monthTrial=true yearTrial=true lifetimeOnce=false lifetimeTrialText=false unavailable=false |
| 8. StoreKit test purchase (monthly) starts a trial | FAIL | session=true; skipped, paywall prices missing |
| 9. Restore purchases | FAIL | not on Settings |
