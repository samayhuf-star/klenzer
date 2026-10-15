import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { PressableScale } from '../../components/PressableScale';
import { formatBytes, formatDate, formatDuration } from '../../lib/format';
import { dupExtras, Item } from '../../lib/scanner';
import { useStore } from '../../lib/store';
import { colors, fonts, radius } from '../../theme';

const COPY = {
  duplicates: { title: 'Duplicates & near-identical', help: 'Photos taken at the same moment with the same dimensions. We keep the largest file in each set; tap any photo to change what’s selected.' },
  screenshots: { title: 'Screenshots', help: 'Nothing is selected by default. Tap the ones you want to clear.' },
  videos: { title: 'Large videos', help: 'Videos over 100 MB, biggest first. Nothing is selected by default.' },
  live: { title: 'Live Photos', help: 'Deleting a Live Photo removes the photo and its motion clip. Sizes shown are the still photo only, so you will free more than shown. Nothing is selected by default.' },
} as const;
type Kind = keyof typeof COPY;

export default function Review() {
  const { kind: raw } = useLocalSearchParams<{ kind: string }>();
  const kind = (raw in COPY ? raw : 'screenshots') as Kind;
  const { result, clean } = useStore();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const groups = result?.duplicates ?? [];
  const flat: Item[] = useMemo(
    () => (kind === 'duplicates' ? groups.flatMap((g) => g.items) : kind === 'screenshots' ? result?.screenshots ?? [] : kind === 'live' ? result?.livePhotos ?? [] : result?.largeVideos ?? []),
    [kind, groups, result],
  );

  const [sel, setSel] = useState<Set<string>>(() => new Set(kind === 'duplicates' ? groups.flatMap((g) => dupExtras(g).map((i) => i.id)) : []));
  const chosen = useMemo(() => flat.filter((i) => sel.has(i.id)), [flat, sel]);
  const bytes = chosen.reduce((n, i) => n + i.size, 0);

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

  const doDelete = async () => {
    // A set where every copy is selected would delete the photo entirely: confirm explicitly.
    const wipesGroup = kind === 'duplicates' && groups.some((g) => g.items.every((i) => sel.has(i.id)));
    const go = () => {
      // The cleaning screen shows live progress while the OS asks for confirmation and deletes.
      router.push('/cleaning');
      clean([{ kind, items: chosen }]);
    };
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

  const header = (
    <View style={{ gap: 12, paddingBottom: 14 }}>
      <Text style={styles.help}>{COPY[kind].help}</Text>
      {kind !== 'duplicates' && (
        <Pressable onPress={selectAll} accessibilityRole="button" style={styles.selAll}>
          <Text style={styles.selAllText}>{allSelected ? 'Deselect all' : `Select all ${flat.length.toLocaleString()}`}</Text>
        </Pressable>
      )}
    </View>
  );

  const renderThumb = (i: Item, size: number, badge?: string) => (
    <Thumb key={i.id} item={i} size={size} selected={sel.has(i.id)} onPress={() => toggle(i.id)} badge={badge} showVideo={kind === 'videos'} />
  );

  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </PressableScale>
        <Text style={styles.title} numberOfLines={1}>{COPY[kind].title}</Text>
        <View style={{ width: 44 }} />
      </View>

      {kind === 'duplicates' ? (
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
                {g.items.map((i, k) => renderThumb(i, (width - 40 - 32 - gap * 2) / 3, k === 0 ? 'Best' : undefined))}
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
        <Button
          variant="danger"
          disabled={chosen.length === 0}
          icon={<Ionicons name="trash" size={19} color="#fff" />}
          label={chosen.length ? `Delete ${chosen.length.toLocaleString()}${bytes ? ` · ${formatBytes(bytes)}` : ''}` : 'Select items to delete'}
          onPress={doDelete}
        />
        <Text style={styles.barNote}>{Platform.OS === 'ios' ? 'Your iPhone will ask you to confirm. Items go to Recently Deleted; Klenzer will take you to Photos to empty it.' : 'Android will ask you to confirm. Deleted items can’t be restored by Klenzer.'}</Text>
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
      {selected && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(47,107,255,0.28)' }]} />}
      <View style={[styles.check, selected && { backgroundColor: colors.blue, borderColor: colors.blue }]}>
        {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
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
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 10 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  help: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  selAll: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.blueSoft },
  selAllText: { fontFamily: fonts.semi, fontSize: 14, color: colors.blue },
  group: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16, gap: 10 },
  groupMeta: { fontFamily: fonts.semi, fontSize: 13, color: colors.ink3 },
  check: { position: 'absolute', top: 7, right: 7, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 7, left: 7, backgroundColor: colors.mint, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.navy },
  meta: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(11,16,32,0.7)', borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2 },
  metaText: { fontFamily: fonts.semi, fontSize: 11, color: '#fff' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, backgroundColor: 'rgba(246,248,252,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, gap: 8 },
  barNote: { fontFamily: fonts.body, fontSize: 12, color: colors.ink3, textAlign: 'center' },
});
