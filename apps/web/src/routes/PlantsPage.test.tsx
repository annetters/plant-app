import type { BedRow, PlantingRow, PlantRow, PropertyRow } from '@plant-app/domain'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PlantsRepositoryProvider } from '../plants/PlantsRepositoryContext'
import { PlantingsRepositoryProvider } from '../plantings/PlantingsRepositoryContext'
import { BedsRepositoryProvider } from '../property/BedsRepositoryContext'
import { PropertiesRepositoryProvider } from '../property/PropertiesRepositoryContext'
import { createFakeBedsDbClient } from '../test/fakeBedsDbClient'
import { createFakePlantingsDbClient } from '../test/fakePlantingsDbClient'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { createFakePropertiesDbClient } from '../test/fakePropertiesDbClient'
import { plantRow as row } from '../test/plantRowFixture'
import { PlantsPage } from './PlantsPage'

const PROPERTY_ROW: PropertyRow = {
  id: 'property-1',
  address: '10 Main St, Cambridge, MA',
  resolved_address: null,
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

const FRONT_BED: BedRow = {
  id: 'bed-front',
  property_id: 'property-1',
  name: 'Front border',
  tool: 'freehand',
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 5 },
  ],
  smoothing_enabled: false,
  created_at: '2026-01-01T00:00:00.000Z',
}

function renderPage({
  plants = [],
  property = null,
  beds = [],
  plantings = [],
}: {
  plants?: PlantRow[]
  property?: PropertyRow | null
  beds?: BedRow[]
  plantings?: PlantingRow[]
} = {}) {
  const plantsClient = createFakePlantsDbClient(plants)
  const propertiesClient = createFakePropertiesDbClient(property)
  const bedsClient = createFakeBedsDbClient(beds)
  const plantingsClient = createFakePlantingsDbClient(plantings)
  render(
    <MemoryRouter>
      <PlantsRepositoryProvider client={plantsClient.client}>
        <PropertiesRepositoryProvider client={propertiesClient.client}>
          <BedsRepositoryProvider client={bedsClient.client}>
            <PlantingsRepositoryProvider client={plantingsClient.client}>
              <PlantsPage />
            </PlantingsRepositoryProvider>
          </BedsRepositoryProvider>
        </PropertiesRepositoryProvider>
      </PlantsRepositoryProvider>
    </MemoryRouter>,
  )
}

describe('PlantsPage', () => {
  it('lists each Plant by common and scientific name, linking to its detail page', async () => {
    renderPage({
      plants: [
        row({ id: 'p1', common_name: 'Coneflower', scientific_name: 'Echinacea purpurea' }),
        row({ id: 'p2', common_name: 'Joe Pye Weed', scientific_name: 'Eutrochium purpureum' }),
      ],
    })

    const link = await screen.findByRole('link', { name: /Coneflower.*Echinacea purpurea/ })
    expect(link).toHaveAttribute('href', '/registry/p1')
    expect(screen.getByRole('link', { name: /Joe Pye Weed/ })).toBeInTheDocument()
  })

  it('shows an empty state when there are no plants yet', async () => {
    renderPage()
    expect(await screen.findByText('No plants yet — add your first one.')).toBeInTheDocument()
  })

  it('links to the Add Plant page', async () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Add Plant' })).toHaveAttribute('href', '/registry/new')
  })
})

describe('PlantsPage — filters', () => {
  const CONEFLOWER = row({
    id: 'p1',
    common_name: 'Coneflower',
    scientific_name: 'Echinacea purpurea',
    flower_color: 'purple-pink',
    bloom_start_month: 6,
    bloom_start_day: 1,
    bloom_end_month: 8,
    bloom_end_day: 15,
    sun_requirement: 'full-sun',
  })
  const FERN = row({
    id: 'p2',
    common_name: 'Christmas Fern',
    scientific_name: 'Polystichum acrostichoides',
    sun_requirement: 'full-shade',
  })

  it('narrows the list by search text', async () => {
    renderPage({ plants: [CONEFLOWER, FERN] })
    await screen.findByText(/Coneflower/)

    await userEvent.type(screen.getByLabelText('Search'), 'cone')

    expect(screen.getByText(/Coneflower/)).toBeInTheDocument()
    expect(screen.queryByText(/Christmas Fern/)).not.toBeInTheDocument()
  })

  it('narrows the list by sun/shade requirement', async () => {
    renderPage({ plants: [CONEFLOWER, FERN] })
    await screen.findByText(/Coneflower/)

    await userEvent.selectOptions(screen.getByLabelText('Sun/shade'), 'full shade')

    expect(screen.queryByText(/Coneflower/)).not.toBeInTheDocument()
    expect(screen.getByText(/Christmas Fern/)).toBeInTheDocument()
  })

  it('combines multiple filter axes with AND', async () => {
    renderPage({ plants: [CONEFLOWER, FERN] })
    await screen.findByText(/Coneflower/)

    await userEvent.selectOptions(screen.getByLabelText('Sun/shade'), 'full sun')
    await userEvent.type(screen.getByLabelText('Flower color'), 'purple')

    expect(screen.getByText(/Coneflower/)).toBeInTheDocument()
    expect(screen.queryByText(/Christmas Fern/)).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Flower color'), 'never-matches')
    expect(await screen.findByText('No Plants match these filters.')).toBeInTheDocument()
  })

  it("shows each Plant's matching attributes, so a filter result is visibly verifiable rather than trusted blind", async () => {
    renderPage({ plants: [CONEFLOWER, FERN] })
    await screen.findByText(/Coneflower/)

    expect(
      screen.getByText('Flower color: purple-pink · Blooms: June 1 – August 15 · Sun: full sun'),
    ).toBeInTheDocument()
    expect(screen.getByText('Sun: full shade')).toBeInTheDocument()
  })
})

describe('PlantsPage — Planting locations', () => {
  it("links each Plant with a Planting to that Planting's Bed on the map", async () => {
    renderPage({
      plants: [row({ id: 'p1', common_name: 'Coneflower', scientific_name: 'Echinacea purpurea' })],
      property: PROPERTY_ROW,
      beds: [FRONT_BED],
      plantings: [
        {
          id: 'planting-1',
          plant_id: 'p1',
          bed_id: 'bed-front',
          quantity: 3,
          year_acquired: null,
          source_nursery: null,
          pin_x: 1,
          pin_y: 1,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    })

    const item = (await screen.findByText(/Coneflower/)).closest('li') as HTMLElement
    // Beds/Plantings load asynchronously after the Plant list itself — the
    // location link only appears once that second fetch resolves, so this
    // must be a `findBy`, not a `getBy`.
    const link = await within(item).findByRole('link', { name: 'View in Front border on the map' })
    expect(link).toHaveAttribute('href', '/map?plantingId=planting-1')
  })

  it('shows no Planting-location link for a Plant with no Planting yet', async () => {
    renderPage({
      plants: [row({ id: 'p1', common_name: 'Coneflower', scientific_name: 'Echinacea purpurea' })],
    })

    await screen.findByText(/Coneflower/)
    expect(screen.queryByRole('link', { name: /on the map/ })).not.toBeInTheDocument()
  })
})
