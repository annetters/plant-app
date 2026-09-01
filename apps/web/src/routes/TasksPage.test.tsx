import type { BedRow, OneOffTodoRow, PlantingRow, PlantRow, PropertyRow } from '@plant-app/domain'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PlantsRepositoryProvider } from '../plants/PlantsRepositoryContext'
import { PlantingsRepositoryProvider } from '../plantings/PlantingsRepositoryContext'
import { BedsRepositoryProvider } from '../property/BedsRepositoryContext'
import { PropertiesRepositoryProvider } from '../property/PropertiesRepositoryContext'
import { OneOffTodosRepositoryProvider } from '../tasks/OneOffTodosRepositoryContext'
import { createFakeBedsDbClient } from '../test/fakeBedsDbClient'
import { createFakeOneOffTodosDbClient } from '../test/fakeOneOffTodosDbClient'
import { createFakePlantingsDbClient } from '../test/fakePlantingsDbClient'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { createFakePropertiesDbClient } from '../test/fakePropertiesDbClient'
import { plantRow as row } from '../test/plantRowFixture'
import { TasksPage } from './TasksPage'

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

const BED_ROW: BedRow = {
  id: 'bed-1',
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

const PLANTING_ROW: PlantingRow = {
  id: 'planting-1',
  plant_id: 'plant-existing',
  bed_id: 'bed-1',
  quantity: 3,
  year_acquired: null,
  source_nursery: null,
  pin_x: 2,
  pin_y: 4,
  created_at: '2026-01-01T00:00:00.000Z',
}

function renderPage({
  plants = [],
  property = null,
  beds = [],
  plantings = [],
  todos = [],
}: {
  plants?: PlantRow[]
  property?: PropertyRow | null
  beds?: BedRow[]
  plantings?: PlantingRow[]
  todos?: OneOffTodoRow[]
} = {}) {
  const plantsClient = createFakePlantsDbClient(plants)
  const propertiesClient = createFakePropertiesDbClient(property)
  const bedsClient = createFakeBedsDbClient(beds)
  const plantingsClient = createFakePlantingsDbClient(plantings)
  const oneOffTodosClient = createFakeOneOffTodosDbClient(todos)
  render(
    <MemoryRouter>
      <PlantsRepositoryProvider client={plantsClient.client}>
        <PropertiesRepositoryProvider client={propertiesClient.client}>
          <BedsRepositoryProvider client={bedsClient.client}>
            <PlantingsRepositoryProvider client={plantingsClient.client}>
              <OneOffTodosRepositoryProvider client={oneOffTodosClient.client}>
                <TasksPage />
              </OneOffTodosRepositoryProvider>
            </PlantingsRepositoryProvider>
          </BedsRepositoryProvider>
        </PropertiesRepositoryProvider>
      </PlantsRepositoryProvider>
    </MemoryRouter>,
  )
  return { oneOffTodosClient }
}

describe('TasksPage', () => {
  it('links to each Planting’s task history', async () => {
    renderPage({
      property: PROPERTY_ROW,
      beds: [BED_ROW],
      plantings: [PLANTING_ROW],
      plants: [row()],
    })

    expect(
      await screen.findByRole('link', { name: 'Coneflower task history' }),
    ).toHaveAttribute('href', '/tasks/plantings/planting-1')
  })

  it('lists existing one-off to-dos', async () => {
    renderPage({ todos: [{ id: 'todo-1', text: 'Order mulch', done: false, created_at: '2026-01-01T00:00:00.000Z' }] })

    expect(await screen.findByText('Order mulch')).toBeInTheDocument()
  })

  it('adds a new one-off to-do', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Add a to-do'), 'Order mulch')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Order mulch')).toBeInTheDocument()
  })

  it('toggles a to-do done', async () => {
    const user = userEvent.setup()
    renderPage({ todos: [{ id: 'todo-1', text: 'Order mulch', done: false, created_at: '2026-01-01T00:00:00.000Z' }] })

    const checkbox = await screen.findByRole('checkbox')
    await user.click(checkbox)

    expect(checkbox).toBeChecked()
  })

  it('shows a message when there is no Property yet', async () => {
    renderPage({ property: null })

    expect(
      await screen.findByText('Set up your Property to start tracking Planting tasks.'),
    ).toBeInTheDocument()
  })
})
