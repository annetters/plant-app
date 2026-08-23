import type { BedPoint } from '@plant-app/domain'

/**
 * Turns a rectangle/oval tool's click-drag gesture into a point list, the
 * same coordinate-system-agnostic way `penPath.ts` turns the pen tool's
 * clicks into one — kept as pure functions (not inline in BedEditor's Konva
 * event handlers) so the geometry is unit-testable without a real canvas.
 */

const OVAL_SAMPLE_COUNT = 32

/** The 4 corners of the rectangle spanned by two opposite points, in trace order (closed by the caller). */
export function rectangleToPoints(start: BedPoint, end: BedPoint): BedPoint[] {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ]
}

/** A sampled ellipse, centered between two opposite bounding-box points. */
export function ovalToPoints(start: BedPoint, end: BedPoint): BedPoint[] {
  const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const radiusX = Math.abs(end.x - start.x) / 2
  const radiusY = Math.abs(end.y - start.y) / 2
  const points: BedPoint[] = []
  for (let i = 0; i < OVAL_SAMPLE_COUNT; i++) {
    const angle = (i / OVAL_SAMPLE_COUNT) * Math.PI * 2
    points.push({
      x: center.x + radiusX * Math.cos(angle),
      y: center.y + radiusY * Math.sin(angle),
    })
  }
  return points
}
