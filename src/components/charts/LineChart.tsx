import { useState } from 'react'
import { View, Text, TouchableOpacity, type LayoutChangeEvent } from 'react-native'
import { colors } from '../../theme/tokens'

interface Series {
  label: string
  values: number[]
  color?: string
}

interface Props {
  labels: string[]
  series: Series[]
  height?: number
  dateRange?: { start: string; end: string }
  total?: number
}

const CHART_COLORS = colors.chart
const PAD_LEFT = 40
const PAD_RIGHT = 24
const PAD_TOP = 28
const PAD_BOTTOM = 32
const DOT_R = 4

export function LineChart({ labels, series, height = 180, dateRange, total }: Props) {
  const [width, setWidth] = useState(0)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)

  if (!labels || !labels.length || !width) {
    return <View style={{ width: '100%', height }} onLayout={onLayout} />
  }

  const safeSeries = series.map(s => ({ ...s, values: s.values ?? [] }))
  const maxVal = Math.max(...safeSeries.flatMap(s => s.values), 1)
  const chartW = width - PAD_LEFT - PAD_RIGHT
  const chartH = height - PAD_TOP - PAD_BOTTOM
  const stepX = labels.length > 1 ? chartW / (labels.length - 1) : chartW
  const gridLines = 4
  const toX = (i: number) => PAD_LEFT + i * stepX
  const toY = (v: number) => PAD_TOP + chartH - (v / maxVal) * chartH
  const labelStep = Math.max(1, Math.ceil(labels.length / 6))

  const seriesWithColor = safeSeries.map((s, i) => ({
    ...s, color: s.color ?? CHART_COLORS[i % CHART_COLORS.length],
  }))

  const totalPosts = total ?? safeSeries.reduce((sum, s) => sum + s.values.reduce((a, b) => a + b, 0), 0)

  return (
    <View style={{ width: '100%', height }} onLayout={onLayout}>
      {/* Header: total + date range */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: PAD_LEFT, height: 22 }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text.secondary }}>
          {totalPosts} {totalPosts === 1 ? 'post' : 'posts'}
        </Text>
        {seriesWithColor.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color }} />
            <Text style={{ fontSize: 10, color: colors.text.secondary }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Chart area */}
      <View style={{ flex: 1, position: 'relative' }}>
        {/* Grid lines + Y-axis */}
        {Array.from({ length: gridLines + 1 }, (_, i) => {
          const y = PAD_TOP + chartH - (i / gridLines) * chartH
          return (
            <View key={`grid-${i}`} style={{ position: 'absolute', left: PAD_LEFT, right: PAD_RIGHT, top: y }}>
              <View style={{ height: 0, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }} />
              <Text style={{ position: 'absolute', right: 4, top: -6, fontSize: 10, color: colors.text.tertiary, width: PAD_RIGHT - 4, textAlign: 'right' }}>
                {i === gridLines && maxVal >= 1000 ? `${(maxVal / 1000).toFixed(1)}k` : Math.round((i / gridLines) * maxVal)}
              </Text>
            </View>
          )
        })}

        {/* Area fill (vertical bars at each point) */}
        {seriesWithColor.map((s, si) => {
          const pts = s.values.map((v, i) => ({ x: toX(i), y: toY(v) }))
          const barW = labels.length > 1 ? stepX * 0.7 : 20
          return (
            <View key={`fill-${si}`} pointerEvents="none">
              {pts.map((p, j) => (
                <View
                  key={`fbar-${j}`}
                  style={{
                    position: 'absolute',
                    left: p.x - barW / 2,
                    top: p.y,
                    width: barW,
                    height: PAD_TOP + chartH - p.y,
                    backgroundColor: s.color,
                    opacity: 0.1,
                  }}
                />
              ))}
            </View>
          )
        })}

        {/* Connecting lines */}
        {seriesWithColor.map((s, si) => {
          const pts = s.values.map((v, i) => ({ x: toX(i), y: toY(v) }))
          const segments: { x1: number; y1: number; x2: number; y2: number }[] = []
          for (let i = 1; i < pts.length; i++) {
            segments.push({ x1: pts[i - 1].x, y1: pts[i - 1].y, x2: pts[i].x, y2: pts[i].y })
          }
          return (
            <View key={`lines-${si}`} pointerEvents="none">
              {segments.map((seg, j) => {
                const dx = seg.x2 - seg.x1
                const dy = seg.y2 - seg.y1
                const len = Math.sqrt(dx * dx + dy * dy)
                const angle = Math.atan2(dy, dx) * (180 / Math.PI)
                return (
                  <View
                    key={`seg-${j}`}
                    style={{
                      position: 'absolute',
                      left: seg.x1,
                      top: seg.y1,
                      width: len,
                      height: 2.5,
                      backgroundColor: s.color,
                      borderRadius: 1,
                      transformOrigin: '0 50%',
                      transform: [{ rotate: `${angle}deg` }],
                    }}
                  />
                )
              })}
            </View>
          )
        })}

        {/* Data points (interactive dots) */}
        {seriesWithColor.map((s, si) =>
          s.values.map((v, j) => {
            const x = toX(j)
            const y = toY(v)
            const isSelected = selectedIdx === j
            return (
              <TouchableOpacity
                key={`dot-${si}-${j}`}
                activeOpacity={0.7}
                onPress={() => setSelectedIdx(isSelected ? null : j)}
                style={{
                  position: 'absolute',
                  left: x - DOT_R - 4,
                  top: y - DOT_R - 4,
                  width: (DOT_R + 4) * 2,
                  height: (DOT_R + 4) * 2,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: isSelected ? DOT_R * 3 : DOT_R * 2,
                    height: isSelected ? DOT_R * 3 : DOT_R * 2,
                    borderRadius: isSelected ? DOT_R * 1.5 : DOT_R,
                    backgroundColor: colors.space.bg,
                    borderWidth: isSelected ? 3 : 2,
                    borderColor: s.color,
                    opacity: 0.95,
                  }}
                />
              </TouchableOpacity>
            )
          })
        )}

        {/* Tooltip for selected point */}
        {selectedIdx !== null && selectedIdx < labels.length && safeSeries[0] && (
          <View
            style={{
              position: 'absolute',
              left: Math.max(4, Math.min(toX(selectedIdx) - 50, width - 108)),
              top: Math.max(4, toY(seriesWithColor[0]?.values[selectedIdx] ?? 0) - 44),
              backgroundColor: colors.space.surface,
              borderWidth: 1,
              borderColor: colors.glass.cardBorder,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              zIndex: 10,
              minWidth: 96,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 10, color: colors.text.tertiary }}>{labels[selectedIdx]}</Text>
            {seriesWithColor.map((s, i) => (
              <Text key={i} style={{ fontSize: 13, fontWeight: '700', color: s.color }}>
                {s.values[selectedIdx] >= 1000
                  ? `${(s.values[selectedIdx] / 1000).toFixed(1)}k`
                  : s.values[selectedIdx]}
              </Text>
            ))}
          </View>
        )}

        {/* X-axis labels */}
        {labels.map((l, i) =>
          i % labelStep === 0 ? (
            <Text
              key={`xlabel-${i}`}
              style={{
                position: 'absolute',
                left: toX(i) - 24,
                top: height - PAD_BOTTOM + 4,
                width: 48,
                fontSize: 9,
                color: colors.text.tertiary,
                textAlign: 'center',
              }}
              numberOfLines={1}
            >
              {l}
            </Text>
          ) : null
        )}

        {/* Date range label at bottom edges */}
        {dateRange && (
          <>
            <Text
              style={{
                position: 'absolute',
                left: PAD_LEFT,
                top: height - 6,
                fontSize: 8,
                color: 'rgba(255,255,255,0.25)',
              }}
            >
              {dateRange.start}
            </Text>
            <Text
              style={{
                position: 'absolute',
                right: PAD_RIGHT,
                top: height - 6,
                fontSize: 8,
                color: 'rgba(255,255,255,0.25)',
              }}
            >
              {dateRange.end}
            </Text>
          </>
        )}
      </View>
    </View>
  )
}
