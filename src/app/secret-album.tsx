import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Modal, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { FreeLeftNote } from '../components/FreeLeftNote';
import { PressableScale } from '../components/PressableScale';
import { ScreenHeader } from '../components/ScreenHeader';
import { DEMO } from '../lib/demo';
import { formatBytes, formatDate } from '../lib/format';
import { useStore } from '../lib/store';
import {
  biometricsAvailable,
  clearViewCache,
  deleteOriginals,
  exportToPhotos,
  faceIdEnabled,
  hasPin,
  importItems,
  loadIndex,
  lockAlbum,
  openForViewing,
  removeFromAlbum,
  setFaceIdEnabled,
  setPin,
  thumbDataUri,
  unlockWithBiometrics,
  verifyPin,
  type ImportSource,
} from '../lib/vault';
import { isValidPin, lockRemainingMs, noLockout, PIN_MAX, PIN_MIN, registerFailure, type Lockout, type VaultEntry } from '../lib/vault-logic';
import { colors, fonts, radius, shadow } from '../theme';

type Phase = 'loading' | 'setup' | 'confirm' | 'locked' | 'open';

const demoEntries = (): VaultEntry[] =>
  Array.from({ length: 9 }, (_, i) => ({ id: `demo-v${i}`, filename: `IMG_${7000 + i}.HEIC`, mime: 'image/heic', width: 3024, height: 4032, size: 2_400_000 + i * 310_000, createdAt: Date.now() - i * 86_400_000, addedAt: Date.now() }));

