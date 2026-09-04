import type { BedRow, PlantingRow, PlantRow, PropertyRow } from '@plant-app/domain'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PlantsRepositoryProvider } from '../plants/PlantsRepositoryContext'
import { PlantingsRepositoryProvider } from '../plantings/PlantingsRepositoryContext'
import { BedsRepositoryProvider } from '../property/BedsRepositoryContext'
import { PropertiesRepositoryProvider } from '../property/PropertiesRepositoryContext'
import { createFakeBedsDbClient } from '../test/fakeBedsDbClient'
import { createFakePlantingsDbClient } from '../test/fakePlantingsDbClient'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { createFakePropertiesDbClient } from '../test/fakePropertiesDbClient'
import { PropertyPage } from './PropertyPage'

// jsdom has no real <canvas> 2D context — see BedEditor.test.tsx's identical
// comment. PropertyPage renders both BedEditor and PlantingMap, each of
// which mounts a real Konva Stage once a Property with imagery renders, so
// this page's own tests need the same stub.
vi.mock('konva', () => {
  class FakeNode {
    on() {}
    off() {}
    destroy() {}
  }
  class FakeContainer extends FakeNode {
    add() {}
    destroyChildren() {}
    batchDraw() {}
  }
  class FakeStage extends FakeContainer {
    getPointerPosition() {
      return null
    }
  }
  class FakeShape extends FakeNode {
    attrs: Record<string, unknown>
    constructor(attrs: Record<string, unknown> = {}) {
      super()
      this.attrs = attrs
    }
  }
  return {
    default: {
      Stage: FakeStage,
      Layer: FakeContainer,
      Line: FakeShape,
      Rect: FakeShape,
      Ellipse: FakeShape,
      Circle: FakeShape,
    },
  }
})

function renderPage(initialRow: PropertyRow | null = null, bedRows: BedRow[] = []) {
  const fake = createFakePropertiesDbClient(initialRow)
  const beds = createFakeBedsDbClient(bedRows)
  const plants = createFakePlantsDbClient([])
  const plantings = createFakePlantingsDbClient([])
  render(
    <MemoryRouter>
      <PropertiesRepositoryProvider client={fake.client}>
        <BedsRepositoryProvider client={beds.client}>
          <PlantsRepositoryProvider client={plants.client}>
            <PlantingsRepositoryProvider client={plantings.client}>
              <PropertyPage />
            </PlantingsRepositoryProvider>
          </PlantsRepositoryProvider>
        </BedsRepositoryProvider>
      </PropertiesRepositoryProvider>
    </MemoryRouter>,
  )
  return fake
}

/** Types into the address field, waits for candidates, and picks the first one. */
async function pickFirstCandidate(query: string) {
  await userEvent.type(await screen.findByLabelText('Address'), query)
  const [firstOption] = await screen.findAllByRole('option')
  await userEvent.click(firstOption)
}

