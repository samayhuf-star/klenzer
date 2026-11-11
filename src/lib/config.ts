// Fill these in before submitting; both stores require a reachable privacy policy and support contact.
export const SUPPORT_EMAIL = 'samayhuf@gmail.com';
export const PRIVACY_URL = 'https://klenzer-privacy-krosz.vercel.app';
export const APP_NAME = 'Klenzer';

// RevenueCat. Public SDK keys are safe to ship; set them as EAS env vars (EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY).
// Entitlement "pro" unlocks cleaning. Products, offerings and the paywall design live in the RevenueCat dashboard.
export const ENTITLEMENT_ID = 'klenzer_pro';
export const RC_API_KEY_IOS = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '';
export const RC_API_KEY_ANDROID = process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '';
