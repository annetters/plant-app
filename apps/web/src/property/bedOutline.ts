import type { BedPoint, BedTool } from '@plant-app/domain'
import { feetToPixels, renderedOutlinePoints } from '@plant-app/domain'
import Konva from 'konva'

/**
 * Builds the Konva outline for a Bed (or an in-progress draft) — see
 * `renderedOutlinePoints` (`@plant-app/domain`), which decides which points
 * represent the Bed right now. Points already come out dense enough that
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
