import type { Bed, BloomTimelineBar, Plant, Planting } from '@plant-app/domain'
import {
  MONTH_NAMES,
  buildBloomTimelineBars,
  dayOfYear,
  filterBloomTimelineBarsByMonth,
  formatMonthDay,
} from '@plant-app/domain'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlantsRepository } from '../plants/PlantsRepositoryContext'
import { usePlantingsRepository } from '../plantings/PlantingsRepositoryContext'
import { useBedsRepository } from '../property/BedsRepositoryContext'
import { usePropertiesRepository } from '../property/PropertiesRepositoryContext'

// Matches dayOfYear's own leap-safe cumulative table (Dec 31 -> 366) — the
// denominator a bar's day-of-year position is a fraction of.
const DAYS_IN_YEAR = 366

// Every month's start, as the same left% a bar's own start/end use — one
// fixed set of positions, computed once rather than per row, since it
// doesn't depend on any particular bar. Drives the tick marks each
// bloom-bar-track draws behind its bar, so a viewer can count month-blocks
// directly against the bar itself, not just against the axis above it.
const MONTH_START_PERCENTAGES = MONTH_NAMES.map(
  (_, index) => ((dayOfYear({ month: index + 1, day: 1 }) - 1) / DAYS_IN_YEAR) * 100,
)

type BloomTimelineView = 'chart' | 'list'

/**
 * The year-view chart's horizontal track for one bar. A wrapping bloom
 * window (e.g. Nov 15 -> Feb 15) is drawn as two segments — one running to
 * the year's end, one resuming at its start — rather than one bar that
 * would otherwise run backwards across the track. Month tick marks render
 * first so the bar (added after, in DOM order) paints over them where they
 * overlap, rather than the ticks showing through the bar's fill.
 */
function BarTrack({ bar }: { bar: BloomTimelineBar }) {
  const startPct = ((dayOfYear(bar.bloomWindow.start) - 1) / DAYS_IN_YEAR) * 100
  const endPct = (dayOfYear(bar.bloomWindow.end) / DAYS_IN_YEAR) * 100
  const wraps = endPct < startPct
  const title = `${formatMonthDay(bar.bloomWindow.start)} – ${formatMonthDay(bar.bloomWindow.end)}`

  return (
    <div className="bloom-bar-track" title={title}>
      {MONTH_START_PERCENTAGES.map((pct, index) => (
        <div key={index} className="bloom-month-tick" style={{ left: `${pct}%` }} />
      ))}
      {wraps ? (
        <>
          <div className="bloom-bar" style={{ left: `${startPct}%`, width: `${100 - startPct}%` }} />
          <div className="bloom-bar" style={{ left: 0, width: `${endPct}%` }} />
        </>
      ) : (
        <div className="bloom-bar" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} />
      )}
    </div>
  )
}

/**
 * A month-label ruler above the chart, aligned to the same 160px-label /
 * 1fr-track grid the bars below it use (`main ol.bloom-timeline-chart li`
 * in index.css) — so a bar's position can be read directly off the axis
 * instead of only via hover. Reuses `BarTrack`'s own day-of-year formula
 * for each month's start, rather than a second positioning scheme.
 */
function MonthAxis() {
  return (
    <div className="bloom-timeline-axis">
      <div className="bloom-timeline-axis-spacer" />
      <div className="bloom-timeline-axis-track">
        {MONTH_NAMES.map((name, index) => {
          const pct = ((dayOfYear({ month: index + 1, day: 1 }) - 1) / DAYS_IN_YEAR) * 100
          return (
            <span key={name} style={{ left: `${pct}%` }}>
              {name.slice(0, 3)}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Bloom Timeline (#9): a year-view bar chart of Plant bloom windows and a
 * month-filtered list view of the same underlying data (CONTEXT.md — "no
 * separate data model"), both filterable by Bed. `buildBloomTimelineBars`
 * does the actual filtering; this page only fetches the Plants/Beds/
 * Plantings it needs and renders whichever view is selected.
 */
export function BloomTimelinePage() {
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
  // with none yet, the page still shows every blooming Plant, unfiltered.
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
    if (beds.length === 0) return
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
    () => buildBloomTimelineBars(plants ?? [], beds.length === 0 ? [] : plantings, selectedBedId || undefined),
    [plants, plantings, beds.length, selectedBedId],
  )

  const monthFilteredBars = useMemo(
    () => (selectedMonth === '' ? bars : filterBloomTimelineBarsByMonth(bars, Number(selectedMonth))),
    [bars, selectedMonth],
  )

  return (
    <main className="bloom-timeline-page">
      <header>
        <h1>Bloom Timeline</h1>
      </header>

      {error && <p role="alert">{error}</p>}

      <div role="group" aria-label="View">
        <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')}>
          Chart view
        </button>
        <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
          List view
        </button>
      </div>

      {beds.length > 0 && (
        <div>
          <label htmlFor="bloom-timeline-bed">Bed</label>
          <select
            id="bloom-timeline-bed"
            value={selectedBedId}
            onChange={(event) => setSelectedBedId(event.target.value)}
          >
            {/* "Bed" is a filter — its unselected state should read as "nothing
                picked," not as "All Beds" (which sounds like the union of every
                Bed's Plants, when it actually means unfiltered: every blooming
                Plant in the Registry, planted or not — see #9 QA follow-up). */}
            <option value="">None selected</option>
            {beds.map((bed) => (
              <option key={bed.id} value={bed.id}>
                {bed.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {beds.length === 0 && plants !== null && (
        <p>
          No Beds yet — <Link to="/map">draw one on the Map</Link> to filter by Bed.
        </p>
      )}

      {plants === null && !error && <p>Loading…</p>}

      {plants !== null && bars.length === 0 && (
        <p>No bloom windows to show yet — add a bloom window to a Plant in the Registry.</p>
      )}

      {bars.length > 0 && view === 'chart' && (
        <>
          <MonthAxis />
          <ol className="bloom-timeline-chart" aria-label="Year view">
            {bars.map((bar) => (
              <li key={bar.plantId}>
                <span>
                  {bar.commonName}
                  {bar.cultivar && ` (${bar.cultivar})`}
                </span>
                <BarTrack bar={bar} />
              </li>
            ))}
          </ol>
        </>
      )}

      {bars.length > 0 && view === 'list' && (
        <div>
          <label htmlFor="bloom-timeline-month">Month</label>
          <select
            id="bloom-timeline-month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
          >
            <option value="">All months</option>
            {MONTH_NAMES.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>

          <ul aria-label="Blooming this month">
            {monthFilteredBars.map((bar) => (
              <li key={bar.plantId}>
                {bar.commonName}
                {bar.cultivar && ` (${bar.cultivar})`} — {formatMonthDay(bar.bloomWindow.start)} to{' '}
                {formatMonthDay(bar.bloomWindow.end)}
              </li>
            ))}
          </ul>
          {monthFilteredBars.length === 0 && <p>Nothing blooms this month.</p>}
        </div>
      )}

      <Link to="/dashboard">Back to Dashboard</Link>
    </main>
  )
}
