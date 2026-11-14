# Klenzer iOS Simulator QA

xcodebuild test exit: 0

seed.txt:
```
photos seeded: 400 (5 exact pairs, 8 blurry, 20 near pairs, 6 similar bursts x3, 20 screenshots)
live photos: result=generate_failed 
contacts seeded: 10
```

permission-assert.txt:
```
PASS: Klenzer asks Photos for read-write access only (writeOnly=false, no add-only)
```

grants.txt:
```
grant photos: ok
grant contacts: ok
```

| Step | Result | Detail |
| --- | --- | --- |
| 1. Launch | PASS | home shown directly |
| 21. Mid-scan cards show progress, not None yet | PASS | scanBarSeen=true scanningNote=true noneYetWhileScanning=false |
| 10. Scan-complete notification | PASS | banner=KLENZER, now, Klenzer, Scan complete: 338 KB can be freed realNumber=true |
| 2. Home after scan | PASS | scanFinished=true firstNonZero=Similar, 73 items counts=Similar, 73 items; Duplicate, 72 items; Blurry, 8 items; Screenshots, 0 items |
| 22. Duplicate card count and review | PASS | tile=missing count=72 min=5 reviewOpened=true |
| 23. Blurry card count and review | PASS | tile=missing count=8 min=5 reviewOpened=true |
| 3. Similar review | PASS | tile: Similar, 73 items; group shown: Nov 13, 2026 · 2 similar |
| 24. Live Photos counted | FAIL | tile=missing count=0 |
| 4. Swipe to Organize | PASS | swipe-screen shown |
| 5. Merge Contacts preview | PASS | group: Group of 3 contacts, Chris Park; preview shown |
| 6. Secret Album | PASS | PIN set, album open |
| 7. Paywall prices and trial copy | PASS | yearly $19.99=true monthly $3.99=true lifetime $29.99=true monthTrial=true yearTrial=true lifetimeOnce=true lifetimeTrialText=false lifetimeLabel=Lifetime plan, $29.99, Pay once, clean forever. unavailable=false |
| 8. StoreKit test purchase (monthly) starts a trial | PASS | session=true paywallClosed=true; Settings shows Plan: Pro; trial 7.0d |
| 9. Restore purchases | PASS | alert: Restored |
