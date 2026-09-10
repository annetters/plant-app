import type { PropertyRow } from '@plant-app/domain'
import { propertyFromRow } from '@plant-app/domain'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DESKTOP_ONLY } from '../desktopOnly'
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
  name: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

const CALIBRATED_PHOTO_ROW: PropertyRow = {
  ...DEGRADED_ROW,
  address: null,
  name: 'Backyard plot',
  latitude: null,
  longitude: null,
  base_map_source: 'photo',
  base_map_photo_path: 'user-1/property-1/plan.jpg',
  scale_reference: {
    pointA: { x: 0, y: 0 },
    pointB: { x: 300, y: 0 },
    realDistanceFeet: 25,
    mode: 'known-measurement',
  },
}

function renderRecalibrate(onUpdated = vi.fn(), onCancel = vi.fn()) {
  const property = propertyFromRow(CALIBRATED_PHOTO_ROW)
  const fake = createFakePropertiesDbClient(CALIBRATED_PHOTO_ROW)
  const view = render(
    <PropertiesRepositoryProvider client={fake.client}>
      <BaseMapSetup mode="recalibrate" property={property} onUpdated={onUpdated} onCancel={onCancel} />
    </PropertiesRepositoryProvider>,
  )
  return { fake, onUpdated, onCancel, view }
}

