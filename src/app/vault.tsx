import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Gate } from '../components/Gate';
import { PressableScale } from '../components/PressableScale';
import { TopBar } from '../components/TopBar';
import { formatBytes } from '../lib/format';
import { useStore } from '../lib/store';
import { useUnlock } from '../lib/unlock';
import { deleteVaultItems, hideAssets, listVault, restoreItems, unlockVault, VaultItem } from '../lib/vault';
import { colors, fonts } from '../theme';

type Phase = 'locked' | 'no-lock' | 'open' | 'picking' | 'working';
const GAP = 6;

export default function Vault() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { access, requestAccess } = useStore();
  const { requireUnlock } = useUnlock();
  const [phase, setPhase] = useState<Phase>('locked');
  const [items, setItems] = useState<VaultItem[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<VaultItem | null>(null);
  const [workNote, setWorkNote] = useState('');
  const authing = useRef(false);

  const cell = (width - 40 - GAP * 2) / 3;
  const refresh = useCallback(() => setItems(listVault()), []);

  const unlock = useCallback(async () => {
    if (authing.current) return;
    authing.current = true;
    try {
      const r = await unlockVault();
      if (r === 'ok') {
        refresh();
        setPhase('open');
      } else setPhase(r === 'no-lock' ? 'no-lock' : 'locked');
    } catch {
      setPhase('locked');
    } finally {
      authing.current = false;
    }
  }, [refresh]);

  useEffect(() => {
    // Let the screen paint first, then ask for Face ID.
    const t = setTimeout(unlock, 0);
    return () => clearTimeout(t);
  }, [unlock]);

  // Lock again the moment the app leaves the screen, so a borrowed phone can't browse the vault.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') {
        setViewing(null);
        setSel(new Set());
        setItems([]);
        setPhase((p) => (p === 'working' ? p : 'locked'));
      }
    });
    return () => sub.remove();
  }, []);

  const toggle = (name: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSel((s) => {
      const n = new Set(s);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  };

  const chosen = useMemo(() => items.filter((i) => sel.has(i.name)), [items, sel]);

  const restore = async () => {
    setWorkNote('Moving back to Photos…');
    setPhase('working');
    const n = await restoreItems(chosen);
    setSel(new Set());
    refresh();
    setPhase('open');
    Alert.alert(`${n} item${n === 1 ? '' : 's'} back in Photos`);
  };

  const remove = () =>
    Alert.alert(`Delete ${chosen.length} item${chosen.length === 1 ? '' : 's'} for good?`, 'These are only stored in Secret Space, so they can’t be recovered.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteVaultItems(chosen);
          setSel(new Set());
          refresh();
        },
      },
    ]);

  const afterHide = (note?: string) => {
    refresh();
    setPhase('open');
    if (note) Alert.alert('Secret Space', note);
  };

  if (phase === 'picking')
    return (
      <Picker
        access={access}
        requestAccess={requestAccess}
        onCancel={() => setPhase('open')}
        onHide={async (assets) => {
          setPhase('working');
          setWorkNote('Copying into Secret Space…');
          const ids = await hideAssets(assets, (d, t) => setWorkNote(`Copying ${d} of ${t}…`));
          if (!ids.length) return afterHide('Nothing could be copied. Photos stored only in iCloud need a connection to download first.');
          setWorkNote('Waiting for your confirmation…');
          let removed = false;
          try {
            removed = await MediaLibrary.deleteAssetsAsync(ids);
          } catch {}
          afterHide(removed ? undefined : 'Your items are safe in Secret Space, but you cancelled removing the originals, so they’re still in Photos too.');
        }}
      />
    );

  const body = () => {
    if (phase === 'no-lock')
      return <Gate icon="finger-print" title="Set a passcode first" body="Secret Space is protected by Face ID, Touch ID or your device passcode. Set one in your phone’s Settings, then come back." label="Try again" onPress={unlock} />;
    if (phase === 'locked')
      return <Gate icon="lock-closed" title="Secret Space is locked" body="Unlock with Face ID, Touch ID or your passcode." label="Unlock" onPress={unlock} />;
    if (phase === 'working')
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.blue} />
          <Text style={styles.centerTitle}>{workNote}</Text>
        </View>
      );
    return (
      <>
        <FlatList
          data={items}
          numColumns={3}
          keyExtractor={(i) => i.name}
          columnWrapperStyle={{ gap: GAP }}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 170, flexGrow: 1 }}
          ListHeaderComponent={
            <Text style={styles.help}>
              Items you hide are removed from Photos and kept here, behind your lock. Secret Space lives inside Klenzer, so deleting the app deletes what’s in it: restore anything you want to keep first.
            </Text>
          }
          ListEmptyComponent={
            <View style={[styles.center, { paddingTop: 40 }]}>
              <Ionicons name="key" size={64} color={colors.amber} />
              <Text style={styles.centerTitle}>Nothing hidden yet</Text>
              <Text style={styles.centerSub}>Tap Add to move private photos and videos here.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const on = sel.has(item.name);
            return (
              <Pressable
                onPress={() => (sel.size ? toggle(item.name) : item.isVideo ? Alert.alert('Videos play after restoring', 'Restore this video to Photos to watch it.') : setViewing(item))}
                onLongPress={() => toggle(item.name)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={{ width: cell, height: cell, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.line }}>
                {item.isVideo ? (
                  <View style={[StyleSheet.absoluteFill, styles.vid]}>
                    <Ionicons name="videocam" size={28} color="#fff" />
                  </View>
                ) : (
                  <Image source={{ uri: item.uri }} recyclingKey={item.name} style={StyleSheet.absoluteFill} contentFit="cover" />
                )}
                {on && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(47,107,255,0.28)' }]} />}
                <View style={[styles.check, on && { backgroundColor: colors.blue, borderColor: colors.blue }]}>{on && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
                {item.size > 0 && (
                  <View style={styles.meta}>
                    <Text style={styles.metaText}>{formatBytes(item.size)}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
        {chosen.length > 0 && (
          <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
            <Button label={`Restore ${chosen.length} to Photos`} icon={<Ionicons name="arrow-undo" size={19} color="#fff" />} onPress={restore} />
            <Button variant="light" label="Delete for good" onPress={remove} />
          </View>
        )}
        <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
          <Pressable style={styles.viewer} onPress={() => setViewing(null)}>
            {viewing && <Image source={{ uri: viewing.uri }} style={{ flex: 1 }} contentFit="contain" />}
          </Pressable>
        </Modal>
      </>
    );
  };

  const canAdd = phase === 'open';
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar
        title="Secret Space"
        right={
          canAdd ? (
            <PressableScale onPress={() => requireUnlock(() => setPhase('picking'))} accessibilityLabel="Add to Secret Space">
              <Text style={styles.add}>Add</Text>
            </PressableScale>
          ) : undefined
        }
      />
      {body()}
    </View>
  );
}

function Picker({ access, requestAccess, onCancel, onHide }: { access: string; requestAccess: () => Promise<string>; onCancel: () => void; onHide: (a: MediaLibrary.Asset[]) => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<string | undefined>();
  const [more, setMore] = useState(true);
  const loading = useRef(false);
  const cell = (width - 40 - GAP * 2) / 3;

  const next = useCallback(async () => {
    if (loading.current || !more) return;
    loading.current = true;
    try {
      if (access !== 'granted' && access !== 'limited' && !['granted', 'limited'].includes(await requestAccess())) {
        setMore(false);
        return;
      }
      const p = await MediaLibrary.getAssetsAsync({ first: 120, after: cursor, mediaType: ['photo', 'video'], sortBy: [[MediaLibrary.SortBy.creationTime, false]] });
      setAssets((a) => [...a, ...p.assets]);
      setCursor(p.endCursor);
      setMore(p.hasNextPage);
    } finally {
      loading.current = false;
    }
  }, [access, requestAccess, cursor, more]);

  useEffect(() => {
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="Choose items to hide" right={<PressableScale onPress={onCancel} accessibilityLabel="Cancel"><Text style={styles.add}>Cancel</Text></PressableScale>} />
      <FlatList
        data={assets}
        numColumns={3}
        keyExtractor={(a) => a.id}
        columnWrapperStyle={{ gap: GAP }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 }}
        onEndReached={next}
        onEndReachedThreshold={0.6}
        renderItem={({ item }) => {
          const on = sel.has(item.id);
          return (
            <Pressable onPress={() => toggle(item.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ width: cell, height: cell, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.line }}>
              <Image source={{ uri: item.uri }} recyclingKey={item.id} style={StyleSheet.absoluteFill} contentFit="cover" transition={100} />
              {on && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(47,107,255,0.28)' }]} />}
              {item.mediaType === 'video' && <Ionicons name="videocam" size={16} color="#fff" style={{ position: 'absolute', left: 7, bottom: 7 }} />}
              <View style={[styles.check, on && { backgroundColor: colors.blue, borderColor: colors.blue }]}>{on && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
            </Pressable>
          );
        }}
      />
      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <Button disabled={!sel.size} icon={<Ionicons name="key" size={19} color="#fff" />} label={sel.size ? `Hide ${sel.size} item${sel.size === 1 ? '' : 's'}` : 'Select items to hide'} onPress={() => onHide(assets.filter((a) => sel.has(a.id)))} />
        <Text style={styles.barNote}>Copies are stored first. Then your phone asks before the originals leave Photos.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 30 },
  centerTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink, textAlign: 'center' },
  centerSub: { fontFamily: fonts.body, fontSize: 14, color: colors.ink3, textAlign: 'center' },
  help: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.ink2, paddingBottom: 14 },
  add: { fontFamily: fonts.semi, fontSize: 15, color: colors.blue },
  vid: { backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  check: { position: 'absolute', top: 7, right: 7, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  meta: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(11,16,32,0.7)', borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2 },
  metaText: { fontFamily: fonts.semi, fontSize: 11, color: '#fff' },
  viewer: { flex: 1, backgroundColor: '#000' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, backgroundColor: 'rgba(246,248,252,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, gap: 8 },
  barNote: { fontFamily: fonts.body, fontSize: 12, color: colors.ink3, textAlign: 'center' },
});
