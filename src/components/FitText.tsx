import { AccessibilityProps, StyleProp, Text, TextStyle } from 'react-native';

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
  /** Lines the text may wrap to before it shrinks. */
  lines?: number;
  minScale?: number;
  /** Caps Dynamic Type. One step up still fits; beyond that the text scales down to minScale. */
  maxMultiplier?: number;
  accessibilityLiveRegion?: AccessibilityProps['accessibilityLiveRegion'];
};

/**
 * Single place for text that must stay inside its box on a 375–430pt phone
 * and at a larger text size. The parent has to give the text a width
 * (flex shrink or align stretch) or iOS will not shrink it.
 */
export function FitText({ children, style, lines = 1, minScale = 0.72, maxMultiplier = 1.35, accessibilityLiveRegion }: Props) {
  return (
    <Text
      style={style}
      numberOfLines={lines}
      adjustsFontSizeToFit
      minimumFontScale={minScale}
      maxFontSizeMultiplier={maxMultiplier}
      allowFontScaling
      accessibilityLiveRegion={accessibilityLiveRegion}>
      {children}
    </Text>
  );
}
