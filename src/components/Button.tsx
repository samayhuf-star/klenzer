import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, radius } from '../theme';
import { PressableScale } from './PressableScale';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'light';
  icon?: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function Button({ label, onPress, variant = 'primary', icon, busy, disabled, style, testID, accessibilityLabel, accessibilityHint }: Props) {
  const textColor = variant === 'primary' || variant === 'danger' ? '#fff' : variant === 'light' ? colors.ink : colors.blue;
  const inner = (
    <View style={styles.row}>
      {busy ? <ActivityIndicator color={textColor} /> : icon}
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </View>
  );
  return (
    <PressableScale onPress={onPress} disabled={disabled || busy} accessibilityLabel={accessibilityLabel ?? label} accessibilityHint={accessibilityHint} style={[styles.wrap, style]} testID={testID}>
      {variant === 'primary' ? (
        <LinearGradient colors={[colors.blue, '#1BB6D8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
          {inner}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.fill,
            variant === 'danger' && { backgroundColor: colors.danger },
            variant === 'light' && { backgroundColor: '#fff' },
            variant === 'ghost' && { backgroundColor: colors.blueSoft },
          ]}>
          {inner}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.pill, overflow: 'hidden' },
  fill: { paddingVertical: 17, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, maxWidth: '100%' },
  label: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 17, letterSpacing: 0.1, textAlign: 'center' },
});
