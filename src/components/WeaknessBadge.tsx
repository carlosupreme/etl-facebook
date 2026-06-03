import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, radius } from '../theme/tokens'

type Severity = 'critical' | 'warning' | 'monitor'

interface Props {
  severity: Severity
  label: string
}

const severityColors = {
  critical: { bg: 'rgba(232,74,90,0.15)', text: colors.status.critical, dot: colors.status.critical },
  warning: { bg: 'rgba(232,184,74,0.15)', text: colors.status.warning, dot: colors.status.warning },
  monitor: { bg: 'rgba(74,216,232,0.12)', text: colors.status.monitor, dot: colors.status.monitor },
}

export function WeaknessBadge({ severity, label }: Props) {
  const c = severityColors[severity]
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.text + '30' }]}>
      <View style={[styles.dot, { backgroundColor: c.dot }]} />
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
})
