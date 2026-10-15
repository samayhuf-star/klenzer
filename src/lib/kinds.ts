import { colors } from '../theme';

export type Kind = 'duplicates' | 'screenshots' | 'videos' | 'live' | 'temp';

export const KINDS: Record<Kind, { title: string; icon: string; tone: string; soft: string }> = {
  duplicates: { title: 'Duplicates & near-identical', icon: 'copy', tone: colors.blue, soft: colors.blueSoft },
  screenshots: { title: 'Screenshots', icon: 'phone-portrait', tone: colors.violet, soft: colors.violetSoft },
  videos: { title: 'Large videos', icon: 'videocam', tone: colors.amber, soft: colors.amberSoft },
  live: { title: 'Live Photos', icon: 'aperture', tone: '#0BAE86', soft: colors.mintSoft },
  temp: { title: 'Temporary files', icon: 'folder-open', tone: colors.danger, soft: colors.dangerSoft },
};
