import type { BedRow, PlantRow, PlantingRow, PropertyRow } from '@plant-app/domain'
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
import { BloomTimelinePage } from './BloomTimelinePage'

const PROPERTY_ROW: PropertyRow = {
  id: 'property-1',
  address: '10 Main St, Cambridge, MA',
  resolved_address: null,
  latitude: 42.3782,
  longitude: -71.1266,
  imagery_zoom: 20,
  imagery_available: true,
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

const BACK_BED: BedRow = { ...FRONT_BED, id: 'bed-back', name: 'Back bed' }

const CONEFLOWER: PlantRow = row({
  id: 'plant-coneflower',
  common_name: 'Coneflower',
  scientific_name: 'Echinacea purpurea',
  bloom_start_month: 6,
  bloom_start_day: 1,
  bloom_end_month: 8,
  bloom_end_day: 15,
})

const ASTER: PlantRow = row({
  id: 'plant-aster',
  common_name: 'Aster',
  scientific_name: 'Symphyotrichum novae-angliae',
  bloom_start_month: 9,
  bloom_start_day: 1,
  bloom_end_month: 10,
  bloom_end_day: 1,
})

const WINTERBERRY: PlantRow = row({
  id: 'plant-winterberry',
  common_name: 'Winterberry',
  scientific_name: 'Ilex verticillata',
  bloom_start_month: 11,
  bloom_start_day: 15,
  bloom_end_month: 2,
  bloom_end_day: 15,
})

const FERN_NO_BLOOM: PlantRow = row({
  id: 'plant-fern',
  common_name: 'Fern',
  scientific_name: 'Polystichum acrostichoides',
})

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
              <BloomTimelinePage />
            </PlantingsRepositoryProvider>
          </BedsRepositoryProvider>
        </PropertiesRepositoryProvider>
      </PlantsRepositoryProvider>
    </MemoryRouter>,
  )
}

describe('BloomTimelinePage — year-view chart', () => {
  it('shows a bar for every Plant with a bloom window', async () => {
    renderPage({ plants: [CONEFLOWER, ASTER] })
    expect(await screen.findByText('Coneflower')).toBeInTheDocument()
    expect(screen.getByText('Aster')).toBeInTheDocument()
  })

  it('omits Plants with no bloom window set', async () => {
    renderPage({ plants: [CONEFLOWER, FERN_NO_BLOOM] })
    await screen.findByText('Coneflower')
    expect(screen.queryByText('Fern')).not.toBeInTheDocument()
  })

  it('shows an empty state when no Plant has a bloom window', async () => {
    renderPage({ plants: [FERN_NO_BLOOM] })
    expect(await screen.findByText(/No bloom windows to show/)).toBeInTheDocument()
  })
})

describe('BloomTimelinePage — Bed filter', () => {
  it('narrows the chart to only Plants planted in the selected Bed', async () => {
    renderPage({
      plants: [CONEFLOWER, ASTER],
      property: PROPERTY_ROW,
      beds: [FRONT_BED, BACK_BED],
      plantings: [
        {
          id: 'planting-1',
          plant_id: 'plant-coneflower',
          bed_id: 'bed-front',
          quantity: 3,
          year_acquired: null,
          source_nursery: null,
          pin_x: 1,
          pin_y: 1,
          created_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'planting-2',
          plant_id: 'plant-aster',
          bed_id: 'bed-back',
          quantity: 1,
          year_acquired: null,
          source_nursery: null,
          pin_x: 2,
          pin_y: 2,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    })

    await screen.findByText('Coneflower')
    expect(screen.getByText('Aster')).toBeInTheDocument()

    await userEvent.selectOptions(await screen.findByLabelText('Bed'), 'Front border')

    expect(screen.getByText('Coneflower')).toBeInTheDocument()
    expect(screen.queryByText('Aster')).not.toBeInTheDocument()
  })
})

describe('BloomTimelinePage — month-filtered list', () => {
  it('lists the same underlying bars, narrowed to the selected month, including a wrapping bloom window', async () => {
    renderPage({ plants: [CONEFLOWER, ASTER, WINTERBERRY] })
    await screen.findByText('Coneflower')

    await userEvent.click(screen.getByRole('button', { name: 'List view' }))
    await userEvent.selectOptions(await screen.findByLabelText('Month'), 'December')

    const list = screen.getByRole('list', { name: 'Blooming this month' })
    expect(within(list).getByText(/Winterberry/)).toBeInTheDocument()
    expect(within(list).queryByText(/Coneflower/)).not.toBeInTheDocument()
    expect(within(list).queryByText(/Aster/)).not.toBeInTheDocument()
  })

  it('defaults to every blooming Plant when no month is selected', async () => {
    renderPage({ plants: [CONEFLOWER, ASTER, WINTERBERRY] })
    await userEvent.click(await screen.findByRole('button', { name: 'List view' }))

    const list = screen.getByRole('list', { name: 'Blooming this month' })
    expect(within(list).getByText(/Coneflower/)).toBeInTheDocument()
    expect(within(list).getByText(/Aster/)).toBeInTheDocument()
    expect(within(list).getByText(/Winterberry/)).toBeInTheDocument()
  })
})
