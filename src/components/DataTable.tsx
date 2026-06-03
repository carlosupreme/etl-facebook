import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { GlassCard } from './GlassCard'
import { colors, spacing, typography } from '../theme/tokens'

interface Column {
  key: string
  label: string
  width?: number
  render?: (val: any) => string
}

interface Props {
  columns: Column[]
  data: any[]
}

export function DataTable({ columns, data }: Props) {
  if (!data || data.length === 0) {
    return (
      <GlassCard style={styles.empty}>
        <Text style={typography.body}>No data</Text>
      </GlassCard>
    )
  }

  return (
    <GlassCard style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.headerRow}>
            {columns.map((col) => (
              <View key={col.key} style={[styles.headerCell, { minWidth: col.width ?? 100 }]}>
                <Text style={styles.headerText}>{col.label}</Text>
              </View>
            ))}
          </View>
          {data.map((row, i) => (
            <View key={i} style={[styles.row, i % 2 === 1 && styles.rowAlt]}>
              {columns.map((col) => (
                <View key={col.key} style={[styles.cell, { minWidth: col.width ?? 100 }]}>
                  <Text style={styles.cellText} numberOfLines={1}>
                    {col.render ? col.render(row[col.key]) : String(row[col.key] ?? '')}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </GlassCard>
  )
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  empty: { padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.glass.cardBorder,
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerCell: { paddingHorizontal: spacing.sm },
  headerText: { ...typography.label, color: colors.text.secondary, textTransform: 'uppercase' },
  row: { flexDirection: 'row', paddingVertical: spacing.xs },
  rowAlt: { backgroundColor: 'rgba(0,0,0,0.03)' },
  cell: { paddingHorizontal: spacing.sm },
  cellText: { ...typography.body, fontSize: 13 },
})
