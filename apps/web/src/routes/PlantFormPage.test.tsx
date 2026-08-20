import type { CareTaskTemplateRow, PlantRow } from '@plant-app/domain'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PlantsRepositoryProvider } from '../plants/PlantsRepositoryContext'
import { careTaskTemplateRow } from '../test/careTaskTemplateRowFixture'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { plantRow as row } from '../test/plantRowFixture'
import { PlantFormPage } from './PlantFormPage'

function renderAt(path: string, rows: PlantRow[] = [], careTaskTemplateRows: CareTaskTemplateRow[] = []) {
  const fake = createFakePlantsDbClient(rows, careTaskTemplateRows)
  render(
    <MemoryRouter initialEntries={[path]}>
      <PlantsRepositoryProvider client={fake.client}>
        <Routes>
          <Route path="/registry/new" element={<PlantFormPage />} />
          <Route path="/registry/:plantId" element={<PlantFormPage />} />
        </Routes>
      </PlantsRepositoryProvider>
    </MemoryRouter>,
  )
  return fake
}

describe('PlantFormPage — create', () => {
  it('rejects a blank common/scientific name without calling the repository', async () => {
    const user = userEvent.setup()
    const fake = renderAt('/registry/new')

    await user.click(screen.getByRole('button', { name: 'Add Plant' }))

    expect(await screen.findByText('Common name is required.')).toBeInTheDocument()
    expect(fake.rows()).toHaveLength(0)
  })

  it('creates a Plant from the entered fields', async () => {
    const user = userEvent.setup()
    const fake = renderAt('/registry/new')

    await user.type(screen.getByLabelText('Common name *'), 'Joe Pye Weed')
    await user.type(screen.getByLabelText('Scientific name *'), 'Eutrochium purpureum')
    await user.type(screen.getByLabelText('Cultivar'), 'Gateway')
    await user.click(screen.getByRole('button', { name: 'Add Plant' }))

    await waitFor(() => expect(fake.rows()).toHaveLength(1))
    expect(fake.rows()[0]).toMatchObject({
      common_name: 'Joe Pye Weed',
      scientific_name: 'Eutrochium purpureum',
      cultivar: 'Gateway',
      user_id: 'user-1',
    })
  })
})

describe('PlantFormPage — edit/view/delete', () => {
  it('pre-fills the form with the existing Plant', async () => {
    renderAt('/registry/p1', [
      row({ id: 'p1', common_name: 'Coneflower', scientific_name: 'Echinacea purpurea', cultivar: 'PowWow Wild Berry' }),
    ])

    expect(await screen.findByDisplayValue('Coneflower')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Echinacea purpurea')).toBeInTheDocument()
    expect(screen.getByDisplayValue('PowWow Wild Berry')).toBeInTheDocument()
  })

  it('saves edits to an existing Plant', async () => {
    const user = userEvent.setup()
    const fake = renderAt('/registry/p1', [row({ id: 'p1', common_name: 'Coneflower' })])

    const commonName = await screen.findByDisplayValue('Coneflower')
    await user.clear(commonName)
    await user.type(commonName, 'Purple Coneflower')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(fake.rows()[0].common_name).toBe('Purple Coneflower'))
  })

  it('confirms a save with a status message, clearing it once the plant is edited again', async () => {
    const user = userEvent.setup()
    renderAt('/registry/p1', [row({ id: 'p1', common_name: 'Coneflower' })])

    const commonName = await screen.findByDisplayValue('Coneflower')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Saved.')).toBeInTheDocument()

    await user.type(commonName, ' variant')
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument()
  })

  it('deletes the Plant after confirmation', async () => {
    const user = userEvent.setup()
    const fake = renderAt('/registry/p1', [row({ id: 'p1' })])
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    await screen.findByDisplayValue('Coneflower')
    await user.click(screen.getByRole('button', { name: 'Delete Plant' }))

    await waitFor(() => expect(fake.rows()).toHaveLength(0))
  })

  it('does not delete the Plant when the confirmation is declined', async () => {
    const user = userEvent.setup()
    const fake = renderAt('/registry/p1', [row({ id: 'p1' })])
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    await screen.findByDisplayValue('Coneflower')
    await user.click(screen.getByRole('button', { name: 'Delete Plant' }))

    expect(fake.rows()).toHaveLength(1)
  })
})

