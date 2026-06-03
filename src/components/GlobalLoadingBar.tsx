import React, { useEffect, useRef, useState, useCallback } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { colors, radius, typography, spacing } from '../theme/tokens'
import { getActiveQueries, onQueryChange } from '../hooks/useDbQuery'

export function GlobalLoadingBar() {
  const progress = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0)).current
  const visibleRef = useRef(false)
  const startTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [display, setDisplay] = useState({ count: 0, elapsed: 0, show: false })

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  useEffect(() => {
    const unsub = onQueryChange(() => {
      const count = getActiveQueries()

      if (count > 0) {
        if (!visibleRef.current) {
          visibleRef.current = true
          startTimeRef.current = Date.now()
          progress.setValue(0)
          opacity.setValue(0)

          Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: false }),
            Animated.timing(progress, { toValue: 0.5, duration: 600, useNativeDriver: false }),
          ]).start()

          if (timerRef.current) clearInterval(timerRef.current)
          timerRef.current = setInterval(() => {
            setDisplay({ count: getActiveQueries(), elapsed: Date.now() - startTimeRef.current, show: true })
          }, 100)
        } else {
          setDisplay(prev => ({ ...prev, count }))
          Animated.timing(progress, { toValue: 0.85, duration: 1500, useNativeDriver: false }).start()
        }
      } else if (visibleRef.current) {
        visibleRef.current = false
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = null

        Animated.parallel([
          Animated.timing(progress, { toValue: 1, duration: 150, useNativeDriver: false }),
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: false }),
        ]).start(() => {
          progress.setValue(0)
          setDisplay({ count: 0, elapsed: 0, show: false })
        })
      }
    })

    return () => { void unsub(); if (timerRef.current) clearInterval(timerRef.current) }
  }, [progress, opacity])

  if (!display.show) return null

  const fmtMs = (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity },
      ]}
    >
      <View style={styles.bar}>
        <View style={styles.textRow}>
          <Text style={styles.label}>
            {display.count} {display.count === 1 ? 'query' : 'queries'} running
          </Text>
          <Text style={styles.time}>{fmtMs(display.elapsed)}</Text>
        </View>
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              { width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }) as any },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 999,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  bar: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(11,13,26,0.9)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,198,36,0.3)',
    padding: spacing.sm,
    boxShadow: `0 4px 8px rgba(255,183,77,0.4)`,
  },
  textRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.small,
    color: colors.accent.amber,
    fontWeight: '600',
  },
  time: {
    ...typography.small,
    color: colors.text.tertiary,
  },
  track: {
    height: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.accent.amber,
  },
})
