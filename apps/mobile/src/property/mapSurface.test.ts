import { STAGE_SIZE_PX } from '@plant-app/domain'
import { draggedStagePoint, mapDisplayScale } from './mapSurface'

describe('mapDisplayScale', () => {
  it('shrinks the surface to fit a phone screen narrower than it', () => {
    expect(mapDisplayScale(STAGE_SIZE_PX / 2)).toBe(0.5)
  })

  it('never enlarges past the surface’s own size, so a tablet shows it 1:1 rather than upscaled', () => {
    expect(mapDisplayScale(STAGE_SIZE_PX * 3)).toBe(1)
  })

  it('stays positive when the layout reports no width yet, so nothing divides by zero mid-render', () => {
    expect(mapDisplayScale(0)).toBeGreaterThan(0)
    expect(mapDisplayScale(-100)).toBeGreaterThan(0)
  })
})

describe('draggedStagePoint', () => {
  const start = { x: 100, y: 100 }

  it('converts a finger’s screen-space movement back into the surface’s own pixels', () => {
    // Half-size display: dragging 20 screen px moves the Pin 40 surface px,
    // so it stays under the finger.
    expect(draggedStagePoint(start, 20, -10, 0.5)).toEqual({ x: 140, y: 80 })
  });

  it('moves one-for-one when the surface is shown at full size', () => {
    expect(draggedStagePoint(start, 20, -10, 1)).toEqual({ x: 120, y: 90 })
  })

  it('measures from where the drag began, not from wherever the Pin last was', () => {
    const afterFirstDrag = draggedStagePoint(start, 20, 0, 1)

    expect(draggedStagePoint(start, 40, 0, 1)).toEqual({ x: 140, y: 100 })
    expect(afterFirstDrag).toEqual({ x: 120, y: 100 })
  })

  it('keeps the Pin on the map, however far past the edge the finger goes', () => {
    expect(draggedStagePoint(start, -9999, -9999, 1)).toEqual({ x: 0, y: 0 })
    expect(draggedStagePoint(start, 9999, 9999, 1)).toEqual({
      x: STAGE_SIZE_PX,
      y: STAGE_SIZE_PX,
    })
  })
})
