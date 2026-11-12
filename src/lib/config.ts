// Public legal and support URLs. Both stores require a reachable privacy policy and support page.
export const SUPPORT_EMAIL = 'samayhuf@gmail.com';
export const PRIVACY_URL = 'https://samayhuf-star.github.io/app-legal/klenzer/privacy.html';
export const TERMS_URL = 'https://samayhuf-star.github.io/app-legal/klenzer/terms.html';
export const SUPPORT_URL = 'https://samayhuf-star.github.io/app-legal/klenzer/support.html';
export const APP_NAME = 'Klenzer';

// RevenueCat. Public SDK keys (they start with appl_ / goog_) go in EAS env vars or a local .env file:
//   EXPO_PUBLIC_RC_IOS_KEY, EXPO_PUBLIC_RC_ANDROID_KEY
export const RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '';
export const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '';
/** The one entitlement every paid product (monthly and lifetime) unlocks in RevenueCat. */
export const RC_ENTITLEMENT = 'klenzer_pro';
/** Optional RevenueCat offering shown once, with a better price, when the user closes the paywall. */
export const RC_SECOND_CHANCE_OFFERING = 'second_chance';
// Expected App Store product IDs. The paywall loads packages from RevenueCat offerings (lifetime / monthly
// package types) and shows the store's priceString; these IDs are not hard-coded in the purchase flow:
// com.krosz.klenzer.lifetime, com.krosz.klenzer.monthly.
