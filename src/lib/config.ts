// Fill these in before submitting; both stores require a reachable privacy policy and support contact.
export const SUPPORT_EMAIL = 'samayhuf@gmail.com';
export const PRIVACY_URL = 'https://klenzer-privacy-krosz.vercel.app';
export const APP_NAME = 'Klenzer';

// RevenueCat. Public SDK keys (they start with appl_ / goog_) go in EAS env vars or a local .env file:
//   EXPO_PUBLIC_RC_IOS_KEY, EXPO_PUBLIC_RC_ANDROID_KEY
export const RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '';
export const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '';
/** The one entitlement every paid product (monthly and lifetime) unlocks in RevenueCat. */
export const RC_ENTITLEMENT = 'klenzer_pro';
/** Optional RevenueCat offering shown once, with a better price, when the user closes the paywall. */
export const RC_SECOND_CHANCE_OFFERING = 'second_chance';
/** Terms of Use link shown on the paywall (Apple's standard EULA unless you host your own). */
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
