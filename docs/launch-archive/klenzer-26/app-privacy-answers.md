# Klenzer App Privacy (nutrition label) answers, from the code at klenzer/features (build 26 candidate)

The public App Store Connect API does not expose App Privacy, so Samay sets this in the web UI:
App Store Connect > Apps > Klenzer: Phone Storage Cleaner > App Privacy > Data Types > Edit.

## Evidence from the code
- No analytics, crash-reporting, ads or attribution SDK in package.json (grep for sentry, firebase, amplitude, mixpanel, revenuecat, react-native-purchases: no hits).
- No network calls in src/ (grep for fetch(, axios, XMLHttpRequest: no hits outside the dev-only demo file).
- No push token is requested (no getExpoPushTokenAsync / getDevicePushTokenAsync). Notifications are local only.
- Purchases use expo-iap (StoreKit 2) on the device; entitlement checks stay on the device. No server of ours, no third-party purchase service.
- Photos, videos, contacts, Secret Album and the daily free count are processed and stored on the device only.

Apple only counts data as "collected" when it leaves the device and the developer or a third-party partner can access it. Nothing in Klenzer does that. StoreKit purchase handling by Apple is not developer collection.

## Answer to set
"Do you or your third-party partners collect data from this app?" -> **No, we do not collect data from this app.**
Result on the listing: **Data Not Collected**.

| Data type | Collected | Linked to user | Used for tracking | Purposes |
|---|---|---|---|---|
| Purchases (Purchase History) | No | n/a | No | n/a (StoreKit on device only) |
| Identifiers (User ID, Device ID) | No | n/a | No | n/a (no app user ID; the old RevenueCat anonymous ID is gone) |
| Photos or Videos | No | n/a | No | n/a (processed on device, never uploaded) |
| Contacts | No | n/a | No | n/a (read and merged on device, never uploaded) |
| Sensitive Info / biometrics | No | n/a | No | n/a (Face ID handled by iOS; app receives only pass/fail) |
| Usage Data, Diagnostics, Location, Contact Info, Financial Info, Health, Browsing, Search, Other | No | n/a | No | n/a |

Tracking: **No** (no ATT prompt, no IDFA, no data shared with data brokers).

## What must change versus the current label
The audit and Samay's rule say the current label still reflects RevenueCat (anonymous app user ID / purchase history collected by a third party). If any data types are listed now (typically Purchases > Purchase History and Identifiers > User ID or Device ID, "App Functionality", "Not linked" or "Linked"), delete every one of them and switch the top answer to "No, we do not collect data from this app", then Publish. There is no separate third-party list in App Privacy; removing those data types removes RevenueCat from the label.

Status: NOT DONE by API (cannot be). FAIL until Samay publishes it in the web UI.
