import type { Property } from '@plant-app/domain'
import { STAGE_SIZE_PX, baseMapCalibration } from '@plant-app/domain'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MeasurementGrid, MeasurementGridControl } from './MeasurementGrid'
import { MeasurementGridProvider } from './MeasurementGridContext'

function aerialProperty(overrides: Partial<Property> = {}): Property {
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
    ...overrides,
  }
}

/** A photo Property calibrated at exactly 12 px per ft, so square sizes are easy to reason about. */
function photoProperty(): Property {
  return aerialProperty({
    baseMapSource: 'photo',
    baseMapPhotoPath: 'user-1/property-1/plan.jpg',
    scaleReference: {
      pointA: { x: 0, y: 0 },
      pointB: { x: 300, y: 0 },
      realDistanceFeet: 25,
      mode: 'known-measurement',
    },
  })
}

function renderGrid(property: Property) {
  return render(
    <MeasurementGridProvider calibration={baseMapCalibration(property)}>
      <MeasurementGridControl />
      <MeasurementGrid />
    </MeasurementGridProvider>,
  )
}

describe('MeasurementGrid', () => {
  it('draws nothing until the gardener turns it on', () => {
    renderGrid(photoProperty())
    expect(screen.queryByRole('img', { name: /measurement grid/i })).toBeNull()
  })

  it('draws a grid at the chosen spacing once switched on', async () => {
    renderGrid(photoProperty())
    await userEvent.click(screen.getByLabelText('Show measurement grid'))

    // 12 px per ft, 5 ft squares picked by default -> 60px apart across 768px.
    const grid = screen.getByRole('img', { name: '5 ft measurement grid' })
    const verticals = grid.querySelectorAll('[data-testid="grid-line-vertical"]')
    expect(verticals).toHaveLength(Math.floor(STAGE_SIZE_PX / 60) + 1)
    expect(verticals[1].getAttribute('x1')).toBe('60')
  })

  it('labels the lines in feet, so the squares can be counted against something real', async () => {
    renderGrid(photoProperty())
    await userEvent.click(screen.getByLabelText('Show measurement grid'))
    expect(screen.getAllByText('5 ft').length).toBeGreaterThan(0)
    expect(screen.getAllByText('60 ft').length).toBeGreaterThan(0)
  })

  it('lets the gardener change the spacing to one they know a distance for', async () => {
    renderGrid(photoProperty())
    await userEvent.click(screen.getByLabelText('Show measurement grid'))
    await userEvent.clear(screen.getByLabelText('Grid squares (feet)'))
    await userEvent.type(screen.getByLabelText('Grid squares (feet)'), '25')

    const grid = screen.getByRole('img', { name: '25 ft measurement grid' })
    const verticals = grid.querySelectorAll('[data-testid="grid-line-vertical"]')
    // 25 ft * 12 px per ft = 300px apart.
    expect(verticals).toHaveLength(3)
  })

  /**
   * The check the ticket actually describes is "count squares along
   * something you already know the length of". Known runs are rarely round
   * numbers, so a fixed list of spacings can't perform it.
   */
  it('accepts an off-list distance, like the 37 ft driveway a gardener has measured', async () => {
    renderGrid(photoProperty())
    await userEvent.click(screen.getByLabelText('Show measurement grid'))
    await userEvent.clear(screen.getByLabelText('Grid squares (feet)'))
    await userEvent.type(screen.getByLabelText('Grid squares (feet)'), '37')

    expect(screen.getByRole('img', { name: '37 ft measurement grid' })).toBeInTheDocument()
  })

  it('keeps the last usable spacing while the box is mid-edit, rather than blanking the grid', async () => {
    renderGrid(photoProperty())
    await userEvent.click(screen.getByLabelText('Show measurement grid'))
    await userEvent.clear(screen.getByLabelText('Grid squares (feet)'))

    expect(screen.getByRole('img', { name: '5 ft measurement grid' })).toBeInTheDocument()
  })

  it('offers no grid at all on a Property with no scale to draw one against', () => {
    renderGrid(aerialProperty({ imageryZoom: null, imageryAvailable: false }))
    expect(screen.queryByLabelText('Show measurement grid')).toBeNull()
    expect(screen.queryByRole('img', { name: /measurement grid/i })).toBeNull()
  })

  it('opens on a spacing suited to the scale, rather than the same one everywhere', async () => {
    renderGrid(aerialProperty())
    await userEvent.click(screen.getByLabelText('Show measurement grid'))
    // A zoom-20 aerial map is ~2.7 px per ft, far too coarse for 5 ft squares.
    expect(screen.getByLabelText<HTMLInputElement>('Grid squares (feet)').value).toBe('25')
  })

  it('hides the spacing picker while the grid is off, rather than offering a dead control', () => {
    renderGrid(photoProperty())
    expect(screen.queryByLabelText('Grid squares (feet)')).toBeNull()
  })

  it('draws nothing when there is no provider above it, so a bare map surface is unaffected', () => {
    render(<MeasurementGrid />)
    expect(screen.queryByRole('img', { name: /measurement grid/i })).toBeNull()
  })
})
