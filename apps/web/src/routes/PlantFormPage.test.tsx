import type { PlantRow } from '@plant-app/domain'
import { DELETE_PLANT_CONFIRMATION } from '@plant-app/domain'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PlantsRepositoryProvider } from '../plants/PlantsRepositoryContext'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { plantRow as row } from '../test/plantRowFixture'
import { PlantFormPage } from './PlantFormPage'

/** Stands in for the Map page, so a test can see which Plant the duplicate offer sent it to add a Planting against. */
function MapProbe() {
  const [searchParams] = useSearchParams()
  return <p>map page, adding for: {searchParams.get('addPlantingForPlantId') ?? 'nobody'}</p>
}

/**
 * Breaks only the whole-table listing the duplicate check depends on —
 * `get`/`create`/`update` still work, so a test can see what the form does
 * when it can't find out which Plants already exist.
 */
function failListingPlants(fake: ReturnType<typeof createFakePlantsDbClient>) {
  const originalFrom = fake.client.from.bind(fake.client)
  vi.spyOn(fake.client, 'from').mockImplementation(((table: 'plants') => {
    const real = originalFrom(table)
    if (table !== 'plants') return real
    return {
      ...real,
      select: () => ({
        order: () => Promise.resolve({ data: null, error: { message: 'network error' } }),
      }),
    }
  }) as typeof fake.client.from)
}

