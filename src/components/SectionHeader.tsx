import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { colors, spacing, typography } from '../theme/tokens'

interface Props {
  title: string
  action?: string
  onAction?: () => void
}

export function SectionHeader({ title, action, onAction }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.action}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h3,
  },
  action: {
    fontSize: 13,
    color: colors.accent.cyan,
    fontWeight: '600',
  },
})