describe('PlantFormPage — reference photos', () => {
  it('blocks removing a photo while another field is invalid, and never touches storage', async () => {
    const user = userEvent.setup()
    const fake = renderAt('/registry/p1', [
      row({ id: 'p1', reference_photo_paths: ['user-1/plant-1/existing.jpg'] }),
    ])

    await screen.findByDisplayValue('Coneflower')
    await user.type(screen.getByLabelText('USDA hardiness zone'), 'not-a-zone')
    await user.click(screen.getByRole('button', { name: 'Remove photo' }))

    expect(
      await screen.findByText('Fix the highlighted fields above, then remove photos again.'),
    ).toBeInTheDocument()
    expect(fake.storage.remove).not.toHaveBeenCalled()
    expect(fake.rows()[0].reference_photo_paths).toEqual(['user-1/plant-1/existing.jpg'])
  })

  it('rolls back an uploaded photo when the row fails validation before it can be saved', async () => {
    const user = userEvent.setup()
    const fake = renderAt('/registry/p1', [row({ id: 'p1' })])

    await screen.findByDisplayValue('Coneflower')
    await user.type(screen.getByLabelText('USDA hardiness zone'), 'not-a-zone')
    const file = new File(['data'], 'tag.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByLabelText('Add reference photos'), file)

    expect(
      await screen.findByText('Fix the highlighted fields above, then add photos again.'),
    ).toBeInTheDocument()
    expect(fake.storage.remove).toHaveBeenCalled()
    expect(fake.rows()[0].reference_photo_paths).toEqual([])
  })
})

describe('PlantFormPage — care task templates', () => {
  it('lists existing care task templates', async () => {
    renderAt(
      '/registry/p1',
      [row({ id: 'p1' })],
      [
        careTaskTemplateRow({ id: 't1', plant_id: 'p1', name: 'Prune' }),
        careTaskTemplateRow({
          id: 't2',
          plant_id: 'p1',
          name: 'Winterize',
          trigger_type: 'seasonal-marker',
          date_start_month: null,
          date_start_day: null,
          date_end_month: null,
          date_end_day: null,
          seasonal_marker_text: 'After first hard frost',
        }),
      ],
    )

    expect(await screen.findByText('Prune', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('After first hard frost', { exact: false })).toBeInTheDocument()
  })

  it('rejects adding a task template without selecting a trigger type', async () => {
    const user = userEvent.setup()
    const fake = renderAt('/registry/p1', [row({ id: 'p1' })])

    await screen.findByDisplayValue('Coneflower')
    await user.type(screen.getByLabelText('Name'), 'Prune')
    await user.click(screen.getByRole('button', { name: 'Add task template' }))

    expect(await screen.findByText('Select a trigger type.')).toBeInTheDocument()
    expect(fake.careTaskTemplateRows()).toHaveLength(0)
  })

  it('adds a date-range task template and shows it in the list', async () => {
    const user = userEvent.setup()
    const fake = renderAt('/registry/p1', [row({ id: 'p1' })])

    await screen.findByDisplayValue('Coneflower')
    await user.type(screen.getByLabelText('Name'), 'Prune')
    await user.selectOptions(screen.getByLabelText('Trigger type'), 'date-range')
    await user.type(screen.getByLabelText('Trigger start month'), '4')
    await user.type(screen.getByLabelText('Trigger start day'), '1')
    await user.type(screen.getByLabelText('Trigger end month'), '4')
    await user.type(screen.getByLabelText('Trigger end day'), '15')
    await user.click(screen.getByRole('button', { name: 'Add task template' }))

    await waitFor(() => expect(fake.careTaskTemplateRows()).toHaveLength(1))
    expect(fake.careTaskTemplateRows()[0]).toMatchObject({
      plant_id: 'p1',
      name: 'Prune',
      trigger_type: 'date-range',
      date_start_month: 4,
      date_start_day: 1,
      date_end_month: 4,
      date_end_day: 15,
    })
    expect(await screen.findByText('Prune', { exact: false })).toBeInTheDocument()
  })

  it('adds a seasonal-marker task template', async () => {
    const user = userEvent.setup()
    const fake = renderAt('/registry/p1', [row({ id: 'p1' })])

    await screen.findByDisplayValue('Coneflower')
    await user.type(screen.getByLabelText('Name'), 'Winterize')
    await user.selectOptions(screen.getByLabelText('Trigger type'), 'seasonal-marker')
    await user.type(screen.getByLabelText('Seasonal marker text'), 'After first hard frost')
    await user.click(screen.getByRole('button', { name: 'Add task template' }))

    await waitFor(() => expect(fake.careTaskTemplateRows()).toHaveLength(1))
    expect(fake.careTaskTemplateRows()[0]).toMatchObject({
      trigger_type: 'seasonal-marker',
      seasonal_marker_text: 'After first hard frost',
    })
  })

  it('removes a care task template', async () => {
    const user = userEvent.setup()
    const fake = renderAt(
      '/registry/p1',
      [row({ id: 'p1' })],
      [careTaskTemplateRow({ id: 't1', plant_id: 'p1', name: 'Prune' })],
    )

    await screen.findByText('Prune', { exact: false })
    await user.click(screen.getByRole('button', { name: 'Remove Prune' }))

    await waitFor(() => expect(fake.careTaskTemplateRows()).toHaveLength(0))
    expect(screen.queryByText('Prune', { exact: false })).not.toBeInTheDocument()
  })
})
