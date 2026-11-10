import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components/PressableScale';
import { formatBytes } from '../lib/format';
import { SUPPORT_EMAIL } from '../lib/config';
import { useStore } from '../lib/store';
import { useUnlock } from '../lib/unlock';
import { colors, fonts, gold, radius, shadow } from '../theme';

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { access, openSettings, lifetimeFreed, reminders, setReminders } = useStore();
  const { unlocked, requireUnlock, restore } = useUnlock();
  const toggle = async (on: boolean) => {
    if ((await setReminders(on)) === 'blocked') {
      Alert.alert('Notifications are off', 'Turn on notifications for Klenzer in Settings to get reminders.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: openSettings },
      ]);
    }
  };
  const accessLabel = access === 'granted' ? 'Full access' : access === 'limited' ? 'Limited' : access === 'denied' ? 'Off' : 'Not asked yet';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </PressableScale>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 16 }}>
        {!unlocked && (
          <PressableScale onPress={() => requireUnlock(() => {})} accessibilityLabel="Unlock Klenzer Pro">
            <LinearGradient colors={['#0B1020', colors.blue]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pro}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.proTitle}>Klenzer PRO</Text>
                <Text style={styles.proSub}>Clean duplicates, merge contacts, lock files away.</Text>
                <View style={styles.proBtn}><Text style={styles.proBtnText}>Get it now</Text></View>
              </View>
              <Ionicons name="ribbon" size={64} color={gold} />
            </LinearGradient>
          </PressableScale>
        )}
        <View style={styles.card}>
          <Row icon="images-outline" label="Photo access" value={accessLabel} onPress={openSettings} />
          <Row icon="leaf-outline" label="Space freed" value={formatBytes(lifetimeFreed)} />
          <Row icon="refresh-outline" label="Restore purchase" onPress={() => restore()} chevron />
          <View style={styles.row}>
            <Ionicons name="notifications-outline" size={22} color={colors.blue} />
            <Text style={styles.label}>Cleanup reminders</Text>
            <Switch value={reminders} onValueChange={toggle} trackColor={{ true: colors.blue }} />
          </View>
        </View>
        <View style={styles.card}>
          <Row icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => router.push('/privacy')} chevron />
          <Row icon="star-outline" label="Rate Klenzer" onPress={async () => (await StoreReview.hasAction()) && StoreReview.requestReview()} chevron />
          <Row icon="mail-outline" label="Contact support" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Klenzer%20support`)} chevron />
        </View>
        <View style={styles.card}>
          <Row icon="lock-closed-outline" label="Your photos stay on this device" />
        </View>
        <Text style={styles.ver}>Klenzer {Application.nativeApplicationVersion} ({Application.nativeBuildVersion})</Text>
      </ScrollView>
    </View>
  );
}

function Row({ icon, label, value, onPress, chevron }: { icon: string; label: string; value?: string; onPress?: () => void; chevron?: boolean }) {
  const body = (
    <View style={styles.row}>
      <Ionicons name={icon as never} size={22} color={colors.blue} />
      <Text style={styles.label}>{label}</Text>
      {value && <Text style={styles.value}>{value}</Text>}
      {chevron && <Ionicons name="chevron-forward" size={18} color={colors.ink3} />}
    </View>
  );
  return onPress ? <PressableScale onPress={onPress} haptic={false}>{body}</PressableScale> : body;
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 10 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 17, paddingHorizontal: 18 },
  label: { flex: 1, fontFamily: fonts.semi, fontSize: 16, color: colors.ink },
  value: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink3 },
  pro: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: 20, gap: 12 },
  proTitle: { fontFamily: fonts.bold, fontSize: 22, color: '#fff' },
  proSub: { fontFamily: fonts.body, fontSize: 13.5, color: '#C9D3FF', lineHeight: 19 },
  proBtn: { alignSelf: 'flex-start', backgroundColor: colors.blue, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  proBtnText: { fontFamily: fonts.bold, fontSize: 14, color: '#fff' },
  ver: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink3, textAlign: 'center', marginTop: 8 },
});
