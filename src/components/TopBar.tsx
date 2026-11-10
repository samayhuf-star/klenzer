import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { PressableScale } from './PressableScale';

export function TopBar({ title, right }: { title: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
      <PressableScale onPress={() => router.back()} accessibilityLabel="Back" style={styles.side}>
        <Ionicons name="chevron-back" size={24} color={colors.ink} />
      </PressableScale>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 10 },
  side: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
});
