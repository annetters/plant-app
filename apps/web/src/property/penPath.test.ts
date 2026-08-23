import { describe, expect, it } from 'vitest'
import { flattenClosedPenPath, type PenAnchor } from './penPath'

describe('flattenClosedPenPath', () => {
  it('traces a straight-edged triangle (no curve handles) as points that all lie on its edges', () => {
    const triangle: PenAnchor[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ]
    const points = flattenClosedPenPath(triangle)
    expect(points.length).toBeGreaterThan(3)
    for (const p of points) {
      // Every point sampled on a straight edge stays within the triangle's bounding box.
      expect(p.x).toBeGreaterThanOrEqual(-0.001)
      expect(p.x).toBeLessThanOrEqual(10.001)
      expect(p.y).toBeGreaterThanOrEqual(-0.001)
      expect(p.y).toBeLessThanOrEqual(10.001)
    }
    // First point is exactly the first anchor.
    expect(points[0]).toEqual({ x: 0, y: 0 })
  })

  it('bulges outward from the straight edge when an outgoing curve handle is set', () => {
    const withHandle: PenAnchor[] = [
      { x: 0, y: 0, cpOut: { x: 5, y: 20 } },
      { x: 10, y: 0 },
      { x: 5, y: -10 },
    ]
    const points = flattenClosedPenPath(withHandle)
    // Somewhere along the curved first edge, y should swing well above the
    // straight line between (0,0) and (10,0) — i.e. above 0.
    const maxYOnFirstEdge = Math.max(...points.slice(0, 12).map((p) => p.y))
    expect(maxYOnFirstEdge).toBeGreaterThan(2)
  })

  it('returns the anchors as-is when there are fewer than 3 (not enough to enclose an area)', () => {
    const open: PenAnchor[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    expect(flattenClosedPenPath(open)).toEqual(open.map((a) => ({ x: a.x, y: a.y })))
  })

  it('closes the loop without duplicating the first point', () => {
    const square: PenAnchor[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    const points = flattenClosedPenPath(square)
    expect(points[0]).toEqual({ x: 0, y: 0 })
    // No point should exactly repeat the first point elsewhere in the list.
    expect(points.slice(1).some((p) => p.x === 0 && p.y === 0)).toBe(false)
  })
})
