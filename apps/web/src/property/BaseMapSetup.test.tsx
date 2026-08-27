import type { PropertyRow } from '@plant-app/domain'
import { propertyFromRow } from '@plant-app/domain'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createFakePropertiesDbClient } from '../test/fakePropertiesDbClient'
import { BaseMapSetup } from './BaseMapSetup'
import { PropertiesRepositoryProvider } from './PropertiesRepositoryContext'

const DEGRADED_ROW: PropertyRow = {
  id: 'property-1',
  address: '10 Main St, Cambridge, MA',
  resolved_address: null,
  latitude: 42.3782,
  longitude: -71.1266,
  imagery_zoom: null,
  imagery_available: false,
  base_map_source: 'aerial',
  base_map_photo_path: null,
  base_map_drawing: null,
  scale_reference: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

function renderSetup(onUpdated = vi.fn()) {
  const property = propertyFromRow(DEGRADED_ROW)
  const fake = createFakePropertiesDbClient(DEGRADED_ROW)
  render(
    <PropertiesRepositoryProvider client={fake.client}>
      <BaseMapSetup property={property} onUpdated={onUpdated} />
    </PropertiesRepositoryProvider>,
  )
  return { fake, onUpdated }
}

/** Clicks a specific pixel position on a fixed-size drawing/calibration surface — jsdom's zeroed getBoundingClientRect means clientX/Y map directly to the surface's own coordinate space. */
function clickAt(testId: string, x: number, y: number) {
  fireEvent.click(screen.getByTestId(testId), { clientX: x, clientY: y })
}

describe('BaseMapSetup — photo source', () => {
  it('uploads a photo, calibrates it, and saves the base map in one update', async () => {
    const { fake, onUpdated } = renderSetup()

    await userEvent.click(screen.getByRole('button', { name: 'Upload a plot plan photo' }))
    const file = new File(['fake'], 'plan.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Plot plan or survey photo'), file)

    expect(await screen.findByAltText('Uploaded plot plan or survey')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Continue to Scale Reference' }))

    clickAt('scale-reference-surface', 100, 50)
    clickAt('scale-reference-surface', 400, 50)
    await userEvent.type(screen.getByLabelText('Real-world distance (feet)'), '25')
    await userEvent.click(screen.getByRole('button', { name: 'Save Scale Reference' }))

    expect(await screen.findByRole('button', { name: 'Save Scale Reference' })).toBeInTheDocument()
    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        baseMapSource: 'photo',
        baseMapPhotoPath: expect.stringMatching(/^user-1\/property-1\//),
        scaleReference: {
          pointA: { x: 100, y: 50 },
          pointB: { x: 400, y: 50 },
          realDistanceFeet: 25,
          mode: 'known-measurement',
        },
      }),
    )
    expect(fake.storage.upload).toHaveBeenCalled()
  })

  it('rejects saving before two points are picked', async () => {
    renderSetup()
    await userEvent.click(screen.getByRole('button', { name: 'Upload a plot plan photo' }))
    const file = new File(['fake'], 'plan.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Plot plan or survey photo'), file)
    await screen.findByAltText('Uploaded plot plan or survey')
    await userEvent.click(screen.getByRole('button', { name: 'Continue to Scale Reference' }))

    await userEvent.type(screen.getByLabelText('Real-world distance (feet)'), '25')
    await userEvent.click(screen.getByRole('button', { name: 'Save Scale Reference' }))

    expect(
      await screen.findByText('Click two points on the base map to calibrate its scale.'),
    ).toBeInTheDocument()
  })

  it('rejects a zero real-world distance via the shared domain validation', async () => {
    renderSetup()
    await userEvent.click(screen.getByRole('button', { name: 'Upload a plot plan photo' }))
    const file = new File(['fake'], 'plan.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Plot plan or survey photo'), file)
    await screen.findByAltText('Uploaded plot plan or survey')
    await userEvent.click(screen.getByRole('button', { name: 'Continue to Scale Reference' }))

    clickAt('scale-reference-surface', 100, 50)
    clickAt('scale-reference-surface', 400, 50)
    await userEvent.click(screen.getByRole('button', { name: 'Save Scale Reference' }))

    expect(
      await screen.findByText('Enter a real-world distance greater than 0.'),
    ).toBeInTheDocument()
  })
})

describe('BaseMapSetup — drawn source', () => {
  it('draws a base plan with multiple lines, calibrates it, and saves', async () => {
    const { onUpdated } = renderSetup()

    await userEvent.click(screen.getByRole('button', { name: 'Draw a base plan' }))

    clickAt('base-map-drawing-surface', 0, 0)
    clickAt('base-map-drawing-surface', 100, 0)
    clickAt('base-map-drawing-surface', 100, 100)
    await userEvent.click(screen.getByRole('button', { name: 'Finish this line' }))

    clickAt('base-map-drawing-surface', 200, 200)
    clickAt('base-map-drawing-surface', 250, 200)
    await userEvent.click(screen.getByRole('button', { name: 'Finish this line' }))

    await userEvent.click(screen.getByRole('button', { name: 'Done drawing' }))

    clickAt('scale-reference-surface', 0, 0)
    clickAt('scale-reference-surface', 100, 0)
    await userEvent.type(screen.getByLabelText('Real-world distance (feet)'), '10')
    await userEvent.click(screen.getByRole('radio', { name: 'Measured object (a fence or wall you tape-measured yourself)' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save Scale Reference' }))

    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        baseMapSource: 'drawn',
        baseMapDrawing: [
          [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
          [{ x: 200, y: 200 }, { x: 250, y: 200 }],
        ],
        scaleReference: {
          pointA: { x: 0, y: 0 },
          pointB: { x: 100, y: 0 },
          realDistanceFeet: 10,
          mode: 'measured-object',
        },
      }),
    )
  })

  it('requires at least one finished line before continuing to calibration', async () => {
    renderSetup()
    await userEvent.click(screen.getByRole('button', { name: 'Draw a base plan' }))

    await userEvent.click(screen.getByRole('button', { name: 'Done drawing' }))

    expect(
      await screen.findByText(/Draw at least one line/),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('scale-reference-surface')).not.toBeInTheDocument()
  })

  it('disables "Finish this line" until at least two points are placed', async () => {
    renderSetup()
    await userEvent.click(screen.getByRole('button', { name: 'Draw a base plan' }))

    expect(screen.getByRole('button', { name: 'Finish this line' })).toBeDisabled()
    clickAt('base-map-drawing-surface', 0, 0)
    expect(screen.getByRole('button', { name: 'Finish this line' })).toBeDisabled()
    clickAt('base-map-drawing-surface', 10, 10)
    expect(screen.getByRole('button', { name: 'Finish this line' })).not.toBeDisabled()
  })
})
