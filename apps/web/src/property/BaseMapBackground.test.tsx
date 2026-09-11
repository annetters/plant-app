import type { Property } from '@plant-app/domain'
import { GRID_RADIUS } from '@plant-app/domain'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BaseMapBackground } from './BaseMapBackground'

function aerialProperty(): Property {
  return {
    id: 'property-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    address: '1 Garden Way',
    resolvedAddress: '1 Garden Way, Somewhere',
    latitude: 42,
    longitude: -71,
    imageryZoom: 20,
    imageryAvailable: true,
    baseMapSource: 'aerial',
    baseMapPhotoPath: null,
    baseMapDrawing: null,
    scaleReference: null,
    name: null,
  }
}

describe('BaseMapBackground', () => {
  /**
   * Rows have to be as explicit as columns. Left implicit they size to the
   * tiles' intrinsic 256px, so on any container narrower than the full stage
   * — the `PropertyPage` preview is the one such surface — the tile grid
   * kept its full 768px height while the columns shrank, squashing every
   * tile and pushing the bottom row off the edge. Cosmetic until #28 laid a
   * `viewBox`'d measurement grid over the same imagery, at which point a
   * mis-sized tile grid means the squares no longer align with the ground.
   */
  it('sizes the tile grid in both directions, so it scales with a container smaller than the stage', () => {
    const { container } = render(<BaseMapBackground property={aerialProperty()} />)
    const grid = container.firstElementChild as HTMLElement

    const tracks = `repeat(${GRID_RADIUS * 2 + 1}, 1fr)`
    expect(grid.style.gridTemplateColumns).toBe(tracks)
    expect(grid.style.gridTemplateRows).toBe(tracks)
  })

  it('renders one tile per cell of the grid it declares', () => {
    render(<BaseMapBackground property={aerialProperty()} />)
    const cells = (GRID_RADIUS * 2 + 1) ** 2
    expect(screen.getAllByRole('presentation', { hidden: true })).toHaveLength(cells)
  })
})
