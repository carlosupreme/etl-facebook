export const colors = {
  space: {
    bg: '#F4F6FA',
    bgGradientStart: '#F4F6FA',
    bgGradientEnd: '#EEF0F8',
    surface: 'rgba(0,0,0,0.03)',
    surfaceHover: 'rgba(0,0,0,0.06)',
  },
  glass: {
    card: '#FFFFFF',
    cardBorder: 'rgba(0,0,0,0.08)',
    cardBorderActive: 'rgba(196,122,30,0.45)',
    blur: 20,
    highlight: 'rgba(255,255,255,0.9)',
  },
  accent: {
    amber: '#C47A1E',
    amberGlow: 'rgba(196,122,30,0.12)',
    cyan: '#0891B2',
    cyanGlow: 'rgba(8,145,178,0.10)',
    magenta: '#BE185D',
    magentaGlow: 'rgba(190,24,93,0.10)',
    green: '#15803D',
    greenGlow: 'rgba(21,128,61,0.10)',
  },
  text: {
    primary: '#111827',
    secondary: 'rgba(17,24,39,0.6)',
    tertiary: 'rgba(17,24,39,0.38)',
    accent: '#C47A1E',
  },
  status: {
    critical: '#DC2626',
    warning: '#D97706',
    monitor: '#0891B2',
    success: '#16A34A',
  },
  chart: ['#C47A1E', '#0891B2', '#BE185D', '#15803D', '#D97706', '#6D28D9'],
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
}

export const typography = {
  kpi: { fontSize: 32, fontWeight: '700' as const, color: colors.accent.amber },
  h1: { fontSize: 24, fontWeight: '700' as const, color: colors.text.primary },
  h2: { fontSize: 18, fontWeight: '600' as const, color: colors.text.primary },
  h3: { fontSize: 15, fontWeight: '600' as const, color: colors.text.primary },
  body: { fontSize: 14, fontWeight: '400' as const, color: colors.text.secondary },
  small: { fontSize: 12, fontWeight: '400' as const, color: colors.text.tertiary },
  mono: { fontSize: 13, fontWeight: '400' as const, color: colors.text.primary },
  label: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 1 },
}

export const shadows = {
  glass: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  glow: {
    shadowColor: '#C47A1E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
}
