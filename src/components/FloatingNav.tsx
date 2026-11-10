import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, shadow } from '../theme';
import { PressableScale } from './PressableScale';

function Item({ icon, label, on, onPress }: { icon: string; label: string; on?: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={[styles.item, on && { backgroundColor: colors.blueSoft }]}>
      <Ionicons name={icon as never} size={21} color={on ? colors.blue : colors.ink} />
      <Text style={[styles.label, on && { color: colors.blue }]}>{label}</Text>
    </PressableScale>
  );
}

export type NavTab = 'clean' | 'tools';

/** Floating pill navigation: Clean (home), Smart Clean, Tools and Settings. */
export function FloatingNav({ tab, onTab }: { tab: NavTab; onTab: (t: NavTab) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View entering={FadeInUp.delay(300).duration(500)} style={[styles.wrap, { bottom: insets.bottom + 10 }]} pointerEvents="box-none">
      <View style={styles.bar}>
        <Item icon="sparkles" label="Clean" on={tab === 'clean'} onPress={() => onTab('clean')} />
        <Item icon="flash" label="Smart" onPress={() => router.push('/smart')} />
        <Item icon="apps" label="Tools" on={tab === 'tools'} onPress={() => onTab('tools')} />
        <Item icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  bar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 34, padding: 6, justifyContent: 'space-between', ...shadow },
  item: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: 28 },
  label: { fontFamily: fonts.medium, fontSize: 11, color: colors.ink },
});
