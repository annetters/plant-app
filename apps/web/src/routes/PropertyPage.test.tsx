import type { PropertyRow } from '@plant-app/domain'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { BedsRepositoryProvider } from '../property/BedsRepositoryContext'
import { PropertiesRepositoryProvider } from '../property/PropertiesRepositoryContext'
import { createFakeBedsDbClient } from '../test/fakeBedsDbClient'
import { createFakePropertiesDbClient } from '../test/fakePropertiesDbClient'
import { PropertyPage } from './PropertyPage'

function renderPage(initialRow: PropertyRow | null = null) {
  const fake = createFakePropertiesDbClient(initialRow)
  const beds = createFakeBedsDbClient([])
  render(
    <MemoryRouter>
      <PropertiesRepositoryProvider client={fake.client}>
        <BedsRepositoryProvider client={beds.client}>
          <PropertyPage />
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
    render(
      <MemoryRouter>
        <PropertiesRepositoryProvider client={fake.client}>
          <BedsRepositoryProvider client={beds.client}>
            <PropertyPage />
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
})
