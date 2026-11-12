import { colors } from '../theme';

export type Kind = 'photos' | 'duplicates' | 'similar' | 'blurry' | 'screenshots' | 'videos' | 'videoDuplicates' | 'shortVideos' | 'screenRecordings' | 'live' | 'temp';

export const KINDS: Record<Kind, { title: string; icon: string; tone: string; soft: string }> = {
  photos: { title: 'Photos', icon: 'image', tone: '#1483C8', soft: '#E4F3FB' },
  similar: { title: 'Similar', icon: 'images', tone: colors.blue, soft: colors.blueSoft },
  duplicates: { title: 'Duplicate', icon: 'copy', tone: colors.violet, soft: colors.violetSoft },
  blurry: { title: 'Blurry', icon: 'eye-off', tone: colors.amber, soft: colors.amberSoft },
  screenshots: { title: 'Screenshots', icon: 'phone-portrait', tone: '#E85D9C', soft: '#FDE8F2' },
  videos: { title: 'Large videos', icon: 'film', tone: colors.amber, soft: colors.amberSoft },
  videoDuplicates: { title: 'Duplicate videos', icon: 'videocam', tone: colors.violet, soft: colors.violetSoft },
  shortVideos: { title: 'Short recordings', icon: 'timer-outline', tone: '#1483C8', soft: '#E4F3FB' },
  screenRecordings: { title: 'Screen recordings', icon: 'recording-outline', tone: '#E85D9C', soft: '#FDE8F2' },
  live: { title: 'Live Photos', icon: 'aperture', tone: '#0BAE86', soft: colors.mintSoft },
  temp: { title: 'Temporary files', icon: 'folder-open', tone: colors.danger, soft: colors.dangerSoft },
};
