import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createFakePropertiesDbClient } from '../test/fakePropertiesDbClient'
import { AddressAutocomplete } from './AddressAutocomplete'
import { PropertiesRepositoryProvider } from './PropertiesRepositoryContext'

function renderAutocomplete(onSelect = vi.fn()) {
  const fake = createFakePropertiesDbClient(null)
  render(
    <PropertiesRepositoryProvider client={fake.client}>
      <AddressAutocomplete onSelect={onSelect} />
    </PropertiesRepositoryProvider>,
  )
  return { ...fake, onSelect }
}

describe('AddressAutocomplete', () => {
  it('does not search below the minimum query length', async () => {
    const { invoke } = renderAutocomplete()
    await userEvent.type(screen.getByRole('combobox'), '10')
    // Give any (wrongly-fired) debounce time to resolve before asserting.
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(invoke).not.toHaveBeenCalled()
  })

  it('searches after the minimum length and lists candidates', async () => {
    renderAutocomplete()
    await userEvent.type(screen.getByRole('combobox'), '10 main st')

    const options = await screen.findAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('10 main st (candidate 1)')
    expect(options[1]).toHaveTextContent('10 main st (candidate 2)')
  })

  it('selects a candidate by clicking it, filling the input and calling onSelect', async () => {
    const { onSelect } = renderAutocomplete()
    const input = screen.getByRole('combobox')
    await userEvent.type(input, '10 main st')

    const [firstOption] = await screen.findAllByRole('option')
    await userEvent.click(firstOption)

    expect(input).toHaveValue('10 main st (candidate 1)')
    expect(onSelect).toHaveBeenCalledWith({
      address: '10 main st',
      candidate: { displayName: '10 main st (candidate 1)', latitude: 42.3782, longitude: -71.1266 },
    })
  })

  it('selects a candidate via keyboard (ArrowDown, ArrowDown, Enter)', async () => {
    const { onSelect } = renderAutocomplete()
    const input = screen.getByRole('combobox')
    await userEvent.type(input, '10 main st')
    await screen.findAllByRole('option')

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(onSelect).toHaveBeenLastCalledWith({
      address: '10 main st',
      candidate: { displayName: '10 main st (candidate 2)', latitude: 40.7128, longitude: -74.006 },
    })
    expect(input).toHaveValue('10 main st (candidate 2)')
  })

  it('clears the confirmed selection when the input is edited again after picking', async () => {
    const { onSelect } = renderAutocomplete()
    const input = screen.getByRole('combobox')
    await userEvent.type(input, '10 main st')
    const [firstOption] = await screen.findAllByRole('option')
    await userEvent.click(firstOption)
    onSelect.mockClear()

    await userEvent.type(input, ' extra')

    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('clears the previous query\'s candidates immediately on further typing, before the new search resolves', async () => {
    renderAutocomplete()
    const input = screen.getByRole('combobox')
    await userEvent.type(input, '10 main st')
    await screen.findAllByRole('option') // first search's results are up

    await userEvent.type(input, ' more')
    // Asserted immediately, well inside the new 300ms debounce window — the
    // previous query's options must already be gone rather than staying
    // stale and clickable until the next search resolves.
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('shows a no-matches message when the search returns nothing', async () => {
    renderAutocomplete()
    await userEvent.type(screen.getByRole('combobox'), 'noresults avenue')

    expect(await screen.findByText('No matches found.')).toBeInTheDocument()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('shows an error message when the search fails', async () => {
    const { invoke } = renderAutocomplete()
    invoke.mockResolvedValueOnce({
      data: { error: 'Could not reach the geocoding service. Try again.' },
      error: null,
    })

    await userEvent.type(screen.getByRole('combobox'), '10 main st')

    expect(
      await screen.findByText('Could not reach the geocoding service. Try again.'),
    ).toBeInTheDocument()
  })
})
