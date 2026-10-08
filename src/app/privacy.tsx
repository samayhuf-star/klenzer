import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components/PressableScale';
import { PRIVACY_SECTIONS, PRIVACY_UPDATED } from '../lib/privacy';
import { colors, fonts } from '../theme';

export default function Privacy() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </PressableScale>
        <Text style={styles.title}>Privacy Policy</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 18 }}>
        <Text style={styles.updated}>Last updated {PRIVACY_UPDATED}</Text>
        {PRIVACY_SECTIONS.map((s) => (
          <View key={s.h} style={{ gap: 6 }}>
            <Text style={styles.h}>{s.h}</Text>
            <Text style={styles.p}>{s.p}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 10 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  updated: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink3 },
  h: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  p: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink2 },
});
