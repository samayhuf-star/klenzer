import { colors } from '../theme';

export type Kind = 'duplicates' | 'similar' | 'blurry' | 'screenshots' | 'videos' | 'live' | 'temp';

export const KINDS: Record<Kind, { title: string; icon: string; tone: string; soft: string }> = {
  similar: { title: 'Similar', icon: 'images', tone: colors.blue, soft: colors.blueSoft },
  duplicates: { title: 'Duplicate', icon: 'copy', tone: colors.violet, soft: colors.violetSoft },
  blurry: { title: 'Blurry', icon: 'eye-off', tone: colors.amber, soft: colors.amberSoft },
  screenshots: { title: 'Screenshots', icon: 'phone-portrait', tone: '#E85D9C', soft: '#FDE8F2' },
  videos: { title: 'Large videos', icon: 'videocam', tone: colors.amber, soft: colors.amberSoft },
  live: { title: 'Live Photos', icon: 'aperture', tone: '#0BAE86', soft: colors.mintSoft },
  temp: { title: 'Temporary files', icon: 'folder-open', tone: colors.danger, soft: colors.dangerSoft },
};
