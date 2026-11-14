import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { remainingLine } from '../lib/gating';
import { useStore } from '../lib/store';
import { colors, fonts } from '../theme';

/** Subtle "3 free items left today" line. Hidden for Pro. */
export function FreeLeftNote({ style }: { style?: StyleProp<TextStyle> }) {
  const { isPro, freeLeft } = useStore();
  if (isPro) return null;
  return (
    <Text style={[styles.note, style]} testID="free-left">
      {remainingLine(freeLeft)}
    </Text>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink3, textAlign: 'center' },
});