describe('BaseMapSetup — recalibrating (#28)', () => {
  it('reuses the stored photo instead of asking for it again', async () => {
    renderRecalibrate()

    expect(await screen.findByTestId('scale-reference-surface')).toBeInTheDocument()
    expect(await screen.findAllByAltText('Uploaded plot plan or survey')).toHaveLength(1)
    expect(screen.queryByLabelText('Plot plan or survey photo')).not.toBeInTheDocument()
  })

  /**
   * Two clicks on an empty box would otherwise save a Scale Reference
   * measured against nothing — a silently wrong scale, which is precisely
   * the failure #28 exists to make impossible.
   */
  it('refuses to offer a measuring surface when the stored photo cannot be loaded', async () => {
    const property = propertyFromRow(CALIBRATED_PHOTO_ROW)
    const fake = createFakePropertiesDbClient(CALIBRATED_PHOTO_ROW)
    fake.storage.createSignedUrl.mockResolvedValue({ data: null, error: { message: 'gone' } })
    render(
      <PropertiesRepositoryProvider client={fake.client}>
        <BaseMapSetup mode="recalibrate" property={property} onUpdated={vi.fn()} onCancel={vi.fn()} />
      </PropertiesRepositoryProvider>,
    )

    expect(await screen.findByText(/hasn.t loaded/)).toBeInTheDocument()
    expect(screen.queryByTestId('scale-reference-surface')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save Scale Reference' })).not.toBeInTheDocument()
  })

  it('backs out without saving anything', async () => {
    const { onCancel, onUpdated } = renderRecalibrate()

    await userEvent.click(await screen.findByRole('button', { name: 'Keep the current scale' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onUpdated).not.toHaveBeenCalled()
  })
})

function renderSetup(onUpdated = vi.fn()) {
  const property = propertyFromRow(DEGRADED_ROW)
  const fake = createFakePropertiesDbClient(DEGRADED_ROW)
  render(
    <PropertiesRepositoryProvider client={fake.client}>
      <BaseMapSetup mode="update" property={property} onUpdated={onUpdated} />
    </PropertiesRepositoryProvider>,
  )
  return { fake, onUpdated }
}

function renderCreateSetup(name = 'Backyard plot', onCreated = vi.fn()) {
  const fake = createFakePropertiesDbClient(null)
  render(
    <PropertiesRepositoryProvider client={fake.client}>
      <BaseMapSetup mode="create" name={name} onCreated={onCreated} />
    </PropertiesRepositoryProvider>,
  )
  return { fake, onCreated }
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

describe('BaseMapSetup — create mode (no Property yet)', () => {
  it('creates a Property directly from an uploaded photo, with no address at all', async () => {
    const { fake, onCreated } = renderCreateSetup('Backyard plot')

    await userEvent.click(screen.getByRole('button', { name: 'Upload a plot plan photo' }))
    const file = new File(['fake'], 'plan.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Plot plan or survey photo'), file)
    await screen.findByAltText('Uploaded plot plan or survey')
    await userEvent.click(screen.getByRole('button', { name: 'Continue to Scale Reference' }))

    clickAt('scale-reference-surface', 100, 50)
    clickAt('scale-reference-surface', 400, 50)
    await userEvent.type(screen.getByLabelText('Real-world distance (feet)'), '25')
    await userEvent.click(screen.getByRole('button', { name: 'Save Scale Reference' }))

    expect(await screen.findByRole('button', { name: 'Save Scale Reference' })).toBeInTheDocument()
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Backyard plot',
        address: null,
        latitude: null,
        longitude: null,
        baseMapSource: 'photo',
      }),
    )
    expect(fake.storage.upload).toHaveBeenCalled()
  })

  it('creates a Property directly from a drawn plan', async () => {
    const { onCreated } = renderCreateSetup('Front yard')

    await userEvent.click(screen.getByRole('button', { name: 'Draw a base plan' }))
    clickAt('base-map-drawing-surface', 0, 0)
    clickAt('base-map-drawing-surface', 100, 0)
    await userEvent.click(screen.getByRole('button', { name: 'Finish this line' }))
    await userEvent.click(screen.getByRole('button', { name: 'Done drawing' }))

    clickAt('scale-reference-surface', 0, 0)
    clickAt('scale-reference-surface', 100, 0)
    await userEvent.type(screen.getByLabelText('Real-world distance (feet)'), '10')
    await userEvent.click(screen.getByRole('button', { name: 'Save Scale Reference' }))

    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Front yard', address: null, baseMapSource: 'drawn' }),
    )
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

describe('BaseMapSetup — placed-point feedback while drawing', () => {
  it('marks the first placed point, before any line exists to render', async () => {
    renderSetup()
    await userEvent.click(screen.getByRole('button', { name: 'Draw a base plan' }))

    clickAt('base-map-drawing-surface', 40, 60)

    const placed = screen.getAllByTestId('base-map-placed-point')
    expect(placed).toHaveLength(1)
    expect(placed[0]).toHaveAttribute('cx', '40')
    expect(placed[0]).toHaveAttribute('cy', '60')
    // The bug was an element that existed and painted nothing, so presence in
    // the DOM is not the assertion that matters — a drawable radius is.
    expect(placed[0]).toBeVisible()
    expect(Number(placed[0].getAttribute('r'))).toBeGreaterThan(0)
  })

  it('marks every point of the line in progress', async () => {
    renderSetup()
    await userEvent.click(screen.getByRole('button', { name: 'Draw a base plan' }))

    clickAt('base-map-drawing-surface', 0, 0)
    clickAt('base-map-drawing-surface', 100, 0)
    clickAt('base-map-drawing-surface', 100, 100)

    expect(screen.getAllByTestId('base-map-placed-point')).toHaveLength(3)
  })

  it('drops the in-progress markers once the line is finished', async () => {
    renderSetup()
    await userEvent.click(screen.getByRole('button', { name: 'Draw a base plan' }))

    clickAt('base-map-drawing-surface', 0, 0)
    clickAt('base-map-drawing-surface', 100, 0)
    await userEvent.click(screen.getByRole('button', { name: 'Finish this line' }))

    expect(screen.queryAllByTestId('base-map-placed-point')).toHaveLength(0)
  })
})

describe('BaseMapSetup on a mobile browser', () => {
  function setViewport(width: number, coarsePointer: boolean) {
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('coarse') ? coarsePointer : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not offer the drawn base plan, and says why', () => {
    // ADR-0003 keeps freehand drawing desktop-only and that covers the
    // in-app drawn base plan, not just Bed outlines. Web was the only
    // surface not enforcing it: native's BaseMapSetupScreen offers the
    // photo source alone.
    setViewport(390, true)
    renderSetup()

    expect(screen.queryByRole('button', { name: 'Draw a base plan' })).not.toBeInTheDocument()
    expect(screen.getByText(DESKTOP_ONLY.drawing)).toBeInTheDocument()
  })

  it('still offers the photo path, so a phone browser is not a dead end', () => {
    setViewport(390, true)
    renderSetup()

    expect(screen.getByRole('button', { name: 'Upload a plot plan photo' })).toBeInTheDocument()
  })

  it('offers drawing again on a desktop viewport', () => {
    setViewport(1440, false)
    renderSetup()

    expect(screen.getByRole('button', { name: 'Draw a base plan' })).toBeInTheDocument()
    expect(screen.queryByText(DESKTOP_ONLY.drawing)).not.toBeInTheDocument()
  })
})
