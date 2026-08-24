import type { BedPoint, BedTool } from '@plant-app/domain'
import { feetToPixels, smoothBedOutline } from '@plant-app/domain'
import Konva from 'konva'

/**
 * A Bed's outline as it's actually rendered — raw points as-is for
 * rectangle/oval/pen, smoothed for freehand (ADR-0001: smoothing is
 * computed at render time, never stored). Shared by `buildOutlineLine`
 * (Konva rendering) and `PlantingMap`'s Pin-drop containment test, so a
 * dragged Pin resolves against the same shape that's actually drawn on
 * screen — a single source of truth for "which points represent this Bed
 * right now," so the two callers can't drift apart.
 */
export function renderedOutlinePoints(
  points: readonly BedPoint[],
  tool: BedTool,
  smoothingEnabled: boolean,
): BedPoint[] {
  return tool === 'freehand' ? smoothBedOutline(points, smoothingEnabled) : [...points]
}

/**
 * Builds the Konva outline for a Bed (or an in-progress draft) — see
 * `renderedOutlinePoints`. Points already come out dense enough that
 * Konva's own curve interpolation (`tension`) would only double-smooth on
 * top of it, so this never sets one.
 */
export function buildOutlineLine(
  points: readonly BedPoint[],
  tool: BedTool,
  smoothingEnabled: boolean,
  pixelsPerFootValue: number,
  style: { stroke: string; fill: string; strokeWidth: number; dash?: number[] },
): Konva.Line {
  const px = feetToPixels(renderedOutlinePoints(points, tool, smoothingEnabled), pixelsPerFootValue)
  return new Konva.Line({
    points: px.flatMap((p) => [p.x, p.y]),
    closed: true,
    ...style,
  })
}
