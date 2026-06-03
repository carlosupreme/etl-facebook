import { View, Text } from 'react-native'
import { colors } from '../../theme/tokens'

interface Props {
  data: { label: string; value: number }[]
  height?: number
  color?: string
}

const CHART_COLORS = colors.chart

export function BarChart({ data, height = 180, color }: Props) {
  if (!data || !data.length) return null

  const maxVal = Math.max(...data.map(d => d.value), 1)

  return (
    <View style={{ width: '100%', height, justifyContent: 'flex-end', gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', flex: 1, gap: 4 }}>
        {data.map((d, i) => {
          const h = Math.max((d.value / maxVal) * (height - 24), 4)
          const c = color ?? CHART_COLORS[i % CHART_COLORS.length]
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: colors.text.tertiary, marginBottom: 2 }}>
                {d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : d.value}
              </Text>
              <View style={{ width: '80%', height: h, backgroundColor: c, borderRadius: 3, opacity: 0.85 }} />
              <Text style={{ fontSize: 8, color: colors.text.tertiary, marginTop: 2, textAlign: 'center' }}>
                {d.label.length > 6 ? d.label.slice(0, 6) + '…' : d.label}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}
