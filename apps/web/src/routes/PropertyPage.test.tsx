import type { PropertyRow } from '@plant-app/domain'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PropertiesRepositoryProvider } from '../property/PropertiesRepositoryContext'
import { createFakePropertiesDbClient } from '../test/fakePropertiesDbClient'
import { PropertyPage } from './PropertyPage'

function renderPage(initialRow: PropertyRow | null = null) {
  const fake = createFakePropertiesDbClient(initialRow)
  render(
    <MemoryRouter>
      <PropertiesRepositoryProvider client={fake.client}>
        <PropertyPage />
      </PropertiesRepositoryProvider>
    </MemoryRouter>,
  )
  return fake
}

describe('PropertyPage — no Property yet', () => {
  it('offers an address form', async () => {
    renderPage(null)
    expect(await screen.findByLabelText('Address')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Property' })).toBeInTheDocument()
  })

  it('rejects a blank address without calling the repository', async () => {
    const { invoke } = renderPage(null)
    await screen.findByLabelText('Address')
    await userEvent.click(screen.getByRole('button', { name: 'Create Property' }))
    expect(await screen.findByText('Address is required.')).toBeInTheDocument()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('creates the Property and then renders its base map', async () => {
    renderPage(null)
    await userEvent.type(await screen.findByLabelText('Address'), '10 Main St, Cambridge, MA')
    await userEvent.click(screen.getByRole('button', { name: 'Create Property' }))

    expect(await screen.findByText('10 Main St, Cambridge, MA')).toBeInTheDocument()
    expect(screen.queryByLabelText('Address')).not.toBeInTheDocument()
  })

  it('surfaces a failure from the edge function as a form error', async () => {
    const fake = createFakePropertiesDbClient(null)
    fake.invoke.mockResolvedValueOnce({
      data: { error: 'Could not resolve that address.' },
      error: null,
    })
    render(
      <MemoryRouter>
        <PropertiesRepositoryProvider client={fake.client}>
          <PropertyPage />
        </PropertiesRepositoryProvider>
      </MemoryRouter>,
    )

    await userEvent.type(await screen.findByLabelText('Address'), 'nowhere at all')
    await userEvent.click(screen.getByRole('button', { name: 'Create Property' }))

    expect(await screen.findByText('Could not resolve that address.')).toBeInTheDocument()
  })
})

describe('PropertyPage — existing Property', () => {
  const availableRow: PropertyRow = {
    id: 'property-1',
    address: '10 Main St, Cambridge, MA',
    latitude: 42.3782,
    longitude: -71.1266,
    imagery_zoom: 20,
    imagery_available: true,
    created_at: '2026-01-01T00:00:00.000Z',
  }

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
