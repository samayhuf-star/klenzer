import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { FreeLeftNote } from '../components/FreeLeftNote';
import { PressableScale } from '../components/PressableScale';
import { ScreenHeader } from '../components/ScreenHeader';
import { formatBytes, formatDate } from '../lib/format';
import type { Item } from '../lib/scan-logic';
import { useStore } from '../lib/store';
import { deleteBatch, emptySwipe, groupByMonth, pending, progressPercent, pruneDeleted, releaseBytes, swipe, undo, type SwipeState } from '../lib/swipe-logic';
import { colors, fonts, radius, shadow } from '../theme';

export default function SwipeToOrganize() {
  const insets = useSafeAreaInsets();
  const { result, scanning, scan, startClean } = useStore();
  const reduceMotion = !!useReducedMotion();
  const items = useMemo(() => (result?.photos ?? []).filter((i) => !!i.uri), [result]);
  const months = useMemo(() => groupByMonth(items), [items]);
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const month = months.find((m) => m.key === monthKey) ?? months[0];
  const [state, setState] = useState<SwipeState>(emptySwipe);

  // When a delete finishes, the scan result drops those ids. Forget their decisions too.
  useEffect(() => {
    const alive = new Set(items.map((i) => i.id));
    const gone = Object.keys(state.decisions).filter((id) => !alive.has(id));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (gone.length) setState((s) => pruneDeleted(s, gone));
  }, [items, state.decisions]);

  if (!result) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Swipe to Organize" />
        <View style={styles.empty}>
          <Ionicons name="albums-outline" size={42} color={colors.blue} />
          <Text style={styles.emptyTitle}>Scan your library first</Text>
          <Text style={styles.emptyBody}>Klenzer sorts your photos by month so you can swipe through them one at a time.</Text>
          <Button label={scanning ? 'Scanning' : 'Scan now'} busy={scanning} onPress={() => void scan()} />
        </View>
      </View>
    );
  }

  const monthItems = month?.items ?? [];
  const left = pending(monthItems, state);
  const top = left[0];
  const next = left[1];
  const pct = progressPercent(monthItems, state);
  const allBatch = months.flatMap((m) => deleteBatch(m.items, state));
  const allBytes = months.reduce((n, m) => n + releaseBytes(m.items, state), 0);

  const decide = (dir: 'left' | 'right') => {
    if (!top) return;
    Haptics.impactAsync(dir === 'left' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setState((s) => swipe(s, top.id, dir));
  };
  const doUndo = () => {
    Haptics.selectionAsync().catch(() => {});
    setState((s) => undo(s).state);
  };
  const doDelete = () => {
    if (!allBatch.length) return;
    startClean([{ kind: 'photos', items: allBatch }]);
  };

  return (
    <View style={styles.root} testID="swipe-screen">
      <ScreenHeader
        title="Swipe to Organize"
        right={
          <PressableScale onPress={doUndo} disabled={!state.history.length} accessibilityLabel="Undo last swipe" testID="swipe-undo">
            <Ionicons name="arrow-undo" size={22} color={state.history.length ? colors.blue : colors.ink3} />
          </PressableScale>
        }
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.months} style={{ flexGrow: 0 }}>
        {months.map((m) => {
          const on = m.key === month?.key;
          const done = progressPercent(m.items, state);
          return (
            <PressableScale key={m.key} onPress={() => setMonthKey(m.key)} style={[styles.chip, on && styles.chipOn]} accessibilityLabel={`${m.label}, ${done} percent done`}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{m.label}</Text>
              <Text style={[styles.chipSub, on && styles.chipTextOn]}>{done === 100 ? 'Done' : `${m.items.length}`}</Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      <View style={styles.stats}>
        <View style={{ flex: 1 }}>
          <Text style={styles.statLabel}>{month?.label}</Text>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.statSub}>{pct}% reviewed</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.statLabel}>To be released</Text>
          <Text style={styles.release} testID="swipe-release">{formatBytes(allBytes)}</Text>
        </View>
      </View>

      <View style={styles.deck}>
        {top ? (
          <>
            {next && <Card key={`n-${next.id}`} item={next} behind reduceMotion={reduceMotion} onDecide={() => {}} />}
            <Card key={top.id} item={top} reduceMotion={reduceMotion} onDecide={decide} />
          </>
        ) : (
          <View style={styles.doneCard}>
            <Ionicons name="checkmark-circle" size={44} color={colors.mint} />
            <Text style={styles.emptyTitle}>{month ? `${month.label} reviewed` : 'All reviewed'}</Text>
            <Text style={styles.emptyBody}>Pick another month above, or delete what you marked.</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <PressableScale onPress={() => decide('left')} disabled={!top} accessibilityLabel="Mark for deletion" style={[styles.round, { backgroundColor: colors.dangerSoft }]} testID="swipe-delete">
          <Ionicons name="trash" size={26} color={colors.danger} />
        </PressableScale>
        <PressableScale onPress={() => decide('right')} disabled={!top} accessibilityLabel="Keep" style={[styles.round, { backgroundColor: colors.mintSoft }]} testID="swipe-keep">
          <Ionicons name="heart" size={26} color="#0BAE86" />
        </PressableScale>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          variant="danger"
          label={allBatch.length ? `Delete ${allBatch.length.toLocaleString()} · ${formatBytes(allBytes)}` : 'Swipe left to mark photos'}
          disabled={!allBatch.length}
          onPress={doDelete}
          testID="swipe-commit"
        />
        <Text style={styles.footNote}>Your iPhone asks you to confirm once. Deleted photos go to Recently Deleted.</Text>
        <FreeLeftNote />
      </View>
    </View>
  );
}

function Card({ item, behind, reduceMotion, onDecide }: { item: Item; behind?: boolean; reduceMotion: boolean; onDecide: (dir: 'left' | 'right') => void }) {
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const threshold = width * 0.28;

  const pan = Gesture.Pan()
    .enabled(!behind)
    .onUpdate((e) => {
      x.value = e.translationX;
    })
    .onEnd((e) => {
      const fling = Math.abs(e.velocityX) > 800;
      if (Math.abs(x.value) > threshold || fling) {
        const dir = (fling ? e.velocityX : x.value) < 0 ? 'left' : 'right';
        if (reduceMotion) {
          runOnJS(onDecide)(dir);
          return;
        }
        x.value = withTiming(dir === 'left' ? -width * 1.4 : width * 1.4, { duration: 220 }, (finished) => {
          if (finished) runOnJS(onDecide)(dir);
        });
      } else {
        x.value = reduceMotion ? 0 : withSpring(0, { damping: 16, stiffness: 220 });
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { rotate: reduceMotion ? '0deg' : `${interpolate(x.value, [-width, 0, width], [-12, 0, 12])}deg` }, { scale: behind ? 0.95 : 1 }],
  }));
  const keepBadge = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, threshold], [0, 1], 'clamp') }));
  const delBadge = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-threshold, 0], [1, 0], 'clamp') }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, behind && { opacity: 0.7 }, style]} accessibilityLabel={`Photo from ${formatDate(item.creationTime)}`}>
        <Image source={{ uri: item.uri }} recyclingKey={item.id} style={StyleSheet.absoluteFill} contentFit="cover" transition={reduceMotion ? 0 : 120} />
        <View style={styles.cardMeta}>
          <Text style={styles.cardDate}>{formatDate(item.creationTime)}</Text>
          {item.size > 0 && <Text style={styles.cardSize}>{formatBytes(item.size)}</Text>}
        </View>
        {!behind && (
          <>
            <Animated.View style={[styles.badge, styles.badgeKeep, keepBadge]}>
              <Text style={[styles.badgeText, { color: '#0BAE86' }]}>KEEP</Text>
            </Animated.View>
            <Animated.View style={[styles.badge, styles.badgeDel, delBadge]}>
              <Text style={[styles.badgeText, { color: colors.danger }]}>DELETE</Text>
            </Animated.View>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  months: { paddingHorizontal: 16, gap: 8, paddingBottom: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center' },
  chipOn: { backgroundColor: colors.blue },
  chipText: { fontFamily: fonts.semi, fontSize: 13, color: colors.ink },
  chipSub: { fontFamily: fonts.medium, fontSize: 11, color: colors.ink3 },
  chipTextOn: { color: '#fff' },
  stats: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, paddingHorizontal: 20, paddingTop: 8 },
  statLabel: { fontFamily: fonts.semi, fontSize: 13, color: colors.ink2 },
  statSub: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink3, marginTop: 4 },
  bar: { height: 6, borderRadius: 6, backgroundColor: colors.track, overflow: 'hidden', marginTop: 6 },
  barFill: { height: '100%', backgroundColor: colors.blue, borderRadius: 6 },
  release: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, letterSpacing: -0.5 },
  deck: { flex: 1, marginHorizontal: 20, marginTop: 14 },
  card: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.card, ...shadow },
  cardMeta: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(11,16,32,0.35)' },
  cardDate: { fontFamily: fonts.semi, fontSize: 15, color: '#fff' },
  cardSize: { fontFamily: fonts.semi, fontSize: 15, color: '#fff' },
  badge: { position: 'absolute', top: 22, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, borderWidth: 3, backgroundColor: 'rgba(255,255,255,0.9)' },
  badgeKeep: { left: 20, borderColor: '#0BAE86', transform: [{ rotate: '-10deg' }] },
  badgeDel: { right: 20, borderColor: colors.danger, transform: [{ rotate: '10deg' }] },
  badgeText: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: 1 },
  doneCard: { flex: 1, borderRadius: radius.xl, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10, ...shadow },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 40, paddingVertical: 14 },
  round: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', ...shadow },
  footer: { paddingHorizontal: 20, gap: 8 },
  footNote: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3, textAlign: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 19, color: colors.ink, textAlign: 'center' },
  emptyBody: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.ink2, textAlign: 'center' },
});
