import { useEffect, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

type Props = { value: number; format: (n: number) => string; style?: StyleProp<TextStyle>; duration?: number };

export function CountUp({ value, format, style, duration = 1200 }: Props) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / duration);
      setN(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <Text style={style}>{format(n)}</Text>;
}
