import type { Bed, BloomTimelineBar, Plant, Planting } from '@plant-app/domain'
import {
  MONTH_NAMES,
  bloomWindowWraps,
  buildBloomTimelineBars,
  dayOfYear,
  filterBloomTimelineBarsByMonth,
  formatMonthDay,
} from '@plant-app/domain'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChipRow } from '../components/ChipRow'
import type { MainStackParamList } from '../navigation/types'
import { usePlantsRepository } from '../plants/PlantsRepositoryContext'
import { usePlantingsRepository } from '../plantings/PlantingsRepositoryContext'
import { useBedsRepository } from '../property/BedsRepositoryContext'
import { usePropertiesRepository } from '../property/PropertiesRepositoryContext'

// Matches dayOfYear's own leap-safe cumulative table (Dec 31 -> 366) — the
// denominator a bar's day-of-year position is a fraction of.
const DAYS_IN_YEAR = 366

// Fixed pixel content width for the horizontal-scrolling chart — unlike
// web's CSS-percentage layout (which fills 100% and never scrolls), a
// ScrollView needs content wider than the viewport to have anything to
// scroll. Chosen wide enough that a phone screen only ever shows a few
// months at a time.
const CHART_WIDTH = 1800
const LABEL_WIDTH = 140
const ROW_HEIGHT = 32
const AXIS_HEIGHT = 24

const MONTH_OPTIONS = MONTH_NAMES.map((_, index) => String(index + 1))

// Every month's start, as the same pixel offset a bar's own start/end use —
// computed once rather than per row. Drives tick marks each bar's own track
// draws behind itself (matching web's `.bloom-month-tick`), so a bar's
// position can be read directly off its own row, not just the axis above —
// and so an empty stretch of track still shows *something*, rather than a
// bare background indistinguishable from a rendering failure.
const MONTH_START_OFFSETS = MONTH_NAMES.map((_, index) => dayOfYear({ month: index + 1, day: 1 }) - 1)

type BloomTimelineView = 'chart' | 'list'

function dayOffsetPx(dayOfYearValue: number): number {
  return (dayOfYearValue / DAYS_IN_YEAR) * CHART_WIDTH
}

/** The year-view chart's horizontal track for one bar, positioned in pixels against CHART_WIDTH. A wrapping bloom window (e.g. Nov 15 -> Feb 15) draws as two segments rather than one bar running backwards. The track itself has a visible rail (background + border, matching web's `.bloom-bar-track`) so the timeline reads as a timeline even where no bar is drawn. */
function BarTrack({ bar }: { bar: BloomTimelineBar }) {
  const startPx = dayOffsetPx(dayOfYear(bar.bloomWindow.start) - 1)
  const endPx = dayOffsetPx(dayOfYear(bar.bloomWindow.end))
  const wraps = bloomWindowWraps(bar.bloomWindow)
  const label = `Blooms ${formatMonthDay(bar.bloomWindow.start)} – ${formatMonthDay(bar.bloomWindow.end)}`

  return (
    <View style={styles.trackRow}>
      <View style={styles.rail} accessible accessibilityLabel={label}>
        {MONTH_START_OFFSETS.map((offset, index) => (
          <View key={index} testID="bloom-month-tick" style={[styles.monthTick, { left: dayOffsetPx(offset) }]} />
        ))}
        {wraps ? (
          <>
            <View
              testID="bloom-bar-segment"
              style={[styles.barSegment, { left: startPx, width: CHART_WIDTH - startPx }]}
            />
            <View testID="bloom-bar-segment" style={[styles.barSegment, { left: 0, width: endPx }]} />
          </>
        ) : (
          <View testID="bloom-bar-segment" style={[styles.barSegment, { left: startPx, width: endPx - startPx }]} />
        )}
      </View>
    </View>
  )
}

/** A month-label ruler above the chart, sharing the bars' horizontal scroll offset (both live inside the same ScrollView) so a bar's position can be read directly off the axis. */
function MonthAxisTrack() {
  return (
    <View style={styles.axisTrack}>
      {MONTH_NAMES.map((name, index) => {
        const left = dayOffsetPx(dayOfYear({ month: index + 1, day: 1 }) - 1)
        return (
          <Text key={name} style={[styles.axisLabel, { left }]}>
            {name.slice(0, 3)}
          </Text>
        )
      })}
    </View>
  )
}

/**
 * Native counterpart of web's BloomTimelinePage (#9, ported for #17): a
 * year-view bar chart of Plant bloom windows and a month-filtered list view
 * of the same underlying data, both filterable by Bed.
 * `buildBloomTimelineBars`/`filterBloomTimelineBarsByMonth` do the actual
 * filtering (packages/domain); this screen only fetches the Plants/Beds/
 * Plantings it needs and renders whichever view is selected.
 */
