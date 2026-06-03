import { useState } from 'react'
import { View, Text, type LayoutChangeEvent } from 'react-native'
import { colors } from '../../theme/tokens'

interface Props {
  data: { x: number; y: number }[]
  height?: number
  color?: string
  xLabel?: string
  yLabel?: string
}

const CHART_COLORS = colors.chart
const PAD_LEFT = 40
const PAD_RIGHT = 16
const PAD_TOP = 24
const PAD_BOTTOM = 36
const DOT_R = 4

export function ScatterChart({ data, height = 180, color, xLabel, yLabel }: Props) {
  const [width, setWidth] = useState(0)
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)

  if (!data || !data.length || !width) {
    return <View style={{ width: '100%', height }} onLayout={onLayout} />
  }

  const maxX = Math.max(...data.map(d => d.x), 1)
  const maxY = Math.max(...data.map(d => d.y), 1)
  const chartW = width - PAD_LEFT - PAD_RIGHT
  const chartH = height - PAD_TOP - PAD_BOTTOM
  const c = color ?? CHART_COLORS[0]
  const gridLines = 4

  const toX = (v: number) => PAD_LEFT + (v / maxX) * chartW
  const toY = (v: number) => PAD_TOP + chartH - (v / maxY) * chartH

  return (
    <View style={{ width: '100%', height }} onLayout={onLayout}>
      {/* Chart area */}
      <View style={{ flex: 1, position: 'relative' }}>
        {/* Horizontal grid */}
        {Array.from({ length: gridLines + 1 }, (_, i) => {
          const y = PAD_TOP + chartH - (i / gridLines) * chartH
          return (
            <View key={`grid-y-${i}`} style={{ position: 'absolute', left: PAD_LEFT, right: PAD_RIGHT, top: y }}>
              <View style={{ height: 0, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }} />
              <Text style={{ position: 'absolute', right: 4, top: -6, fontSize: 10, color: colors.text.tertiary }}>
                {i === gridLines && maxY >= 1000 ? `${(maxY / 1000).toFixed(1)}k` : Math.round((i / gridLines) * maxY)}
              </Text>
            </View>
          )
        })}
        {/* Vertical grid */}
        {Array.from({ length: gridLines + 1 }, (_, i) => {
          const x = PAD_LEFT + (i / gridLines) * chartW
          return (
            <View key={`grid-x-${i}`} style={{ position: 'absolute', left: x, top: PAD_TOP, width: 0, height: chartH }}>
              <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.05)' }} />
              <Text style={{ position: 'absolute', left: -14, top: chartH + 4, fontSize: 9, color: colors.text.tertiary, width: 28, textAlign: 'center' }}>
                {i === gridLines && maxX >= 1000 ? `${(maxX / 1000).toFixed(1)}k` : Math.round((i / gridLines) * maxX)}
              </Text>
            </View>
          )
        })}
        {/* Dots */}
        {data.map((d, i) => {
          const dx = toX(d.x) - DOT_R
          const dy = toY(d.y) - DOT_R
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: dx,
                top: dy,
                width: DOT_R * 2,
                height: DOT_R * 2,
                borderRadius: DOT_R,
                backgroundColor: c,
                opacity: 0.55,
              }}
            />
          )
        })}
        {/* Axis labels */}
        {xLabel && (
          <Text style={{
            position: 'absolute',
            left: PAD_LEFT + chartW / 2 - 40,
            top: height - 2,
            width: 80,
            textAlign: 'center',
            fontSize: 10,
            color: colors.text.tertiary,
          }}>
            {xLabel}
          </Text>
        )}
        {yLabel && (
          <Text style={{
            position: 'absolute',
            left: 2,
            top: PAD_TOP + chartH / 2 - 8,
            fontSize: 10,
            color: colors.text.tertiary,
            transform: [{ rotate: '-90deg' }],
          }}>
            {yLabel}
          </Text>
        )}
      </View>
    </View>
  )
}
