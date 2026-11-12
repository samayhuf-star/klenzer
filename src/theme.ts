/**
 * Klenzer palette: warm paper background, deep forest ink, an evergreen primary accent and a lime highlight.
 * `blue` is kept as the key name for the primary accent so every screen picks up the palette in one place.
 */
export const colors = {
  bg: '#F4F2EC',
  card: '#FFFFFF',
  ink: '#12211C',
  ink2: '#47554F',
  ink3: '#86918B',
  line: '#E6E2D8',
  mint: '#2FD08A',
  blue: '#0E7C5A',
  blueSoft: '#DCF1E7',
  mintSoft: '#DDF7EA',
  danger: '#E5484D',
  dangerSoft: '#FDE8E8',
  amber: '#F08C1A',
  amberSoft: '#FDF0DC',
  violet: '#6A4FD8',
  violetSoft: '#ECE8FB',
  navy: '#0F1E19',
  gold: '#C9A227',
  goldSoft: '#F3E6B0',
  track: '#E9E6DD',
  lime: '#C8F25A',
  limeSoft: '#F1FBD6',
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
  shadowColor: '#1E2B26',
  shadowOpacity: 0.07,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;