export default function SecretAlbum() {
  const { runGated } = useStore();
  const [phase, setPhase] = useState<Phase>(DEMO ? 'open' : 'loading');
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPinText] = useState('');
  const [lock, setLock] = useState<Lockout>(noLockout);
  const [msg, setMsg] = useState<string | null>(null);
  const [bio, setBio] = useState(false);
  const [bioOn, setBioOn] = useState(false);
  const [entries, setEntries] = useState<VaultEntry[]>(DEMO ? demoEntries() : []);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<VaultEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const openAlbum = useCallback(async () => {
    setPhase('open');
    setPinText('');
    setMsg(null);
    setLock(noLockout());
    const index = await loadIndex();
    setEntries(index.entries);
  }, []);

  const tryBiometrics = useCallback(async () => {
    if (await unlockWithBiometrics()) await openAlbum();
  }, [openAlbum]);

  useEffect(() => {
    if (DEMO) return;
    (async () => {
      const [has, avail, on] = await Promise.all([hasPin(), biometricsAvailable(), faceIdEnabled()]);
      setBio(avail);
      setBioOn(on && avail);
      if (!has) return setPhase('setup');
      setPhase('locked');
      if (on && avail) void tryBiometrics();
    })().catch(() => setPhase('setup'));
  }, [tryBiometrics]);

  // Lock whenever the app leaves the foreground or this screen closes.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active' && !DEMO) {
        lockAlbum();
        setThumbs({});
        setViewing(null);
        setPhase((p) => (p === 'open' ? 'locked' : p));
      }
    });
    return () => {
      sub.remove();
      lockAlbum();
    };
  }, []);

  // Decrypt thumbnails in memory once the album is open.
  useEffect(() => {
    if (phase !== 'open' || DEMO) return;
    let alive = true;
    (async () => {
      for (const e of entries) {
        if (!alive) return;
        if (thumbs[e.id]) continue;
        const uri = await thumbDataUri(e);
        if (uri && alive) setThumbs((t) => ({ ...t, [e.id]: uri }));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, entries]);

  const locked = lockRemainingMs(lock, now);
  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [locked]);

  const onDigit = async (d: string) => {
    if (locked) return;
    Haptics.selectionAsync().catch(() => {});
    const next = (pin + d).slice(0, PIN_MAX);
    setPinText(next);
    setMsg(null);
    if (phase === 'locked' && next.length >= PIN_MIN) {
      if (await verifyPin(next)) return void openAlbum();
      if (next.length === PIN_MAX) {
        const l = registerFailure(lock, Date.now());
        setLock(l);
        setNow(Date.now());
        setPinText('');
        setMsg('Wrong PIN. Try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    }
  };
  const onDelete = () => setPinText((p) => p.slice(0, -1));
  const onEnter = async () => {
    if (phase === 'setup') {
      if (!isValidPin(pin)) return setMsg(`Use ${PIN_MIN} to ${PIN_MAX} digits.`);
      setFirstPin(pin);
      setPinText('');
      setPhase('confirm');
      return;
    }
    if (phase === 'confirm') {
      if (pin !== firstPin) {
        setPinText('');
        setPhase('setup');
        return setMsg('Those PINs did not match. Choose a PIN again.');
      }
      setBusy(true);
      await setPin(pin);
      setBusy(false);
      if (bio) {
        Alert.alert('Use Face ID?', 'Unlock Secret Album with Face ID. Your PIN still works any time.', [
          { text: 'Not now', style: 'cancel', onPress: () => void openAlbum() },
          {
            text: 'Use Face ID',
            onPress: async () => {
              await setFaceIdEnabled(true);
              setBioOn(true);
              await openAlbum();
            },
          },
        ]);
      } else await openAlbum();
      return;
    }
    if (phase === 'locked') {
      if (await verifyPin(pin)) return void openAlbum();
      const l = registerFailure(lock, Date.now());
      setLock(l);
      setNow(Date.now());
      setPinText('');
      setMsg('Wrong PIN. Try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  /** Picking is free. Adding to the album is a Pro action; each photo added counts as one free item. */
  const addPhotos = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 0,
      quality: 1,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });
    if (r.canceled || !r.assets?.length) return;
    const picked: ImportSource[] = r.assets.map((a) => ({ uri: a.uri, assetId: a.assetId, fileName: a.fileName, mimeType: a.mimeType, width: a.width, height: a.height, fileSize: a.fileSize }));
    runGated(
      'vault',
      picked,
      async (allowed) => {
        setBusy(true);
        let res;
        try {
          res = await importItems(allowed);
        } finally {
          setBusy(false);
        }
        setEntries((await loadIndex()).entries);
        if (res.skipped) Alert.alert('Some photos were not added', `${res.skipped === 1 ? '1 photo' : `${res.skipped} photos`} could not be added. Items over 150 MB are not supported.`);
        if (res.added.length) offerDeleteOriginals(res.added.length, res.assetIds);
        return res.added.length;
      },
      'add',
    );
  };

  const offerDeleteOriginals = (count: number, assetIds: string[]) => {
    if (!assetIds.length) {
      Alert.alert('Added to Secret Album', 'The originals are still in Photos. Klenzer could not link them to your library, so delete them in Photos if you want them gone.');
      return;
    }
    Alert.alert(
      'Delete the originals from Photos?',
      `${count === 1 ? 'This photo is' : `These ${count} photos are`} now in Secret Album. Your iPhone will ask you to confirm, and the originals go to Recently Deleted.`,
      [
        { text: 'Keep originals', style: 'cancel' },
        { text: 'Delete originals', style: 'destructive', onPress: () => void deleteOriginals(assetIds) },
      ],
    );
  };

  if (phase === 'loading') {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Secret Album" />
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.blue} />
      </View>
    );
  }

  if (phase !== 'open') {
    const title = phase === 'setup' ? 'Choose a PIN' : phase === 'confirm' ? 'Enter the PIN again' : 'Enter your PIN';
    const sub =
      phase === 'locked'
        ? locked
          ? `Too many tries. Try again in ${Math.ceil(locked / 1000)} s.`
          : 'Secret Album is locked.'
        : `${PIN_MIN} to ${PIN_MAX} digits. Klenzer cannot recover a forgotten PIN.`;
    return (
      <View style={styles.root} testID="vault-lock">
        <ScreenHeader title="Secret Album" />
        <View style={styles.lockTop}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed" size={28} color={colors.blue} />
          </View>
          <Text style={styles.lockTitle}>{title}</Text>
          <Text style={styles.lockSub}>{msg ?? sub}</Text>
          <View style={styles.dots}>
            {Array.from({ length: PIN_MAX }, (_, i) => (
              <View key={i} style={[styles.dot, i < pin.length && styles.dotOn]} />
            ))}
          </View>
        </View>
        <PinPad
          onDigit={(d) => void onDigit(d)}
          onDelete={onDelete}
          onEnter={() => void onEnter()}
          enterLabel={phase === 'locked' ? 'OK' : 'Next'}
          extra={phase === 'locked' && bioOn ? { icon: 'scan', label: 'Use Face ID', onPress: () => void tryBiometrics() } : undefined}
          disabled={!!locked || busy}
        />
      </View>
    );
  }

  return (
    <View style={styles.root} testID="vault-open">
      <ScreenHeader
        title="Secret Album"
        right={
          <PressableScale
            onPress={() => {
              lockAlbum();
              setThumbs({});
              setPhase('locked');
            }}
            accessibilityLabel="Lock album">
            <Ionicons name="lock-closed-outline" size={22} color={colors.ink} />
          </PressableScale>
        }
      />
      <AlbumGrid entries={entries} thumbs={thumbs} onOpen={setViewing} />
      <AlbumFooter
        busy={busy}
        onAdd={() => void addPhotos()}
        bio={bio}
        bioOn={bioOn}
        onBio={async (v) => {
          await setFaceIdEnabled(v);
          setBioOn(v);
        }}
      />
      <Viewer
        entry={viewing}
        onClose={() => {
          setViewing(null);
          clearViewCache();
        }}
        onRemoved={async () => {
          setViewing(null);
          setEntries((await loadIndex()).entries);
        }}
      />
    </View>
  );
}

function AlbumGrid({ entries, thumbs, onOpen }: { entries: VaultEntry[]; thumbs: Record<string, string>; onOpen: (e: VaultEntry) => void }) {
  const { width } = useWindowDimensions();
  const gap = 6;
  const cell = (width - 40 - gap * 2) / 3;
  return (
    <FlatList
      data={entries}
      numColumns={3}
      keyExtractor={(e) => e.id}
      columnWrapperStyle={{ gap }}
      ItemSeparatorComponent={() => <View style={{ height: gap }} />}
      contentContainerStyle={{ padding: 20, paddingBottom: 190 }}
      ListHeaderComponent={<Text style={styles.help}>Photos here are encrypted and stored only inside Klenzer. They never leave your phone.</Text>}
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Ionicons name="images-outline" size={36} color={colors.ink3} />
          <Text style={styles.emptyText}>No photos yet. Add photos to keep them private.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const uri = DEMO ? `https://picsum.photos/seed/klenzer-vault-${item.id}/300/300` : thumbs[item.id];
        return (
          <PressableScale onPress={() => onOpen(item)} accessibilityLabel={`Photo added ${formatDate(item.addedAt)}`} style={[styles.cell, { width: cell, height: cell }]}>
            {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <ActivityIndicator color={colors.blue} />}
          </PressableScale>
        );
      }}
    />
  );
}

