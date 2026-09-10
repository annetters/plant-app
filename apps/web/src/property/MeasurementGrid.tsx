import type { GridLine } from '@plant-app/domain'
import { GRID_SPACING_CHOICES_FEET, STAGE_SIZE_PX, measurementGrid } from '@plant-app/domain'
import { useState } from 'react'
import { useOptionalMeasurementGrid } from './MeasurementGridContext'

/**
 * The same red the Scale Reference tool marks its two points in — this grid
 * is the same idea made continuous, and it has to stay legible over both
 * dark aerial imagery and a white plot plan, which rules out plain white or
 * plain black.
 */
const GRID_COLOR = '#e63946'

/** The overlay is a reference, never a target — clicks belong to the drawing surface underneath. */
const OVERLAY_STYLE = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
} as const

/** Below this the squares stop being countable and the grid becomes hatching over the imagery. */
const MIN_SPACING_FEET = 0.5

type Axis = 'vertical' | 'horizontal'

/**
 * One line and its label. The two axes differ only in which coordinate the
 * offset lands on, so they share this rather than being written out twice
 * each for the lines and again for the labels.
 */
function GridAxisLine({ axis, line }: { axis: Axis; line: GridLine }) {
  const vertical = axis === 'vertical'
  return (
    <>
      <line
        data-testid={`grid-line-${axis}`}
        x1={vertical ? line.offsetPx : 0}
        y1={vertical ? 0 : line.offsetPx}
        x2={vertical ? line.offsetPx : STAGE_SIZE_PX}
        y2={vertical ? STAGE_SIZE_PX : line.offsetPx}
        stroke={GRID_COLOR}
        strokeWidth={1}
        opacity={0.55}
      />
      {/* Labelled along the two leading edges only. Every intersection
          labelled would bury the imagery the grid exists to be checked
          against, and the origin is skipped because "0 ft" measures nothing. */}
      {line.offsetFeet > 0 && (
        <text
          x={vertical ? line.offsetPx + 3 : 3}
          y={vertical ? 13 : line.offsetPx - 3}
          fontSize={11}
          fill={GRID_COLOR}
          stroke="white"
          strokeWidth={3}
          paintOrder="stroke"
        >
          {line.offsetFeet} ft
        </text>
      )}
    </>
  )
}

/**
 * Ticket #28's calibration check, drawn rather than stated: squares of a
 * known real-world size laid over the base map. A gardener who knows one
 * distance on their own property can count squares along it and see whether
 * the app agrees — which is what a bare "2.75 px per ft" can never tell
 * them, and what would have caught #6's 1.5x-off calibration on sight.
 *
 * Sits between `BaseMapBackground` and the Konva stage at every call site,
 * so it reads over the imagery without covering the Beds and Pins drawn on
 * top of it.
 */
export function MeasurementGrid() {
  const grid = useOptionalMeasurementGrid()
  if (!grid?.enabled || !grid.calibration?.calibrated) return null

  const { spacingFeet, lines } = measurementGrid(
    grid.calibration.pixelsPerFoot,
    grid.spacingFeet,
    STAGE_SIZE_PX,
  )
  if (lines.length === 0) return null

  return (
    <svg
      role="img"
      aria-label={`${spacingFeet} ft measurement grid`}
      viewBox={`0 0 ${STAGE_SIZE_PX} ${STAGE_SIZE_PX}`}
      style={OVERLAY_STYLE}
    >
      {lines.map((line) => (
        <GridAxisLine key={`v-${line.offsetFeet}`} axis="vertical" line={line} />
      ))}
      {lines.map((line) => (
        <GridAxisLine key={`h-${line.offsetFeet}`} axis="horizontal" line={line} />
      ))}
    </svg>
  )
}

/**
 * The grid's on/off switch and square size, rendered once per page above the
 * map surfaces it controls. Renders nothing on an uncalibrated Property:
 * there is no scale to draw squares against, and offering the control there
 * would suggest otherwise.
 */
export function MeasurementGridControl() {
  const grid = useOptionalMeasurementGrid()
  // The box's raw text, held separately from the spacing actually in force —
  // the same arrangement `BaseMapSetup` uses for its distance field. A
  // controlled number input that rejected anything unusable would snap back
  // to the old value the instant the box was cleared, so typing "37" over a
  // "5" produced "537". Empty and half-typed states live here; the grid
  // below keeps drawing at the last usable value.
  const [draft, setDraft] = useState(() => String(grid?.spacingFeet ?? ''))
  if (!grid?.calibration?.calibrated) return null

  return (
    <div className="measurement-grid-control">
      <label htmlFor="measurement-grid-enabled">Show measurement grid</label>
      <input
        id="measurement-grid-enabled"
        type="checkbox"
        checked={grid.enabled}
        onChange={(event) => grid.setEnabled(event.target.checked)}
      />

      {grid.enabled && (
        <>
          {/* A free number rather than a fixed list, with the round values
              offered as suggestions. The check this grid exists for is
              "count squares along something you already know the length
              of", and a gardener's known run is a 37 ft driveway as often
              as it is a tidy 25. */}
          <label htmlFor="measurement-grid-spacing">Grid squares (feet)</label>
          <input
            id="measurement-grid-spacing"
            type="number"
            min={MIN_SPACING_FEET}
            step="any"
            list="measurement-grid-spacings"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              const next = Number(event.target.value)
              // A cleared or nonsensical box leaves the grid where it was
              // rather than blanking it mid-edit.
              if (event.target.value !== '' && next >= MIN_SPACING_FEET) {
                grid.setSpacingFeet(next)
              }
            }}
          />
          <datalist id="measurement-grid-spacings">
            {GRID_SPACING_CHOICES_FEET.map((spacing) => (
              <option key={spacing} value={spacing} />
            ))}
          </datalist>
        </>
      )}
    </div>
  )
}
