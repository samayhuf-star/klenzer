import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, LinearTransition, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { CountUp } from '../components/CountUp';
import { ScanPulse } from '../components/ScanPulse';
import { formatBytes } from '../lib/format';
import { KINDS } from '../lib/kinds';
import { CleanRow, useStore } from '../lib/store';
import { colors, fonts } from '../theme';

export default function Cleaning() {
  const { cleaning } = useStore();
  const insets = useSafeAreaInsets();
  const phase = cleaning?.phase ?? 'finished';

  useEffect(() => {
    if (phase === 'finished') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const t = setTimeout(() => router.replace('/done'), 900);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const rows = cleaning?.rows ?? [];
  const finishedRows = rows.filter((r) => r.status === 'done').length;
  const headline =
    phase === 'cancelled' ? 'Nothing was deleted' : phase === 'error' ? 'Something went wrong' : phase === 'finished' ? 'Cleaned!' : 'Cleaning your device…';

  return (
    <LinearGradient colors={['#0B1020', '#12307A']} style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
      <View style={{ alignItems: 'center', gap: 14 }}>
        {phase === 'working' ? (
          <ScanPulse size={150} icon="trash" color={colors.mint} />
        ) : (
          <Animated.View entering={FadeInUp} style={{ height: 150, justifyContent: 'center' }}>
            <Ionicons name={phase === 'finished' ? 'checkmark-circle' : 'alert-circle'} size={96} color={phase === 'finished' ? colors.mint : colors.amber} />
          </Animated.View>
        )}
        <Text style={styles.title}>{headline}</Text>
        {(cleaning?.freed ?? 0) > 0 || phase === 'working' ? (
          <CountUp value={rows.reduce((n, r) => n + (r.status === 'done' ? r.bytes : 0), 0)} format={(n) => `${formatBytes(n)} cleared`} duration={500} style={styles.sub} />
        ) : null}
        <Text style={styles.hint}>
          {phase === 'working' ? `${finishedRows} of ${rows.length} finished` : phase === 'cancelled' ? 'You cancelled the confirmation.' : phase === 'error' ? 'Nothing was removed.' : ''}
        </Text>
      </View>

      <View style={{ gap: 10, marginTop: 28 }}>
        {rows.map((r, i) => (
          <Row key={r.kind} row={r} index={i} />
        ))}
      </View>

      <View style={{ flex: 1 }} />
      {(phase === 'cancelled' || phase === 'error') && <Button variant="light" label="Back" onPress={() => router.back()} />}
    </LinearGradient>
  );
}

function Row({ row, index }: { row: CleanRow; index: number }) {
  const k = KINDS[row.kind];
  const pct = row.status === 'done' ? 1 : row.count ? row.done / row.count : row.status === 'active' ? 0.1 : 0;
  const bar = useAnimatedStyle(() => ({ width: withTiming(`${Math.round(pct * 100)}%`, { duration: 350 }) }), [pct]);
  return (
    <Animated.View entering={FadeInDown.delay(index * 120)} layout={LinearTransition} style={styles.row}>
      <View style={[styles.icon, { backgroundColor: k.soft }]}>
        <Ionicons name={k.icon as never} size={20} color={k.tone} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{k.title}</Text>
          <Text style={styles.rowMeta}>
            {row.kind === 'temp' && row.status !== 'done' ? '' : `${row.count.toLocaleString()} items · `}
            {row.bytes > 0 ? formatBytes(row.bytes) : ''}
          </Text>
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { backgroundColor: row.status === 'cancelled' ? colors.amber : colors.mint }, bar]} />
        </View>
        {row.note ? <Text style={styles.note}>{row.note}</Text> : null}
      </View>
      <View style={{ width: 26, alignItems: 'center' }}>
        {row.status === 'done' ? (
          <Animated.View entering={FadeInUp.springify()}>
            <Ionicons name="checkmark-circle" size={24} color={colors.mint} />
          </Animated.View>
        ) : row.status === 'active' ? (
          <ActivityIndicator color="#fff" />
        ) : row.status === 'cancelled' ? (
          <Ionicons name="close-circle" size={24} color={colors.amber} />
        ) : (
          <Ionicons name="ellipse-outline" size={22} color="#6E7FB0" />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22 },
  title: { fontFamily: fonts.display, fontSize: 30, color: '#fff', letterSpacing: -0.5, textAlign: 'center' },
  sub: { fontFamily: fonts.bold, fontSize: 20, color: colors.mint },
  hint: { fontFamily: fonts.body, fontSize: 14, color: '#B6C3EA', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, padding: 14 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { flex: 1, fontFamily: fonts.semi, fontSize: 15, color: '#fff' },
  rowMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: '#B6C3EA' },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  note: { fontFamily: fonts.body, fontSize: 12, color: '#B6C3EA' },
});
