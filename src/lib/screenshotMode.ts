import { Platform } from 'react-native';

/** Store-screenshot captures. Off unless the web bundle is built with this flag. */
export const SHOT_SCENES = ['home', 'scanning', 'results', 'duplicates', 'control', 'privacy'] as const;
export type ShotScene = (typeof SHOT_SCENES)[number];

export function screenshotsEnabled(): boolean {
  return process.env.EXPO_PUBLIC_SCREENSHOTS === '1';
}

export function screenshotScene(): ShotScene | null {
  if (!screenshotsEnabled()) return null;
  if (typeof window === 'undefined') return 'home';
  const raw = new URLSearchParams(window.location.search).get('shot');
  return (SHOT_SCENES as readonly string[]).includes(raw ?? '') ? (raw as ShotScene) : 'home';
}

/** iPhone layout and copy. Screenshot captures preview that UI on web. */
export function isIosUi(): boolean {
  return Platform.OS === 'ios' || screenshotsEnabled();
}

/** iPhone 16 Pro Max safe area, in points. The capture viewport matches this frame. */
export const SHOT_METRICS = {
  insets: { top: 59, bottom: 34, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 430, height: 932 },
};
