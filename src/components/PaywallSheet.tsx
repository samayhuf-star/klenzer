import { Ionicons } from '@expo/vector-icons';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatBytes } from '../lib/format';
import { dupReclaimable, sum } from '../lib/scanner';
import { useStore } from '../lib/store';
import { useUnlock } from '../lib/unlock';
import { colors, fonts, radius } from '../theme';
import { Button } from './Button';
import { PressableScale } from './PressableScale';

const PERKS = ['Clear duplicates, screenshots and large videos', 'Quick clean in one tap', 'Lifetime access, no subscription'];

/** Payment sheet shown when someone taps Fix now or any delete button before unlocking. Scanning never reaches it. */
export function PaywallSheet() {
  const insets = useSafeAreaInsets();
  const { paywallOpen, price, busy, error, buy, restore, closePaywall } = useUnlock();
  const { result, tempSize } = useStore();

  const found = result
    ? dupReclaimable(result.duplicates) + sum(result.screenshots) + sum(result.largeVideos) + (Platform.OS === 'ios' ? sum(result.livePhotos) : 0) + tempSize
    : 0;
  const store = Platform.OS === 'ios' ? 'Apple ID' : 'Google account';

  return (
    <Modal visible={paywallOpen} transparent animationType="slide" onRequestClose={closePaywall} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : closePaywall} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grab} />
          <View style={styles.badge}>
            <Ionicons name="lock-open" size={22} color={colors.blue} />
          </View>
          <Text style={styles.title}>Unlock Klenzer</Text>
          <Text style={styles.sub}>
            {found > 0 ? `Your scan found ${formatBytes(found)} you can clear. ` : ''}Unlock once to start cleaning.
          </Text>

          <View style={styles.perks}>
            {PERKS.map((p) => (
              <View key={p} style={styles.perk}>
                <Ionicons name="checkmark" size={16} color="#0F8F6E" />
                <Text style={styles.perkText}>{p}</Text>
              </View>
            ))}
          </View>

          <View style={styles.plan}>
            <Text style={styles.planName}>Lifetime unlock</Text>
            <Text style={styles.planPrice}>{price}</Text>
          </View>

          <Button label={`Unlock for ${price}`} onPress={buy} busy={busy === 'buy'} disabled={busy !== null} />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.links}>
            <PressableScale onPress={restore} disabled={busy !== null} accessibilityLabel="Restore purchase">
              <Text style={styles.link}>{busy === 'restore' ? 'Restoring…' : 'Restore purchase'}</Text>
            </PressableScale>
            <Text style={styles.dot}>·</Text>
            <PressableScale onPress={closePaywall} disabled={busy === 'buy'} accessibilityLabel="Not now">
              <Text style={styles.link}>Not now</Text>
            </PressableScale>
          </View>
          <Text style={styles.foot}>One-time payment charged to your {store}. Nothing is deleted until you unlock.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,16,32,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: 22, paddingTop: 12, alignItems: 'stretch' },
  grab: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 16 },
  badge: { alignSelf: 'center', width: 50, height: 50, borderRadius: 16, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  title: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink2, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  perks: { gap: 8, marginBottom: 16 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, flexShrink: 1 },
  plan: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: colors.blue, backgroundColor: colors.blueSoft, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 16, marginBottom: 12 },
  planName: { fontFamily: fonts.semi, fontSize: 15, color: colors.ink },
  planPrice: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.danger, textAlign: 'center', marginTop: 10 },
  links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14 },
  link: { fontFamily: fonts.semi, fontSize: 14, color: colors.blue },
  dot: { color: colors.ink3 },
  foot: { fontFamily: fonts.body, fontSize: 12, color: colors.ink3, textAlign: 'center', marginTop: 8 },
});
