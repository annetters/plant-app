import type { CareTaskTemplateRow, PlantingRow, PlantRow, TaskCompletionRow } from '@plant-app/domain'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PlantsRepositoryProvider } from '../plants/PlantsRepositoryContext'
import { PlantingsRepositoryProvider } from '../plantings/PlantingsRepositoryContext'
import { TaskCompletionsRepositoryProvider } from '../tasks/TaskCompletionsRepositoryContext'
import { careTaskTemplateRow } from '../test/careTaskTemplateRowFixture'
import { createFakePlantingsDbClient } from '../test/fakePlantingsDbClient'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { createFakeTaskCompletionsDbClient } from '../test/fakeTaskCompletionsDbClient'
import { plantRow as row } from '../test/plantRowFixture'
import { PlantingTaskHistoryPage } from './PlantingTaskHistoryPage'

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
  plants = [row()],
  plantings = [PLANTING_ROW],
  templates = [],
  completions = [],
  path = '/tasks/plantings/planting-1',
}: {
  plants?: PlantRow[]
  plantings?: PlantingRow[]
  templates?: CareTaskTemplateRow[]
  completions?: TaskCompletionRow[]
  path?: string
} = {}) {
  const plantsClient = createFakePlantsDbClient(plants, templates)
  const plantingsClient = createFakePlantingsDbClient(plantings)
  const taskCompletionsClient = createFakeTaskCompletionsDbClient(completions)
  render(
    <MemoryRouter initialEntries={[path]}>
      <PlantsRepositoryProvider client={plantsClient.client}>
        <PlantingsRepositoryProvider client={plantingsClient.client}>
          <TaskCompletionsRepositoryProvider client={taskCompletionsClient.client}>
            <Routes>
              <Route path="/tasks/plantings/:plantingId" element={<PlantingTaskHistoryPage />} />
            </Routes>
          </TaskCompletionsRepositoryProvider>
        </PlantingsRepositoryProvider>
      </PlantsRepositoryProvider>
    </MemoryRouter>,
  )
  return { taskCompletionsClient }
}

describe('PlantingTaskHistoryPage', () => {
  it('shows one entry per Care task template, pending by default', async () => {
    renderPage({
      templates: [
        careTaskTemplateRow({ id: 't1', plant_id: 'plant-existing', name: 'Prune' }),
        careTaskTemplateRow({ id: 't2', plant_id: 'plant-existing', name: 'Fertilize' }),
      ],
    })

    expect(await screen.findByText('Prune')).toBeInTheDocument()
    expect(screen.getByText('Fertilize')).toBeInTheDocument()
    expect(screen.getAllByText('— pending')).toHaveLength(2)
  })

  it('reflects an already-recorded completion for the current year', async () => {
    const year = new Date().getFullYear()
    renderPage({
      templates: [careTaskTemplateRow({ id: 't1', plant_id: 'plant-existing', name: 'Prune' })],
      completions: [
        {
          id: 'c1',
          care_task_template_id: 't1',
          planting_id: 'planting-1',
          year,
          status: 'done',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    })

    expect(await screen.findByText('— done')).toBeInTheDocument()
  })

  it('marks a task done when "Mark done" is pressed', async () => {
    const user = userEvent.setup()
    renderPage({
      templates: [careTaskTemplateRow({ id: 't1', plant_id: 'plant-existing', name: 'Prune' })],
    })

    await screen.findByText('Prune')
    await user.click(screen.getByRole('button', { name: 'Mark done' }))

    expect(await screen.findByText('— done')).toBeInTheDocument()
  })

  it('marks a task missed when "Mark missed" is pressed', async () => {
    const user = userEvent.setup()
    renderPage({
      templates: [careTaskTemplateRow({ id: 't1', plant_id: 'plant-existing', name: 'Prune' })],
    })

    await screen.findByText('Prune')
    await user.click(screen.getByRole('button', { name: 'Mark missed' }))

    expect(await screen.findByText('— missed')).toBeInTheDocument()
  })

  it('shows a not-found message for an unknown Planting', async () => {
    renderPage({ plantings: [], path: '/tasks/plantings/does-not-exist' })

    expect(await screen.findByText('This Planting could not be found.')).toBeInTheDocument()
  })
})
