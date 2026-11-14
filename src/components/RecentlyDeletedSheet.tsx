import { useEffect, useState } from 'react';
import { Alert, Linking, Modal, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RD_SHEET_COPY } from '../lib/rd-sheet';
import { Button } from './Button';
import { colors, fonts } from '../theme';

const PHOTOS_URL = 'photos-redirect://';
export function RecentlyDeletedSheet({
  visible,
  bytes,
  onClose,
  hidePref,
  onHidePrefChange,
}: {
  visible: boolean;
  bytes: number;
  onClose: () => void;
  hidePref: boolean;
  onHidePrefChange: (hide: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const [canOpen, setCanOpen] = useState(Platform.OS === 'ios');

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let cancelled = false;
    Linking.canOpenURL(PHOTOS_URL)
      .then((ok) => { if (!cancelled) setCanOpen(ok); })
      .catch(() => { if (!cancelled) setCanOpen(false); });
    return () => { cancelled = true; };
  }, [visible]);

  const openPhotos = async () => {
    try {
      const ok = await Linking.canOpenURL(PHOTOS_URL);
      if (ok) {
        await Linking.openURL(PHOTOS_URL);
        onClose();
        return;
      }
    } catch {}
    Alert.alert(
      'Open the Photos app',
      'Klenzer cannot open Photos automatically on this device. In Photos, go to Albums, then Recently Deleted, then Select, then Delete All.',
    );
  };

  if (Platform.OS !== 'ios') return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} testID="recently-deleted-sheet" accessibilityViewIsModal>
        <View style={styles.handle} />
        <Text style={styles.headline} testID="rd-headline">
          {RD_SHEET_COPY.headline(bytes)}
        </Text>
        <Text style={styles.stepsTitle}>{RD_SHEET_COPY.stepsTitle}</Text>
        <Text style={styles.steps}>{RD_SHEET_COPY.steps}</Text>
        <Text style={styles.note}>
          There is no direct link to Recently Deleted. Space is freed after you empty it, or after 30 days.
        </Text>
        <Button label={RD_SHEET_COPY.open} onPress={openPhotos} testID="rd-open-photos" style={{ opacity: canOpen ? 1 : 1, marginTop: 8 }} />
        <Button variant="light" label={RD_SHEET_COPY.later} onPress={onClose} testID="rd-later" />
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{RD_SHEET_COPY.dontShow}</Text>
          <Switch
            value={hidePref}
            onValueChange={onHidePrefChange}
            trackColor={{ true: colors.blue }}
            accessibilityLabel={RD_SHEET_COPY.dontShow}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,16,32,0.45)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 10,
    gap: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 8 },
  headline: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 28, color: colors.ink, letterSpacing: -0.3 },
  stepsTitle: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink2, marginTop: 4 },
  steps: { fontFamily: fonts.semi, fontSize: 16, lineHeight: 24, color: colors.ink },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.ink3 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  toggleLabel: { fontFamily: fonts.semi, fontSize: 15, color: colors.ink },
});