function AlbumFooter({ busy, onAdd, bio, bioOn, onBio }: { busy: boolean; onAdd: () => void; bio: boolean; bioOn: boolean; onBio: (v: boolean) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
      {bio && (
        <View style={styles.bioRow}>
          <Text style={styles.bioText}>Unlock with Face ID</Text>
          <Switch value={bioOn} onValueChange={onBio} trackColor={{ true: colors.blue }} />
        </View>
      )}
      <Button label="Add photos" icon={<Ionicons name="add" size={20} color="#fff" />} busy={busy} onPress={onAdd} testID="vault-add" />
      <FreeLeftNote />
    </View>
  );
}

function Viewer({ entry, onClose, onRemoved }: { entry: VaultEntry | null; onClose: () => void; onRemoved: () => void }) {
  const insets = useSafeAreaInsets();
  const [uri, setUri] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const current = useRef<string | null>(null);
  useEffect(() => {
    current.current = entry?.id ?? null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUri(null);
    if (!entry) return;
    if (DEMO) return setUri(`https://picsum.photos/seed/klenzer-vault-${entry.id}/900/1200`);
    openForViewing(entry)
      .then((u) => current.current === entry.id && setUri(u))
      .catch(() => {});
  }, [entry]);

  const doExport = async () => {
    if (!entry) return;
    setWorking(true);
    const ok = DEMO ? true : await exportToPhotos(entry);
    setWorking(false);
    Alert.alert(ok ? 'Saved to Photos' : 'Could not save', ok ? 'A copy is back in your Photos library. It is still in Secret Album too.' : 'Klenzer needs permission to add photos to your library.');
  };
  const doRemove = () => {
    if (!entry) return;
    Alert.alert('Remove from Secret Album?', 'The encrypted copy is deleted from Klenzer. Save it to Photos first if you want to keep it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (!DEMO) await removeFromAlbum(entry);
          onRemoved();
        },
      },
    ]);
  };

  return (
    <Modal visible={!!entry} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.viewer, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]} testID="vault-viewer">
        <View style={styles.viewerTop}>
          <PressableScale onPress={onClose} accessibilityLabel="Close" style={styles.viewerBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </PressableScale>
          {entry && <Text style={styles.viewerMeta}>{formatBytes(entry.size)}</Text>}
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" /> : <ActivityIndicator color="#fff" />}
        </View>
        <View style={styles.viewerActions}>
          <Button variant="light" label="Save to Photos" busy={working} onPress={() => void doExport()} style={{ flex: 1 }} />
          <Button variant="danger" label="Remove" onPress={doRemove} style={{ flex: 1 }} />
        </View>
      </View>
    </Modal>
  );
}