export function BloomTimelineScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const plantsRepository = usePlantsRepository()
  const propertiesRepository = usePropertiesRepository()
  const bedsRepository = useBedsRepository()
  const plantingsRepository = usePlantingsRepository()

  const [plants, setPlants] = useState<Plant[] | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [plantings, setPlantings] = useState<Planting[]>([])
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<BloomTimelineView>('chart')
  const [selectedBedId, setSelectedBedId] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')

  useEffect(() => {
    let cancelled = false
    plantsRepository
      .list()
      .then((result) => {
        if (!cancelled) setPlants(result)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your Plants.')
      })
    return () => {
      cancelled = true
    }
  }, [plantsRepository])

  // A Bed filter is only meaningful once a Property (and its Beds) exist —
  // with none yet, the screen still shows every blooming Plant, unfiltered.
  useEffect(() => {
    let cancelled = false
    propertiesRepository
      .get()
      .then((property) => {
        if (cancelled || !property) return undefined
        return bedsRepository
          .list(property.id)
          .then((result) => {
            if (!cancelled) setBeds(result)
          })
          .catch(() => {
            if (!cancelled) setError("Could not load this Property's Beds.")
          })
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your Property.')
      })
    return () => {
      cancelled = true
    }
  }, [propertiesRepository, bedsRepository])

  useEffect(() => {
    if (beds.length === 0) {
      setPlantings([])
      return
    }
    let cancelled = false
    plantingsRepository
      .listByBeds(beds.map((bed) => bed.id))
      .then((result) => {
        if (!cancelled) setPlantings(result)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your Plantings.')
      })
    return () => {
      cancelled = true
    }
  }, [beds, plantingsRepository])

  const bars = useMemo(
    () => buildBloomTimelineBars(plants ?? [], plantings, selectedBedId || undefined),
    [plants, plantings, selectedBedId],
  )

  const monthFilteredBars = useMemo(
    () => (selectedMonth === '' ? bars : filterBloomTimelineBarsByMonth(bars, Number(selectedMonth))),
    [bars, selectedMonth],
  )

  const bedOptions = useMemo(() => beds.map((bed) => bed.id), [beds])
  const bedNamesById = useMemo(() => new Map(beds.map((bed) => [bed.id, bed.name])), [beds])

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Bloom Timeline</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>Back to Dashboard</Text>
          </Pressable>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        {plants === null && !error && <Text>Loading…</Text>}

        {plants && (
          <>
            <View style={styles.viewToggle}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: view === 'chart' }}
                style={[styles.toggleButton, view === 'chart' && styles.toggleButtonSelected]}
                onPress={() => setView('chart')}
              >
                <Text style={view === 'chart' ? styles.toggleTextSelected : styles.toggleText}>Chart view</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: view === 'list' }}
                style={[styles.toggleButton, view === 'list' && styles.toggleButtonSelected]}
                onPress={() => setView('list')}
              >
                <Text style={view === 'list' ? styles.toggleTextSelected : styles.toggleText}>List view</Text>
              </Pressable>
            </View>

            {beds.length > 0 && (
              <ChipRow
                label="Bed"
                options={bedOptions}
                selected={selectedBedId}
                onSelect={setSelectedBedId}
                formatChip={(id) => bedNamesById.get(id) ?? id}
              />
            )}

            {beds.length === 0 && !error && (
              <Text style={styles.hint}>
                No Beds yet — draw one on the Map once that screen is available to filter by Bed.
              </Text>
            )}

            {bars.length === 0 && (
              <Text>No bloom windows to show yet — add a bloom window to a Plant in the Registry.</Text>
            )}

            {bars.length > 0 && view === 'chart' && (
              <View style={styles.chartRow}>
                <View style={{ width: LABEL_WIDTH }}>
                  <View style={{ height: AXIS_HEIGHT }} />
                  {bars.map((bar) => (
                    <Text key={bar.plantId} style={styles.rowLabel} numberOfLines={1}>
                      {bar.commonName}
                      {bar.cultivar && ` (${bar.cultivar})`}
                    </Text>
                  ))}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ width: CHART_WIDTH }}>
                    <MonthAxisTrack />
                    {bars.map((bar) => (
                      <BarTrack key={bar.plantId} bar={bar} />
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {bars.length > 0 && view === 'list' && (
              <View>
                <ChipRow
                  label="Month"
                  options={MONTH_OPTIONS}
                  selected={selectedMonth}
                  onSelect={setSelectedMonth}
                  formatChip={(value) => MONTH_NAMES[Number(value) - 1]}
                />

                <View accessible accessibilityLabel="Blooming this month" style={styles.list}>
                  {monthFilteredBars.map((bar) => (
                    <Text key={bar.plantId} style={styles.listItem}>
                      {bar.commonName}
                      {bar.cultivar && ` (${bar.cultivar})`} — {formatMonthDay(bar.bloomWindow.start)} to{' '}
                      {formatMonthDay(bar.bloomWindow.end)}
                    </Text>
                  ))}
                </View>
                {monthFilteredBars.length === 0 && <Text>Nothing blooms this month.</Text>}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  backLink: {
    color: '#2e7d32',
  },
  error: {
    color: '#b00020',
  },
  hint: {
    color: '#666',
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  toggleButtonSelected: {
    borderColor: '#2e7d32',
    backgroundColor: '#e8f5e9',
  },
  toggleText: {
    color: '#333',
  },
  toggleTextSelected: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  chartRow: {
    flexDirection: 'row',
  },
  rowLabel: {
    height: ROW_HEIGHT,
    textAlignVertical: 'center',
  },
  axisTrack: {
    height: AXIS_HEIGHT,
  },
  axisLabel: {
    position: 'absolute',
    top: 0,
    color: '#666',
    fontSize: 12,
  },
  trackRow: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
  },
  rail: {
    height: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    backgroundColor: '#f4f3ec',
    overflow: 'hidden',
  },
  monthTick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#ddd',
  },
  barSegment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 4,
    backgroundColor: '#2e7d32',
  },
  list: {
    gap: 4,
    marginTop: 8,
  },
  listItem: {
    fontSize: 14,
  },
})