function renderAt(
  path: string,
  rows: PlantRow[] = [],
  { failPlantListing = false }: { failPlantListing?: boolean } = {},
) {
  const fake = createFakePlantsDbClient(rows)
  if (failPlantListing) failListingPlants(fake)
  render(
    <MemoryRouter initialEntries={[path]}>
      <PlantsRepositoryProvider client={fake.client}>
        <Routes>
          <Route path="/registry/new" element={<PlantFormPage />} />
          <Route path="/registry/:plantId" element={<PlantFormPage />} />
          <Route path="/map" element={<MapProbe />} />
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

  it('rejects a common name, cultivar, or flower color with no letters', async () => {
    const user = userEvent.setup()
    const fake = renderAt('/registry/new')

    await user.type(screen.getByLabelText('Common name *'), '000')
    await user.type(screen.getByLabelText('Scientific name *'), 'Echinacea purpurea')
    await user.type(screen.getByLabelText('Cultivar'), '000')
    await user.type(screen.getByLabelText('Flower color'), '000')
    await user.click(screen.getByRole('button', { name: 'Add Plant' }))

    expect(await screen.findByText('Common name must include a letter.')).toBeInTheDocument()
    expect(screen.getByText('Cultivar must include a letter.')).toBeInTheDocument()
    expect(screen.getByText('Flower color must include a letter.')).toBeInTheDocument()
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

  // These replace two tests that stubbed `window.confirm` to return false and
  // called that "the confirmation is declined". A *suppressed* dialog returns
  // the same value, so they passed for the wrong reason and the bug #47 was
  // filed for was invisible to them. Nothing below stubs a global.
  it('asks first, in the page rather than through a browser dialog', async () => {
    const user = userEvent.setup()
    const fake = renderAt('/registry/p1', [row({ id: 'p1' })])

    await screen.findByDisplayValue('Coneflower')
    await user.click(screen.getByRole('button', { name: 'Delete Plant' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(DELETE_PLANT_CONFIRMATION.heading)
    // Deleting a Plant reaches the map too, because its Plantings go with it.
    expect(dialog).toHaveTextContent(DELETE_PLANT_CONFIRMATION.body)
    expect(fake.rows()).toHaveLength(1)
  })

  it('deletes the Plant when the confirmation is confirmed', async () => {
    const user = userEvent.setup()
    const fake = renderAt('/registry/p1', [row({ id: 'p1' })])

    await screen.findByDisplayValue('Coneflower')
    await user.click(screen.getByRole('button', { name: 'Delete Plant' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: DELETE_PLANT_CONFIRMATION.confirmAction,
      }),
    )

    await waitFor(() => expect(fake.rows()).toHaveLength(0))
  })

  it('keeps the Plant when the confirmation is dismissed', async () => {
    const user = userEvent.setup()
    const fake = renderAt('/registry/p1', [row({ id: 'p1' })])

    await screen.findByDisplayValue('Coneflower')
    await user.click(screen.getByRole('button', { name: 'Delete Plant' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: DELETE_PLANT_CONFIRMATION.cancelAction,
      }),
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fake.rows()).toHaveLength(1)
  })

  it('keeps the Plant when the confirmation is dismissed with Escape', async () => {
    const user = userEvent.setup()
    const fake = renderAt('/registry/p1', [row({ id: 'p1' })])

    await screen.findByDisplayValue('Coneflower')
    await user.click(screen.getByRole('button', { name: 'Delete Plant' }))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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
    await user.clear(screen.getByLabelText('Common name *'))
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
    await user.clear(screen.getByLabelText('Common name *'))
    const file = new File(['data'], 'tag.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByLabelText('Add reference photos'), file)

    expect(
      await screen.findByText('Fix the highlighted fields above, then add photos again.'),
    ).toBeInTheDocument()
    expect(fake.storage.remove).toHaveBeenCalled()
    expect(fake.rows()[0].reference_photo_paths).toEqual([])
  })
})

describe('PlantFormPage — duplicate Plant check', () => {
  const beeBalm = { id: 'p1', common_name: 'Bee balm', scientific_name: 'Monarda didyma' }

  async function submitBeeBalm(fake: ReturnType<typeof renderAt>) {
    const user = userEvent.setup()
    await waitFor(() =>
      expect(screen.queryByText(/Checking your existing Plants/)).not.toBeInTheDocument(),
    )
    await user.type(screen.getByLabelText('Common name *'), 'Bee balm')
    await user.type(screen.getByLabelText('Scientific name *'), 'Monarda didyma')
    await user.click(screen.getByRole('button', { name: 'Add Plant' }))
    return { user, fake }
  }

  it('offers the existing Plant instead of writing a duplicate', async () => {
    const fake = renderAt('/registry/new', [row(beeBalm)])

    await submitBeeBalm(fake)

    expect(await screen.findByText('You already have this Plant')).toBeInTheDocument()
    expect(screen.getByText("Bee balm (Monarda didyma)")).toBeInTheDocument()
    expect(fake.rows()).toHaveLength(1) // the existing one, and nothing new
  })

  it('creates anyway when the gardener says this really is a different Plant', async () => {
    const fake = renderAt('/registry/new', [row(beeBalm)])

    const { user } = await submitBeeBalm(fake)
    await user.click(
      await screen.findByRole('button', { name: 'This is a different Plant — create it anyway' }),
    )

    await waitFor(() => expect(fake.rows()).toHaveLength(2))
    expect(fake.rows()[1]).toMatchObject({ common_name: 'Bee balm', scientific_name: 'Monarda didyma' })
  })

  it('goes back to the form with nothing written when the gardener chooses to edit', async () => {
    const fake = renderAt('/registry/new', [row(beeBalm)])

    const { user } = await submitBeeBalm(fake)
    await user.click(await screen.findByRole('button', { name: 'Go back and edit' }))

    expect(screen.getByLabelText('Common name *')).toHaveValue('Bee balm')
    expect(screen.queryByText('You already have this Plant')).not.toBeInTheDocument()
    expect(fake.rows()).toHaveLength(1)
  })

  it('offers a Planting against the matched Plant on the map — CONTEXT.md\'s alternative to a second record', async () => {
    const fake = renderAt('/registry/new', [row(beeBalm)])

    const { user } = await submitBeeBalm(fake)
    await user.click(
      await screen.findByRole('button', { name: 'Add a Planting against this Plant' }),
    )

    expect(await screen.findByText(/map page, adding for: p1/)).toBeInTheDocument()
    expect(fake.rows()).toHaveLength(1)
  })

  it('matches on genus+species+cultivar, so a named cultivar is not a duplicate of the straight species', async () => {
    const fake = renderAt('/registry/new', [row(beeBalm)])
    const user = userEvent.setup()

    await waitFor(() =>
      expect(screen.queryByText(/Checking your existing Plants/)).not.toBeInTheDocument(),
    )
    await user.type(screen.getByLabelText('Common name *'), 'Bee balm')
    await user.type(screen.getByLabelText('Scientific name *'), 'Monarda didyma')
    await user.type(screen.getByLabelText('Cultivar'), 'Jacob Cline')
    await user.click(screen.getByRole('button', { name: 'Add Plant' }))

    await waitFor(() => expect(fake.rows()).toHaveLength(2))
    expect(screen.queryByText('You already have this Plant')).not.toBeInTheDocument()
  })

  it('degrades to "no known duplicates" rather than blocking the form when the Plant list cannot be loaded', async () => {
    const fake = renderAt('/registry/new', [row(beeBalm)], { failPlantListing: true })

    await submitBeeBalm(fake)

    await waitFor(() => expect(fake.rows()).toHaveLength(2))
    expect(screen.queryByText('You already have this Plant')).not.toBeInTheDocument()
  })

  it('does not run the check when editing an existing Plant — it is already its own record', async () => {
    const user = userEvent.setup()
    const fake = renderAt('/registry/p1', [row(beeBalm)])

    const commonName = await screen.findByDisplayValue('Bee balm')
    await user.clear(commonName)
    await user.type(commonName, 'Scarlet bee balm')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Saved.')).toBeInTheDocument()
    expect(fake.rows()).toHaveLength(1)
  })
})