function PinPad({ onDigit, onDelete, onEnter, enterLabel, extra, disabled }: { onDigit: (d: string) => void; onDelete: () => void; onEnter: () => void; enterLabel: string; extra?: { icon: string; label: string; onPress: () => void }; disabled?: boolean }) {
  const insets = useSafeAreaInsets();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <View style={[styles.pad, { paddingBottom: insets.bottom + 16 }]}>
      {extra && (
        <PressableScale onPress={extra.onPress} style={styles.extra} accessibilityLabel={extra.label}>
          <Ionicons name={extra.icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.blue} />
          <Text style={styles.extraText}>{extra.label}</Text>
        </PressableScale>
      )}
      <View style={styles.keys}>
        {keys.map((k) => (
          <PinKey key={k} label={k} onPress={() => onDigit(k)} disabled={disabled} />
        ))}
        <PinKey label="Delete" icon="backspace-outline" onPress={onDelete} disabled={disabled} />
        <PinKey label="0" onPress={() => onDigit('0')} disabled={disabled} />
        <PinKey label={enterLabel} onPress={onEnter} disabled={disabled} accent />
      </View>
    </View>
  );
}

function PinKey({ label, icon, onPress, disabled, accent }: { label: string; icon?: string; onPress: () => void; disabled?: boolean; accent?: boolean }) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} accessibilityLabel={label} haptic={false} style={[styles.key, accent && { backgroundColor: colors.blue }]}>
      {icon ? <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={24} color={colors.ink} /> : <Text style={[styles.keyText, accent && { color: '#fff', fontSize: 17 }]}>{label}</Text>}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  lockTop: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 24, gap: 10 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  lockTitle: { fontFamily: fonts.bold, fontSize: 21, color: colors.ink },
  lockSub: { fontFamily: fonts.body, fontSize: 14, color: colors.ink2, textAlign: 'center', minHeight: 20 },
  dots: { flexDirection: 'row', gap: 14, marginTop: 10 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.ink3 },
  dotOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  pad: { marginTop: 'auto', paddingHorizontal: 34, gap: 14 },
  extra: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  extraText: { fontFamily: fonts.semi, fontSize: 15, color: colors.blue },
  keys: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  key: { width: '30%', height: 64, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
  keyText: { fontFamily: fonts.semi, fontSize: 26, color: colors.ink },
  help: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink2, marginBottom: 14 },
  emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 50 },
  emptyText: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.ink3, textAlign: 'center' },
  cell: { borderRadius: 10, overflow: 'hidden', backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, gap: 8, backgroundColor: colors.bg },
  bioRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10 },
  bioText: { fontFamily: fonts.semi, fontSize: 15, color: colors.ink },
  viewer: { flex: 1, backgroundColor: '#05070F' },
  viewerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  viewerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  viewerMeta: { fontFamily: fonts.medium, fontSize: 14, color: '#C8D3F2' },
  viewerActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
});
