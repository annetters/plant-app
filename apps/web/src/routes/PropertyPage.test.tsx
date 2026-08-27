import type { BedRow, PlantingRow, PlantRow, PropertyRow } from '@plant-app/domain'
import { render, screen, within } from '@testing-library/react'
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

function renderPage(initialRow: PropertyRow | null = null) {
  const fake = createFakePropertiesDbClient(initialRow)
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

describe('PropertyPage — existing Property', () => {
  const availableRow: PropertyRow = {
    id: 'property-1',
    address: '10 Main St, Cambridge, MA',
    resolved_address: '10 Main Street, Cambridge, Middlesex County, Massachusetts, 02142',
    latitude: 42.3782,
    longitude: -71.1266,
    imagery_zoom: 20,
    imagery_available: true,
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

  it('renders the base map imagery for an available property', async () => {
    renderPage(availableRow)
    expect(await screen.findByText('10 Main St, Cambridge, MA')).toBeInTheDocument()
    const tiles = screen.getAllByRole('img')
    expect(tiles.length).toBeGreaterThan(0)
    expect(tiles[0]).toHaveAttribute(
      'src',
      expect.stringContaining('server.arcgisonline.com/ArcGIS/rest/services/World_Imagery'),
    )
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
