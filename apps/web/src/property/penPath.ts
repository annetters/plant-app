/**
 * Flattens a bezier-pen path into a sampled point list, coordinate-system
 * agnostic (works in pixels or feet). Bed storage is always a flat point
 * list (`packages/domain/src/bed.ts`'s `BedPoint[]`) regardless of which
 * tool drew it — this is what turns the pen tool's curve handles into that
 * shape. A pen anchor with no `cpOut` produces a straight edge to the next
 * anchor (the degenerate-cubic points still land exactly on that line, just
 * non-uniformly spaced — harmless for an outline trace).
 */

import type { BedPoint } from '@plant-app/domain'

export interface PenAnchor extends BedPoint {
  /** The outgoing curve handle, set by click+drag. Its mirror image around this anchor is the incoming handle for the *next* segment. */
  cpOut?: BedPoint | null
}

const SAMPLES_PER_SEGMENT = 12

function cubicBezierPoint(p0: BedPoint, p1: BedPoint, p2: BedPoint, p3: BedPoint, t: number): BedPoint {
  const mt = 1 - t
  return {
    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
  }
}

/** A closed pen path needs at least 3 anchors to enclose an area. */
export function flattenClosedPenPath(anchors: readonly PenAnchor[]): BedPoint[] {
  if (anchors.length < 3) return anchors.map((a) => ({ x: a.x, y: a.y }))

  const n = anchors.length
  const points: BedPoint[] = [{ x: anchors[0].x, y: anchors[0].y }]
  for (let i = 0; i < n; i++) {
    const curr = anchors[i]
    const next = anchors[(i + 1) % n]
    const cp1 = curr.cpOut ?? curr
    const cp2 = next.cpOut ? { x: 2 * next.x - next.cpOut.x, y: 2 * next.y - next.cpOut.y } : next
    for (let s = 1; s <= SAMPLES_PER_SEGMENT; s++) {
      const t = s / SAMPLES_PER_SEGMENT
      points.push(cubicBezierPoint(curr, cp1, cp2, next, t))
    }
  }
  // The final segment's last sample lands exactly back on anchors[0].
  points.pop()
  return points
}
