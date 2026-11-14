# Release 1.1.1 screenshots

These are **web approximations**, not native iOS simulator captures. This environment has no iOS simulator. They were rendered with `EXPO_PUBLIC_DEMO=1 npx expo start --web` in a 430×932 CSS viewport at device scale 3, so each PNG is **1290×2796** (iPhone 6.7").

Demo mode is dev-only (`__DEV__` and `EXPO_PUBLIC_DEMO=1`). It is off in production. Photo tiles are synthetic color fields served locally, not a real camera roll. The paywall prices and the 7-day trial line are the demo stand-in for StoreKit: yearly $19.99, monthly $3.99, lifetime $29.99, with a trial only on the subscriptions. On a device the trial appears only when StoreKit says the Apple ID is eligible, and the prices are the store’s `displayPrice`.

| File | Screen |
|---|---|
| `01-home.png` | Home after a demo scan. Ai Klenzer name, blue storage card, Smart Clean, Photos / Videos / Contacts. |
| `02-scanning.png` | Scan in progress, large card only: percent, per-category bars, leave-running note, Cancel. `?shot=scanning` forces this state in demo only. |
| `03-similar-photos.png` | Similar-photo review. Largest file kept, extras selected, 10 free items left. |
| `04-swipe.png` | Swipe to Organize, month chips, keep / delete. |
| `05-paywall-trial.png` | Paywall. Yearly selected, “7 days free, then $19.99/year, cancel anytime”. Monthly has the same trial. Lifetime does not. |
| `06-settings.png` | Settings. Photo access, plan, restore, reminders, legal links. Version and build are blank on web because those come from the native binary. |
