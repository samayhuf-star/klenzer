import { DEMO } from '../../lib/demo';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FreeLeftNote } from '../../components/FreeLeftNote';
import { PressableScale } from '../../components/PressableScale';
import { formatBytes, formatDate, formatDuration } from '../../lib/format';
import { dupExtras, DuplicateGroup, Item } from '../../lib/scanner';
import { useStore } from '../../lib/store';
import { isConvertSupported, pairedVideoSizes } from 'live-photo-convert';
import { colors, fonts, radius, shadow } from '../../theme';

const COPY = {
  duplicates: { title: 'Duplicate', help: 'Photos with the same size and capture time, plus near-identical shots. We keep the largest file in each set; tap any photo to change what’s selected.' },
  similar: { title: 'Similar', help: 'Near-identical photos. We keep the largest file in each set; tap any photo to change what’s selected.' },
  blurry: { title: 'Blurry', help: 'Photos that look out of focus. Nothing is selected by default. Tap the ones you want to clear.' },
  screenshots: { title: 'Screenshots', help: 'Nothing is selected by default. Tap the ones you want to clear.' },
  videos: { title: 'Large videos', help: 'Videos over 100 MB, biggest first. Nothing is selected by default.' },
  live: { title: 'Live Photos', help: 'Convert to still keeps the full-size photo and removes the motion clip. The original goes to Recently Deleted; space is freed after you empty it, or after 30 days. Nothing is selected by default.' },
  photos: { title: 'Photos', help: 'Every photo in your library, largest first. Nothing is selected by default. Tap the ones you want to clear.' },
  shortVideos: { title: 'Short recordings', help: 'Clips of 10 seconds or less, biggest first. Nothing is selected by default. Tap the ones you want to clear.' },
  screenRecordings: { title: 'Screen recordings', help: 'Recordings of your screen, biggest first. Nothing is selected by default. Tap the ones you want to clear.' },
  videoDuplicates: { title: 'Duplicate videos', help: 'Videos with the same size, dimensions and capture time. We keep the largest file in each set; tap any video to change what’s selected.' },
} as const;
type Kind = keyof typeof COPY;
const GROUPED: Kind[] = ['duplicates', 'similar', 'videoDuplicates'];

