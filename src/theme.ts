/**
 * Ai Klenzer palette: cool paper background, ink, and a blue primary.
 * `lime` is the light-blue highlight used on the navy hero so every screen
 * picks up the blue theme from one place. Extra tokens (coral, sky, track)
 * keep category colors distinct.
 */
export const colors = {
  bg: '#F4F7FF',
  card: '#FFFFFF',
  ink: '#0B1020',
  ink2: '#4A5470',
  ink3: '#8A93AD',
  line: '#E0E7F5',
  mint: '#19E3B1',
  blue: '#2563EB',
  blueSoft: '#DBEAFE',
  mintSoft: '#DDFBF2',
  danger: '#F2455C',
  dangerSoft: '#FFE9EC',
  amber: '#FF9F1C',
  amberSoft: '#FFF1DB',
  violet: '#6366F1',
  violetSoft: '#E0E7FF',
  navy: '#0B1020',
  gold: '#C9A227',
  goldSoft: '#F3E6B0',
  track: '#D7E3F8',
  lime: '#93C5FD',
  limeSoft: '#DBEAFE',
  coral: '#F2664B',
  coralSoft: '#FDE7E1',
  sky: '#2A8BC2',
  skySoft: '#E1F0F8',
};

export const fonts = {
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  display: 'Fraunces_700Bold',
};

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };

export const shadow = {
  shadowColor: '#1E3A8A',
  shadowOpacity: 0.08,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
} as const;
