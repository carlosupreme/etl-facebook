import { View, StyleSheet, type ViewProps } from 'react-native'
import { colors, radius, spacing, shadows } from '../theme/tokens'

interface Props extends ViewProps {
  glow?: 'amber' | 'cyan' | 'magenta' | 'green' | 'warning' | 'none'
}

export function GlassCard({ style, glow = 'none', children, ...props }: Props) {
  const borderColor =
    glow === 'none'
      ? colors.glass.cardBorder
      : glow === 'amber'
        ? colors.accent.amberGlow
        : glow === 'cyan'
          ? colors.accent.cyanGlow
          : glow === 'magenta'
            ? colors.accent.magentaGlow
            : glow === 'warning'
          ? colors.accent.amberGlow
          : colors.accent.greenGlow

  return (
    <View
      style={[
        styles.card,
        { borderColor },
        glow !== 'none' && styles.glowBorder,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glass.cardBorder,
    padding: spacing.md,
    ...shadows.glass,
  },
  glowBorder: {
    borderWidth: 1.5,
    ...shadows.glow,
  },
})
