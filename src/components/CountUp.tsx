import { useEffect, useRef, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

type Props = { value: number; format: (n: number) => string; style?: StyleProp<TextStyle>; duration?: number };

/** Counts from the previously shown value to the new one, so live updates glide instead of restarting at zero. */
export function CountUp({ value, format, style, duration = 1200 }: Props) {
  const [n, setN] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    let raf = 0;
    const start = from.current;
    const t0 = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / duration);
      const v = start + (value - start) * (1 - Math.pow(1 - t, 3));
      from.current = v;
      setN(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <Text style={style}>{format(n)}</Text>;
}
