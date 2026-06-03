import { View, Text, StyleSheet } from 'react-native'
import { GlassCard } from './GlassCard'
import { colors, spacing, typography } from '../theme/tokens'
import type { ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
  height?: number
}

export function ChartContainer({ title, children, height = 220 }: Props) {
  return (
    <GlassCard style={[styles.container, { height: height + 50 }]}>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.chartArea, { height }]}>{children}</View>
    </GlassCard>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  chartArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
