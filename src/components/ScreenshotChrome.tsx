import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { screenshotScene } from '../lib/screenshotMode';
import { fonts } from '../theme';

/** Status bar and home indicator drawn over the real UI for store captures. */
export function ScreenshotStatusBar() {
  if (!screenshotScene()) return null;
  return (
    <View pointerEvents="none" style={styles.bar}>
      <View style={styles.statusBg} />
      <Text style={styles.time}>9:41</Text>
      <View style={styles.islandWrap}>
        <View style={styles.island} />
      </View>
      <View style={styles.icons}>
        <Ionicons name="cellular" size={16} color="#0B1020" />
        <Ionicons name="wifi" size={16} color="#0B1020" />
        <Ionicons name="battery-full" size={20} color="#0B1020" />
      </View>
      <View style={styles.homeWrap}>
        <View style={styles.home} />
      </View>
    </View>
  );
}

/**
 * The system confirmation PhotoKit shows when the app calls deleteAssets.
 * Web cannot present that OS alert, so the screenshot build draws the same dialog
 * over the review screen the moment the user would see it.
 */
export function SystemDeleteDialog({ count, noun }: { count: number; noun: 'photo' | 'video' }) {
  const plural = count === 1 ? noun : `${noun}s`;
  const these = count === 1 ? `This ${noun}` : `These ${plural}`;
  return (
    <View pointerEvents="none" style={styles.dim}>
      <View style={styles.alert}>
        <Text style={styles.title}>{`Allow “Ai Klenzer” to delete ${count} ${plural}?`}</Text>
        <Text style={styles.message}>
          {`${these} will be deleted from iCloud Photos on all your devices and moved to Recently Deleted for 30 days.`}
        </Text>
        <View style={styles.actions}>
          <Text style={styles.dont}>Don't Allow</Text>
          <View style={styles.split} />
          <Text style={styles.delete}>Delete</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 80,
  },
  statusBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 54, backgroundColor: '#F4F7FF' },
  time: {
    position: 'absolute',
    top: 18,
    left: 28,
    fontFamily: fonts.semi,
    fontSize: 16,
    color: '#0B1020',
    letterSpacing: 0.2,
  },
  islandWrap: { position: 'absolute', top: 11, left: 0, right: 0, alignItems: 'center' },
  island: { width: 124, height: 36, borderRadius: 20, backgroundColor: '#000' },
  icons: {
    position: 'absolute',
    top: 18,
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  homeWrap: { position: 'absolute', bottom: 8, left: 0, right: 0, alignItems: 'center' },
  home: { width: 134, height: 5, borderRadius: 3, backgroundColor: '#0B1020' },
  dim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    paddingHorizontal: 24,
  },
  alert: {
    width: 270,
    borderRadius: 14,
    backgroundColor: 'rgba(242,242,247,0.97)',
    overflow: 'hidden',
  },
  title: {
    fontFamily: fonts.semi,
    fontSize: 17,
    lineHeight: 22,
    color: '#000',
    textAlign: 'center',
    paddingTop: 19,
    paddingHorizontal: 16,
  },
  message: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 16,
    color: '#000',
    textAlign: 'center',
    paddingTop: 6,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.36)',
    height: 44,
    alignItems: 'center',
  },
  split: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(60,60,67,0.36)' },
  dont: { flex: 1, textAlign: 'center', fontFamily: fonts.body, fontSize: 17, color: '#007AFF' },
  delete: { flex: 1, textAlign: 'center', fontFamily: fonts.semi, fontSize: 17, color: '#FF3B30' },
});