export default function Review() {
  const { kind: raw } = useLocalSearchParams<{ kind: string }>();
  const kind = (raw && raw in COPY ? raw : 'screenshots') as Kind;
  const { result, startClean, startConvert, access } = useStore();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const groups: DuplicateGroup[] = useMemo(() => {
    if (kind === 'similar') return result?.similar ?? [];
    if (kind === 'videoDuplicates') return result?.duplicateVideos ?? [];
    return result?.duplicates ?? [];
  }, [kind, result]);
  const flat: Item[] = useMemo(() => {
    if (kind === 'duplicates' || kind === 'similar' || kind === 'videoDuplicates') return groups.flatMap((g) => g.items);
    if (kind === 'screenshots') return result?.screenshots ?? [];
    if (kind === 'blurry') return result?.blurry ?? [];
    if (kind === 'live') return result?.livePhotos ?? [];
    if (kind === 'photos') return result?.photos ?? [];
    if (kind === 'shortVideos') return result?.shortVideos ?? [];
    if (kind === 'screenRecordings') return result?.screenRecordings ?? [];
    return result?.largeVideos ?? [];
  }, [kind, groups, result]);

  const [sel, setSel] = useState<Set<string>>(
    () => new Set(GROUPED.includes(kind) ? groups.flatMap((g) => dupExtras(g).map((i) => i.id)) : []),
  );
  const chosen = useMemo(() => flat.filter((i) => sel.has(i.id)), [flat, sel]);
  const bytes = chosen.reduce((n, i) => n + i.size, 0);

  const [videoBytesById, setVideoBytesById] = useState<Record<string, number>>({});
  useEffect(() => {
    if (kind !== 'live' || !isConvertSupported || !flat.length) return;
    let cancelled = false;
    pairedVideoSizes(flat.map((i) => i.id)).then((rows) => {
      if (cancelled) return;
      const map: Record<string, number> = {};
      for (const row of rows) map[row.id] = row.videoBytes;
      setVideoBytesById(map);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [kind, flat]);
  const chosenVideoBytes = chosen.reduce((n, i) => n + (videoBytesById[i.id] ?? 0), 0);

  const toggle = useCallback((id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const allSelected = flat.length > 0 && chosen.length === flat.length;
  const selectAll = () => setSel(allSelected ? new Set() : new Set(flat.map((i) => i.id)));

  const doConvert = () => {
    startConvert(chosen, chosenVideoBytes);
  };

  const doDelete = async () => {
    const wipesGroup = GROUPED.includes(kind) && groups.some((g) => g.items.every((i) => sel.has(i.id)));
    const go = () => startClean([{ kind, items: chosen }]);
    if (wipesGroup) {
      Alert.alert('Delete every copy?', 'At least one set has all of its photos selected, so no copy would be kept.', [
        { text: 'Go back', style: 'cancel' },
        { text: 'Delete anyway', style: 'destructive', onPress: go },
      ]);
    } else go();
  };

  const gap = 6;
  const cols = 3;
  const cell = (width - 40 - gap * (cols - 1)) / cols;
  const grouped = GROUPED.includes(kind);

  const header = (
    <View style={{ gap: 12, paddingBottom: 14 }}>
      <Text style={styles.help}>{COPY[kind].help}</Text>
      {!grouped && (
        <Pressable onPress={selectAll} accessibilityRole="button" style={styles.selAll}>
          <Text style={styles.selAllText}>{allSelected ? 'Deselect all' : `Select all ${flat.length.toLocaleString()}`}</Text>
        </Pressable>
      )}
    </View>
  );

  const renderThumb = (i: Item, size: number, badge?: string) => (
    <Thumb key={i.id} item={i} size={size} selected={sel.has(i.id)} onPress={() => toggle(i.id)} badge={badge} showVideo={kind === 'videos' || kind === 'videoDuplicates' || kind === 'shortVideos' || kind === 'screenRecordings'} />
  );

  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </PressableScale>
        <Text style={styles.title} numberOfLines={1}>{COPY[kind].title}</Text>
        <View style={styles.side} />
      </View>

      {grouped ? (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.key}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item: g }) => (
            <View style={styles.group}>
              <Text style={styles.groupMeta}>
                {formatDate(g.items[0].creationTime)} · {g.items.length} similar
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
                {g.items.map((i, k) => renderThumb(i, (width - 40 - 32 - gap * 2) / 3, k === 0 ? 'BEST' : undefined))}
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          key={kind}
          data={flat}
          numColumns={cols}
          keyExtractor={(i) => i.id}
          ListHeaderComponent={header}
          columnWrapperStyle={{ gap }}
          ItemSeparatorComponent={() => <View style={{ height: gap }} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 }}
          initialNumToRender={18}
          windowSize={7}
          renderItem={({ item }) => renderThumb(item, cell)}
        />
      )}

      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        {kind === 'live' && Platform.OS === 'ios' ? (
          <>
            <PressableScale
              onPress={doConvert}
              disabled={chosen.length === 0}
              accessibilityLabel={chosen.length ? 'Convert to still' : 'Select items to convert'}
              testID="convert-to-still"
              style={[styles.deleteBtn, chosen.length === 0 && { opacity: 0.45 }]}>
              <Text style={styles.deleteText}>
                {chosen.length
                  ? `Convert to still${chosenVideoBytes ? ` · ${formatBytes(chosenVideoBytes)}` : ` · ${chosen.length.toLocaleString()}`}`
                  : 'Select items to convert'}
              </Text>
            </PressableScale>
            <PressableScale
              onPress={doDelete}
              disabled={chosen.length === 0}
              accessibilityLabel={chosen.length ? `Delete ${chosen.length}` : 'Select items to delete'}
              testID="delete-live"
              style={[styles.secondaryBtn, chosen.length === 0 && { opacity: 0.45 }]}>
              <Text style={styles.secondaryText}>
                {chosen.length ? `Delete ${chosen.length.toLocaleString()}${bytes ? ` · ${formatBytes(bytes)}` : ''}` : 'Delete'}
              </Text>
            </PressableScale>
            <Text style={styles.barNote}>
              {access === 'limited'
                ? 'Full photo access is needed to keep albums, date, location and favourites on the still.'
                : 'Your iPhone will ask you to confirm once per batch. Originals go to Recently Deleted.'}
            </Text>
          </>
        ) : (
          <>
            <PressableScale
              onPress={doDelete}
              disabled={chosen.length === 0}
              accessibilityLabel={chosen.length ? `Delete ${chosen.length}` : 'Select items to delete'}
              style={[styles.deleteBtn, chosen.length === 0 && { opacity: 0.45 }]}>
              <Text style={styles.deleteText}>
                {chosen.length ? `Delete ${chosen.length.toLocaleString()}${bytes ? ` · ${formatBytes(bytes)}` : ''}` : 'Select items to delete'}
              </Text>
            </PressableScale>
            <Text style={styles.barNote}>
              {Platform.OS === 'ios' || DEMO
                ? 'Your iPhone will ask you to confirm before anything is deleted. Items go to Recently Deleted.'
                : 'Android will ask you to confirm. Deleted items can’t be restored by Klenzer.'}
            </Text>
            <FreeLeftNote style={{ fontSize: 12 }} />
          </>
        )}
      </View>
    </View>
  );
}

function Thumb({ item, size, selected, onPress, badge, showVideo }: { item: Item; size: number; selected: boolean; onPress: () => void; badge?: string; showVideo?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${item.filename}${item.size ? `, ${formatBytes(item.size)}` : ''}`}
      style={{ width: size, height: size, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.line }}>
      <Image source={{ uri: item.uri }} recyclingKey={item.id} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
      {selected && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(61,90,254,0.28)' }]} />}
      <View style={[styles.check, selected ? styles.checkOn : styles.checkOff]}>
        {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      {(showVideo || item.size > 0) && (
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            {showVideo ? `${formatDuration(item.duration)} · ` : ''}
            {item.size ? formatBytes(item.size) : ''}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, zIndex: 2 },
  // Fixed-width sides keep the back button clear of the title and of any badges in the grid below.
  side: { width: 44, height: 44 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', zIndex: 3, ...shadow },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 18, color: colors.ink, marginHorizontal: 8 },
  help: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  selAll: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.blueSoft },
  selAllText: { fontFamily: fonts.semi, fontSize: 14, color: colors.blue },
  group: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16, gap: 10 },
  groupMeta: { fontFamily: fonts.semi, fontSize: 13, color: colors.ink3 },
  check: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.blue },
  checkOff: { backgroundColor: 'rgba(255,255,255,0.7)' },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#0BAE86', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.7, color: '#fff' },
  meta: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(11,16,32,0.7)', borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2 },
  metaText: { fontFamily: fonts.semi, fontSize: 11, color: '#fff' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, backgroundColor: colors.bg, gap: 8 },
  deleteBtn: { height: 52, borderRadius: 999, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', shadowColor: colors.blue, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  deleteText: { fontFamily: fonts.bold, fontSize: 16.5, color: '#fff' },
  secondaryBtn: { height: 52, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.bold, fontSize: 16.5, color: colors.ink },
  barNote: { fontFamily: fonts.body, fontSize: 12, color: colors.ink3, textAlign: 'center' },
});
