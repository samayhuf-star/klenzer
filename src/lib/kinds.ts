import { colors } from '../theme';

export type Kind = 'photos' | 'duplicates' | 'similar' | 'blurry' | 'screenshots' | 'videos' | 'videoDuplicates' | 'shortVideos' | 'screenRecordings' | 'live' | 'temp' | 'forwarded' | 'aiImages';

export const KINDS: Record<Kind, { title: string; icon: string; tone: string; soft: string }> = {
  photos: { title: 'Photos', icon: 'image', tone: colors.sky, soft: colors.skySoft },
  similar: { title: 'Similar', icon: 'images', tone: colors.blue, soft: colors.blueSoft },
  duplicates: { title: 'Duplicate', icon: 'copy', tone: colors.violet, soft: colors.violetSoft },
  blurry: { title: 'Blurry', icon: 'eye-off', tone: colors.amber, soft: colors.amberSoft },
  screenshots: { title: 'Screenshots', icon: 'phone-portrait', tone: colors.coral, soft: colors.coralSoft },
  videos: { title: 'Large videos', icon: 'film', tone: colors.amber, soft: colors.amberSoft },
  videoDuplicates: { title: 'Duplicate videos', icon: 'videocam', tone: colors.violet, soft: colors.violetSoft },
  shortVideos: { title: 'Short recordings', icon: 'timer-outline', tone: colors.sky, soft: colors.skySoft },
  screenRecordings: { title: 'Screen recordings', icon: 'recording-outline', tone: colors.coral, soft: colors.coralSoft },
  live: { title: 'Live Photos', icon: 'aperture', tone: '#0BAE86', soft: colors.mintSoft },
  forwarded: { title: 'Forwarded', icon: 'arrow-redo', tone: '#0BAE86', soft: colors.mintSoft },
  aiImages: { title: 'AI Images', icon: 'sparkles', tone: colors.violet, soft: colors.violetSoft },
  temp: { title: 'Temporary files', icon: 'folder-open', tone: colors.danger, soft: colors.dangerSoft },
};
