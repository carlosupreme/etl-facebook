import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, radius, typography } from '../theme/tokens'
import { GlassCard } from './GlassCard'

interface Props {
  label: string
  value: string | number
  icon?: string
  trend?: { value: number; positive: boolean }
}

export function KpiTile({ label, value, trend }: Props) {
  return (
    <GlassCard style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Text>
      {trend && (
        <View style={styles.trendRow}>
          <Text style={[styles.trend, { color: trend.positive ? colors.accent.green : colors.status.critical }]}>
            {trend.positive ? '▲' : '▼'} {Math.abs(trend.value)}%
          </Text>
        </View>
      )}
    </GlassCard>
  )
}

const styles = StyleSheet.create({
  tile: {
    width: '48%',
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.kpi,
    color: colors.accent.amber,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  trend: {
    fontSize: 13,
    fontWeight: '600',
  },
})
