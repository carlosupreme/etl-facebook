import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, spacing, radius, typography } from '../theme/tokens'

export interface DateRange {
  label: string
  whereClause: string
}

interface Props {
  onChange: (range: DateRange) => void
  initial?: string
}

const RANGES: { label: string; whereClause: string }[] = [
  { label: 'Todo el tiempo', whereClause: '' },
  { label: 'Últimos 7 días', whereClause: "WHERE timestamp >= datetime('now', '-7 days', '+6 years')" },
  { label: 'Últimos 30 días', whereClause: "WHERE timestamp >= datetime('now', '-30 days', '+6 years')" },
  { label: '6 meses', whereClause: "WHERE timestamp >= datetime('now', '-6 months', '+6 years')" },
  { label: '1 año', whereClause: "WHERE timestamp >= datetime('now', '-1 year', '+6 years')" },
]

export function DateRangeFilter({ onChange, initial = 'Todo el tiempo' }: Props) {
  const [active, setActive] = useState(initial)

  return (
    <View style={styles.row}>
      {RANGES.map((r) => {
        const isActive = active === r.label
        return (
          <TouchableOpacity
            key={r.label}
            style={[styles.btn, isActive && styles.btnActive]}
            onPress={() => { setActive(r.label); onChange(r) }}
          >
            <Text style={[styles.btnText, isActive && styles.btnTextActive]}>{r.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  btn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.glass.card,
    borderWidth: 1,
    borderColor: colors.glass.cardBorder,
  },
  btnActive: {
    backgroundColor: colors.accent.amberGlow,
    borderColor: colors.accent.amber,
  },
  btnText: { ...typography.small, color: colors.text.secondary, fontSize: 11 },
  btnTextActive: { color: colors.accent.amber, fontWeight: '600' },
})
