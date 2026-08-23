import { describe, expect, it } from 'vitest'
import { ovalToPoints, rectangleToPoints } from './dragShapeGeometry'

describe('rectangleToPoints', () => {
  it('returns the 4 corners for a drag from top-left to bottom-right', () => {
    expect(rectangleToPoints({ x: 10, y: 20 }, { x: 110, y: 70 })).toEqual([
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 70 },
      { x: 10, y: 70 },
    ])
  })

  it('normalizes a drag from bottom-right to top-left to the same rectangle', () => {
    expect(rectangleToPoints({ x: 110, y: 70 }, { x: 10, y: 20 })).toEqual([
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 70 },
      { x: 10, y: 70 },
    ])
  })
})

describe('ovalToPoints', () => {
  it('samples an ellipse centered on the bounding box midpoint', () => {
    const points = ovalToPoints({ x: 0, y: 0 }, { x: 100, y: 50 })
    expect(points).toHaveLength(32)
    // Rightmost sample (angle 0) sits at center.x + radiusX.
    expect(points[0].x).toBeCloseTo(50 + 50, 6)
    expect(points[0].y).toBeCloseTo(25, 6)
  })

  it('produces the same ellipse regardless of which corner the drag started from', () => {
    const forward = ovalToPoints({ x: 0, y: 0 }, { x: 100, y: 50 })
    const backward = ovalToPoints({ x: 100, y: 50 }, { x: 0, y: 0 })
    expect(backward).toEqual(forward)
  })
})
