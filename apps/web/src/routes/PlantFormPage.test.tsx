import type { PlantRow } from '@plant-app/domain'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PlantsRepositoryProvider } from '../plants/PlantsRepositoryContext'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { plantRow as row } from '../test/plantRowFixture'
import { PlantFormPage } from './PlantFormPage'

function renderAt(path: string, rows: PlantRow[] = []) {
  const fake = createFakePlantsDbClient(rows)
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
    await user.click(screen.getByRole('button', { name: 'Remove' }))

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
