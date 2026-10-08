import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { CountUp } from '../components/CountUp';
import { PressableScale } from '../components/PressableScale';
import { Ring } from '../components/Ring';
import { formatBytes } from '../lib/format';
import { dupExtraCount, dupReclaimable, sum } from '../lib/scanner';
import { useStore } from '../lib/store';
import { colors, fonts, radius, shadow } from '../theme';

export default function Home() {
  const insets = useSafeAreaInsets();
  const { disk, access, canAskAgain, requestAccess, openSettings, manageLimited, scanning, progress, result, scan, cancelScan, lifetimeFreed } = useStore();
  const usedPct = disk.total ? disk.used / disk.total : 0;
  const denied = access === 'denied';

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const phase = progress?.phase === 'measuring' ? 'Measuring file sizes' : 'Reading your library';

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={require('../../assets/logo.png')} style={{ width: 34, height: 34 }} />
          <Text style={styles.brandText}>Klenzer</Text>
        </View>
        <PressableScale onPress={() => router.push('/settings')} accessibilityLabel="Settings" style={styles.gear}>
          <Ionicons name="settings-outline" size={22} color={colors.ink} />
        </PressableScale>
      </View>

      <Animated.View entering={FadeInDown.duration(500)} style={[styles.card, styles.hero]}>
        <Text style={styles.eyebrow}>THIS DEVICE</Text>
        <Ring size={188} stroke={16} progress={usedPct}>
          <CountUp value={disk.free} format={(n) => formatBytes(n)} style={styles.big} />
          <Text style={styles.sub}>free of {formatBytes(disk.total, 0)}</Text>
        </Ring>
        <Text style={styles.note}>
          Klenzer clears photo and video clutter, which is often the biggest space hog. It can’t clear app caches or system data.
        </Text>
      </Animated.View>

      {denied && (
        <Notice icon="lock-closed" tone="amber" title="Photo access is off" body="Klenzer needs to read your photo library to find clutter. Photos never leave your device.">
          <Button variant="light" label={canAskAgain ? 'Allow access' : 'Open Settings'} onPress={canAskAgain ? requestAccess : openSettings} />
        </Notice>
      )}
      {access === 'limited' && (
        <Notice icon="images" tone="blue" title="Limited photo access" body="Klenzer can only see the photos you selected, so results may be incomplete.">
          <Button variant="light" label="Choose more photos" onPress={manageLimited} />
        </Notice>
      )}

      {scanning ? (
        <Animated.View entering={FadeInDown} style={[styles.card, { marginTop: 16 }]}>
          <Text style={styles.cardTitle}>{phase}…</Text>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.max(4, pct)}%` }]} />
          </View>
          <Text style={styles.sub}>
            {progress?.done.toLocaleString()} of {progress?.total.toLocaleString()} · {pct}%
          </Text>
          <Button variant="ghost" label="Cancel" onPress={cancelScan} style={{ marginTop: 14 }} />
        </Animated.View>
      ) : (
        <Button
          label={result ? 'Scan again' : 'Scan my library'}
          icon={<Ionicons name="sparkles" size={20} color="#fff" />}
          onPress={scan}
          style={{ marginTop: 18 }}
        />
      )}

      {result && !scanning && (
        <Animated.View entering={FadeInDown.delay(100)} style={{ marginTop: 22, gap: 12 }}>
          <Text style={styles.section}>What we found</Text>
          <Category
            kind="duplicates"
            icon="copy"
            tone={colors.blue}
            soft={colors.blueSoft}
            title="Duplicates & near-identical"
            count={dupExtraCount(result.duplicates)}
            bytes={dupReclaimable(result.duplicates)}
            hint="Photos taken at the same moment, same size"
          />
          <Category
            kind="screenshots"
            icon="phone-portrait"
            tone={colors.violet}
            soft={colors.violetSoft}
            title="Screenshots"
            count={result.screenshots.length}
            bytes={sum(result.screenshots)}
            hint="Review and clear the ones you don’t need"
          />
          <Category
            kind="videos"
            icon="videocam"
            tone={colors.amber}
            soft={colors.amberSoft}
            title="Large videos"
            count={result.largeVideos.length}
            bytes={sum(result.largeVideos)}
            hint="Videos over 100 MB, biggest first"
          />
          <Text style={styles.foot}>
            Scanned {result.photoCount.toLocaleString()} photos and {result.videoCount.toLocaleString()} videos. Photos stored only in iCloud aren’t measured.
          </Text>
        </Animated.View>
      )}

      {lifetimeFreed > 0 && (
        <View style={styles.lifetime}>
          <Ionicons name="leaf" size={18} color={colors.mint} />
          <Text style={styles.lifetimeText}>You’ve cleared {formatBytes(lifetimeFreed)} with Klenzer</Text>
        </View>
      )}
    </ScrollView>
  );
}

function Category(p: { kind: string; icon: string; tone: string; soft: string; title: string; count: number; bytes: number; hint: string }) {
  const empty = p.count === 0;
  return (
    <PressableScale
      onPress={() => !empty && router.push({ pathname: '/review/[kind]', params: { kind: p.kind } })}
      accessibilityLabel={`${p.title}, ${p.count} items`}
      style={[styles.card, styles.cat]}>
      <View style={[styles.catIcon, { backgroundColor: empty ? colors.mintSoft : p.soft }]}>
        <Ionicons name={(empty ? 'checkmark' : p.icon) as never} size={24} color={empty ? '#0BAE86' : p.tone} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.catTitle}>{p.title}</Text>
        <Text style={styles.catHint}>{empty ? 'All clear. Nothing to clean here.' : p.hint}</Text>
      </View>
      {!empty && (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.catBytes}>{p.bytes > 0 ? formatBytes(p.bytes) : `${p.count}`}</Text>
          <Text style={styles.catCount}>{p.count.toLocaleString()} items</Text>
        </View>
      )}
      {!empty && <Ionicons name="chevron-forward" size={18} color={colors.ink3} />}
    </PressableScale>
  );
}

function Notice({ icon, tone, title, body, children }: { icon: string; tone: 'amber' | 'blue'; title: string; body: string; children: ReactNode }) {
  const bg = tone === 'amber' ? colors.amberSoft : colors.blueSoft;
  const fg = tone === 'amber' ? '#B26A00' : colors.blue;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Ionicons name={icon as never} size={20} color={fg} />
        <Text style={[styles.noticeTitle, { color: fg }]}>{title}</Text>
      </View>
      <Text style={styles.noticeBody}>{body}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandText: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, letterSpacing: -0.5 },
  gear: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 20, ...shadow },
  hero: { alignItems: 'center', gap: 18, paddingVertical: 24 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.6, color: colors.ink3 },
  big: { fontFamily: fonts.display, fontSize: 34, color: colors.ink, letterSpacing: -1 },
  sub: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink3, marginTop: 2 },
  note: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.ink2, textAlign: 'center' },
  notice: { borderRadius: radius.md, padding: 16, gap: 10, marginTop: 16 },
  noticeTitle: { fontFamily: fonts.bold, fontSize: 16 },
  noticeBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink, marginBottom: 14 },
  bar: { height: 10, borderRadius: 5, backgroundColor: colors.line, overflow: 'hidden', marginBottom: 10 },
  barFill: { height: '100%', borderRadius: 5, backgroundColor: colors.blue },
  section: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink, marginBottom: 2 },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  catIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  catTitle: { fontFamily: fonts.semi, fontSize: 16.5, color: colors.ink },
  catHint: { fontFamily: fonts.body, fontSize: 13, color: colors.ink3, marginTop: 2, lineHeight: 18 },
  catBytes: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  catCount: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3, marginTop: 2 },
  foot: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.ink3, textAlign: 'center', marginTop: 4 },
  lifetime: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 26 },
  lifetimeText: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink2 },
});
