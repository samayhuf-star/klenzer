import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { Button } from './Button';

/** Full-screen explainer used before a permission prompt, and when a permission was refused. */
export function Gate({ icon, title, body, label, onPress, busy, secondary }: { icon: string; title: string; body: string; label: string; onPress: () => void; busy?: boolean; secondary?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Ionicons name={icon as never} size={40} color={colors.blue} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Button label={label} onPress={onPress} busy={busy} style={{ alignSelf: 'stretch', marginTop: 8 }} />
      {secondary && <Button variant="ghost" label={secondary.label} onPress={secondary.onPress} style={{ alignSelf: 'stretch' }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 14 },
  badge: { width: 84, height: 84, borderRadius: 28, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, textAlign: 'center', letterSpacing: -0.4 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink2, textAlign: 'center' },
});
