import { useState } from 'react'
import { View, Text, type LayoutChangeEvent } from 'react-native'
import { colors } from '../../theme/tokens'

interface Props {
  data: { label: string; value: number }[]
  height?: number
  innerRadius?: number
}

const CHART_COLORS = colors.chart

export function PieChart({ data, height = 180, innerRadius }: Props) {
  const [width, setWidth] = useState(0)
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)

  if (!data || !data.length || !width) {
    return <View style={{ width: '100%', height }} onLayout={onLayout} />
  }

  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return <View style={{ width: '100%', height }} onLayout={onLayout} />
  }

  const hasDonut = innerRadius != null && innerRadius > 0
  const legendW = 90
  const barH = height - 40
  const maxLegendItems = Math.floor(barH / 22)

  return (
    <View style={{ width: '100%', height, gap: 8 }} onLayout={onLayout}>
      {/* Stacked horizontal bar as pie replacement */}
      <View style={{ flexDirection: 'row', height: 20, borderRadius: 4, overflow: 'hidden' }}>
        {data.map((d, i) => {
          const pct = d.value / total
          if (pct < 0.005) return null
          return (
            <View
              key={i}
              style={{
                flex: pct,
                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                opacity: 0.85,
              }}
            />
          )
        })}
      </View>
      {/* Donut-style total in center of bar area */}
      {hasDonut && (
        <View style={{ alignItems: 'center', marginTop: -2 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text.primary }}>
            {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
          </Text>
          <Text style={{ fontSize: 10, color: colors.text.tertiary }}>total</Text>
        </View>
      )}
      {/* Legend */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {data.slice(0, maxLegendItems).map((d, i) => {
          const pct = Math.round((d.value / total) * 100)
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
              <Text style={{ fontSize: 10, color: colors.text.secondary }} numberOfLines={1}>
                {d.label.length > 10 ? d.label.slice(0, 10) + '…' : d.label}
              </Text>
              <Text style={{ fontSize: 9, color: colors.text.tertiary }}>{pct}%</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}