describe('PropertyPage — no Property yet', () => {
  it('offers an address form', async () => {
    renderPage(null)
    expect(await screen.findByLabelText('Address')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Property' })).toBeInTheDocument()
  })

  it('rejects submission with no picked candidate, without calling the repository', async () => {
    const { invoke } = renderPage(null)
    await screen.findByLabelText('Address')
    await userEvent.click(screen.getByRole('button', { name: 'Create Property' }))
    expect(await screen.findByText('Select an address from the results list.')).toBeInTheDocument()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('rejects typed-but-unpicked text — typing alone is not enough to submit', async () => {
    renderPage(null)
    await userEvent.type(await screen.findByLabelText('Address'), '10 main st')
    await screen.findAllByRole('option') // candidates loaded, but none clicked
    await userEvent.click(screen.getByRole('button', { name: 'Create Property' }))
    expect(await screen.findByText('Select an address from the results list.')).toBeInTheDocument()
  })

  it('creates the Property once a candidate is picked, and renders its base map', async () => {
    renderPage(null)
    await pickFirstCandidate('10 main st')
    await userEvent.click(screen.getByRole('button', { name: 'Create Property' }))

    expect(await screen.findByText('10 main st')).toBeInTheDocument()
    expect(screen.queryByLabelText('Address')).not.toBeInTheDocument()
  })

  it('surfaces a failure from the edge function as a form error', async () => {
    const fake = createFakePropertiesDbClient(null)
    const beds = createFakeBedsDbClient([])
    const plants = createFakePlantsDbClient([])
    const plantings = createFakePlantingsDbClient([])
    render(
      <MemoryRouter>
        <PropertiesRepositoryProvider client={fake.client}>
          <BedsRepositoryProvider client={beds.client}>
            <PlantsRepositoryProvider client={plants.client}>
              <PlantingsRepositoryProvider client={plantings.client}>
                <PropertyPage />
              </PlantingsRepositoryProvider>
            </PlantsRepositoryProvider>
          </BedsRepositoryProvider>
        </PropertiesRepositoryProvider>
      </MemoryRouter>,
    )

    await userEvent.type(await screen.findByLabelText('Address'), 'nowhere at all')
    const [firstOption] = await screen.findAllByRole('option')
    await userEvent.click(firstOption)

    // Overrides only the next invoke() call — the create-property submission
    // below — leaving the search-addresses call above on the default fake.
    fake.invoke.mockResolvedValueOnce({
      data: { error: 'Could not resolve that address.' },
      error: null,
    })
    await userEvent.click(screen.getByRole('button', { name: 'Create Property' }))

    expect(await screen.findByText('Could not resolve that address.')).toBeInTheDocument()
  })
})

/** See BaseMapSetup.test.tsx's identical helper — jsdom's zeroed getBoundingClientRect means clientX/Y map directly to the surface's own coordinate space. */
function clickAt(testId: string, x: number, y: number) {
  fireEvent.click(screen.getByTestId(testId), { clientX: x, clientY: y })
}

describe('PropertyPage — own base map, no address (privacy/up-front choice)', () => {
  it('offers a way to skip aerial imagery up front, before any address is typed', async () => {
    renderPage(null)
    await screen.findByLabelText('Address')

    await userEvent.click(
      await screen.findByRole('button', {
        name: "Don't want to use aerial imagery? Upload or draw your own base map instead.",
      }),
    )

    expect(screen.queryByLabelText('Address')).not.toBeInTheDocument()
    expect(await screen.findByLabelText('Name your map')).toBeInTheDocument()
  })

  it('can switch back to the address form from the name step', async () => {
    renderPage(null)
    await userEvent.click(
      await screen.findByRole('button', {
        name: "Don't want to use aerial imagery? Upload or draw your own base map instead.",
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Use aerial imagery instead' }))

    expect(await screen.findByLabelText('Address')).toBeInTheDocument()
  })

  it('creates the Property from a name and an uploaded photo, with no address or geocode call at all', async () => {
    const fake = renderPage(null)
    await userEvent.click(
      await screen.findByRole('button', {
        name: "Don't want to use aerial imagery? Upload or draw your own base map instead.",
      }),
    )
    await userEvent.type(await screen.findByLabelText('Name your map'), 'Backyard plot')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await userEvent.click(screen.getByRole('button', { name: 'Upload a plot plan photo' }))
    const file = new File(['fake'], 'plan.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Plot plan or survey photo'), file)
    await screen.findByAltText('Uploaded plot plan or survey')
    await userEvent.click(screen.getByRole('button', { name: 'Continue to Scale Reference' }))

    clickAt('scale-reference-surface', 100, 50)
    clickAt('scale-reference-surface', 400, 50)
    await userEvent.type(screen.getByLabelText('Real-world distance (feet)'), '25')
    await userEvent.click(screen.getByRole('button', { name: 'Save Scale Reference' }))

    expect(await screen.findByText('Backyard plot')).toBeInTheDocument()
    expect(screen.queryByText(/No aerial imagery is available/)).not.toBeInTheDocument()
    expect(fake.invoke).not.toHaveBeenCalled()
  })
})

describe('PropertyPage — existing Property', () => {
  const availableRow: PropertyRow = {
    id: 'property-1',
    address: '10 Main St, Cambridge, MA',
    resolved_address: '10 Main Street, Cambridge, Middlesex County, Massachusetts, 02142',
    latitude: 42.3782,
    longitude: -71.1266,
    imagery_zoom: 20,
    imagery_available: true,
    base_map_source: 'aerial',
    base_map_photo_path: null,
    base_map_drawing: null,
    scale_reference: null,
    name: null,
    created_at: '2026-01-01T00:00:00.000Z',
  }

  it('shows what was typed alongside what the geocoder actually matched it to', async () => {
    renderPage(availableRow)
    expect(await screen.findByText('10 Main St, Cambridge, MA')).toBeInTheDocument()
    expect(
      screen.getByText(/Matched to: 10 Main Street, Cambridge, Middlesex County, Massachusetts, 02142/),
    ).toBeInTheDocument()
  })

  it('shows only the typed address for a Property created before resolvedAddress existed', async () => {
    renderPage({ ...availableRow, resolved_address: null })
    expect(await screen.findByText('10 Main St, Cambridge, MA')).toBeInTheDocument()
    expect(screen.queryByText(/Matched to/)).not.toBeInTheDocument()
  })

  const bedRow: BedRow = {
    id: 'bed-1',
    property_id: 'property-1',
    name: 'Front border',
    tool: 'rectangle',
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    smoothing_enabled: false,
    created_at: '2026-01-01T00:00:00.000Z',
  }

  const PREVIEW_CAPTION = 'Check this is the right place before drawing Beds.'

  /** BaseMapBackground's aerial tiles are decorative (alt=""), so they're excluded from the accessible "img" role — query the DOM directly instead. */
  function aerialTiles() {
    return [...document.querySelectorAll('img')].filter((img) =>
      img.getAttribute('src')?.includes('server.arcgisonline.com/ArcGIS/rest/services/World_Imagery'),
    )
  }

  it('shows the base map straight away on a Property with no Beds, so a geocoded address can be checked against the imagery', async () => {
    renderPage(availableRow)
    await screen.findByText('10 Main St, Cambridge, MA')

    // The regression this guards: #6 removed PropertyPage's own thumbnail as
    // a duplicate of BedEditor's copy, which only holds while the editor is
    // open; #25 then hid PlantingMap's until a Bed exists. Between them a
    // freshly created Property rendered no imagery at all — nothing to tell
    // a right roof from a wrong one.
    expect(await screen.findByText(PREVIEW_CAPTION)).toBeInTheDocument()
    expect(aerialTiles().length).toBeGreaterThan(0)
  })

  it('drops the preview once the Bed editor opens, so the same imagery never renders twice', async () => {
    renderPage(availableRow)
    // The caption, not the address: the address comes from the Property
    // fetch, while the preview waits on the separate Beds fetch settling.
    await screen.findByText(PREVIEW_CAPTION)
    const previewTileCount = aerialTiles().length
    expect(previewTileCount).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: 'Draw a Bed' }))

    // Stacking the two was exactly what #6 removed the original thumbnail
    // for, so the count must not grow when the editor's own copy appears.
    expect(screen.queryByText(PREVIEW_CAPTION)).not.toBeInTheDocument()
    expect(aerialTiles()).toHaveLength(previewTileCount)
  })

  it('brings the preview back when the Bed editor closes with no Bed saved', async () => {
    renderPage(availableRow)
    await screen.findByText('10 Main St, Cambridge, MA')

    await userEvent.click(screen.getByRole('button', { name: 'Draw a Bed' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(await screen.findByText(PREVIEW_CAPTION)).toBeInTheDocument()
  })

  it('drops the preview once a Bed exists, since PlantingMap already shows the imagery', async () => {
    renderPage(availableRow, [bedRow])
    await screen.findByText('10 Main St, Cambridge, MA')
    await waitFor(() => expect(aerialTiles().length).toBeGreaterThan(0))

    expect(screen.queryByText(PREVIEW_CAPTION)).not.toBeInTheDocument()
  })

  it('hides the Plantings map while the Bed editor is open, so only one base map is ever on screen', async () => {
    renderPage(availableRow, [bedRow])
    const plantingSurface = await screen.findByTestId('planting-map-surface')
    await waitFor(() => expect(plantingSurface).toBeVisible())

    // Two 768px maps stacked, each drawing the same imagery, with nothing
    // saying which one accepts a drawing — the duplicate #6 removed the
    // standalone thumbnail over, in the one arrangement that removal left
    // untouched.
    const plantingsHeading = screen.getByRole('heading', { name: 'Plantings' })
    expect(plantingsHeading).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: 'Draw a Bed' }))
    expect(plantingsHeading).not.toBeVisible()
    expect(screen.getByTestId('bed-drawing-surface')).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(plantingsHeading).toBeVisible()
  })

  it('keeps the Plantings surface mounted while hidden, so its Konva refs survive the round trip', async () => {
    renderPage(availableRow, [bedRow])
    const plantingSurface = await screen.findByTestId('planting-map-surface')
    await waitFor(() => expect(plantingSurface).toBeVisible())

    // Hiding, never unmounting — #8's original null-ref bug came back the
    // moment this container left the DOM. Same reasoning as the beds-length
    // gate this sits alongside (see PlantingMap's own comment).
    await userEvent.click(screen.getByRole('button', { name: 'Draw a Bed' }))
    expect(plantingSurface).toBeInTheDocument()
    expect(plantingSurface).not.toBeVisible()
  })

  it('keeps the 768px Plantings canvas from widening the page on a phone', async () => {
    renderPage(availableRow, [bedRow])
    const surface = await screen.findByTestId('planting-map-surface')
    await waitFor(() => expect(surface).toBeVisible())

    // The canvas is a fixed STAGE_SIZE_PX and can't shrink — the Konva
    // stage is built at that size and Pin coordinates run through it. So
    // the scrolling is contained to its own box instead, rather than the
    // whole page sliding sideways on a narrow screen.
    const viewport = screen.getByTestId('planting-map-viewport')
    expect(viewport).toHaveStyle({ overflowX: 'auto', maxWidth: '100%' })
    expect(viewport).toContainElement(surface)
  })

  it('previews a photographed base map too, not just aerial imagery', async () => {
    renderPage({
      ...availableRow,
      base_map_source: 'photo',
      base_map_photo_path: 'user-1/plan.jpg',
      latitude: null,
      longitude: null,
      imagery_zoom: null,
      imagery_available: false,
      scale_reference: {
        pointA: { x: 0, y: 0 },
        pointB: { x: 300, y: 0 },
        realDistanceFeet: 25,
        mode: 'known-measurement',
      },
    })

    expect(await screen.findByText(PREVIEW_CAPTION)).toBeInTheDocument()
    expect(await screen.findByAltText('Photographed plot plan or survey')).toBeInTheDocument()
  })

  it('previews an in-app-drawn base map too', async () => {
    renderPage({
      ...availableRow,
      base_map_source: 'drawn',
      base_map_drawing: [
        [
          { x: 10, y: 10 },
          { x: 200, y: 10 },
        ],
      ],
      latitude: null,
      longitude: null,
      imagery_zoom: null,
      imagery_available: false,
      scale_reference: {
        pointA: { x: 0, y: 0 },
        pointB: { x: 300, y: 0 },
        realDistanceFeet: 25,
        mode: 'known-measurement',
      },
    })

    expect(await screen.findByText(PREVIEW_CAPTION)).toBeInTheDocument()
    expect(await screen.findByLabelText('Drawn base plan')).toBeInTheDocument()
  })

  it('shows a degraded-mode message instead of a silent grey gap when no imagery is available', async () => {
    renderPage({ ...availableRow, imagery_zoom: null, imagery_available: false })
    expect(
      await screen.findByText(/No aerial imagery is available for this property/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('deletes the Property after confirmation, freeing the account up to create another', async () => {
    const user = userEvent.setup()
    renderPage(availableRow)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    await screen.findByText('10 Main St, Cambridge, MA')
    await user.click(screen.getByRole('button', { name: 'Delete Property' }))

    expect(await screen.findByLabelText('Address')).toBeInTheDocument()
    expect(screen.queryByText('10 Main St, Cambridge, MA')).not.toBeInTheDocument()
  })

  it('does not delete the Property when the confirmation is declined', async () => {
    const user = userEvent.setup()
    renderPage(availableRow)
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    await screen.findByText('10 Main St, Cambridge, MA')
    await user.click(screen.getByRole('button', { name: 'Delete Property' }))

    expect(screen.getByText('10 Main St, Cambridge, MA')).toBeInTheDocument()
    expect(screen.queryByLabelText('Address')).not.toBeInTheDocument()
  })

  it('opens the Planting named by a ?plantingId= query param (the Registry\'s "View on the map" link, #10)', async () => {
    const plantRow: PlantRow = {
      id: 'plant-1',
      common_name: 'Coneflower',
      scientific_name: 'Echinacea purpurea',
      cultivar: null,
      flower_color: null,
      bloom_start_month: null,
      bloom_start_day: null,
      bloom_end_month: null,
      bloom_end_day: null,
      sun_requirement: null,
      mature_height_inches: null,
      mature_spread_inches: null,
      hardiness_zone_min: null,
      hardiness_zone_max: null,
      foliage_type: null,
      native_status: null,
      reference_photo_paths: [],
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }
    const plantingRow: PlantingRow = {
      id: 'planting-1',
      plant_id: 'plant-1',
      bed_id: 'bed-1',
      quantity: 3,
      year_acquired: null,
      source_nursery: null,
      pin_x: 5,
      pin_y: 5,
      created_at: '2026-01-01T00:00:00.000Z',
    }

    const fake = createFakePropertiesDbClient(availableRow)
    const beds = createFakeBedsDbClient([bedRow])
    const plants = createFakePlantsDbClient([plantRow])
    const plantings = createFakePlantingsDbClient([plantingRow])
    render(
      <MemoryRouter initialEntries={['/map?plantingId=planting-1']}>
        <PropertiesRepositoryProvider client={fake.client}>
          <BedsRepositoryProvider client={beds.client}>
            <PlantsRepositoryProvider client={plants.client}>
              <PlantingsRepositoryProvider client={plantings.client}>
                <PropertyPage />
              </PlantingsRepositoryProvider>
            </PlantsRepositoryProvider>
          </BedsRepositoryProvider>
        </PropertiesRepositoryProvider>
      </MemoryRouter>,
    )

    const details = await screen.findByRole('region', { name: 'Planting details' })
    expect(within(details).getByText('Quantity: 3')).toBeInTheDocument()
  })
})
