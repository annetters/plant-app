import type { PlantRow } from '@plant-app/domain'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PlantsRepositoryProvider } from '../plants/PlantsRepositoryContext'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { plantRow as row } from '../test/plantRowFixture'
import { PlantsPage } from './PlantsPage'

function renderPage(rows: PlantRow[] = []) {
  const { client } = createFakePlantsDbClient(rows)
  render(
    <MemoryRouter>
      <PlantsRepositoryProvider client={client}>
        <PlantsPage />
      </PlantsRepositoryProvider>
    </MemoryRouter>,
  )
}

describe('PlantsPage', () => {
  it('lists each Plant by common and scientific name, linking to its detail page', async () => {
    renderPage([
      row({ id: 'p1', common_name: 'Coneflower', scientific_name: 'Echinacea purpurea' }),
      row({ id: 'p2', common_name: 'Joe Pye Weed', scientific_name: 'Eutrochium purpureum' }),
    ])

    const link = await screen.findByRole('link', { name: /Coneflower.*Echinacea purpurea/ })
    expect(link).toHaveAttribute('href', '/registry/p1')
    expect(screen.getByRole('link', { name: /Joe Pye Weed/ })).toBeInTheDocument()
  })

  it('shows an empty state when there are no plants yet', async () => {
    renderPage([])
    expect(await screen.findByText('No plants yet — add your first one.')).toBeInTheDocument()
  })

  it('links to the Add Plant page', async () => {
    renderPage([])
    expect(screen.getByRole('link', { name: 'Add Plant' })).toHaveAttribute('href', '/registry/new')
  })
})
