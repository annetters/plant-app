import { DELETE_PROPERTY_CONFIRMATION } from '@plant-app/domain'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

/**
 * A trigger that opens the dialog, so focus-return can be asserted against a
 * real element the user actually came from — the same shape every caller has.
 */
function Harness({ onConfirm = vi.fn(), busy = false }: { onConfirm?: () => void; busy?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open the confirmation
      </button>
      <input aria-label="outside the dialog" />
      {open && (
        <ConfirmDialog
          copy={DELETE_PROPERTY_CONFIRMATION}
          busy={busy}
          onConfirm={() => {
            onConfirm()
            setOpen(false)
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  )
}

async function open() {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Open the confirmation' }))
  return user
}

describe('ConfirmDialog', () => {
  it('shows the shared wording, including what the gardener keeps', async () => {
    await open()

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(DELETE_PROPERTY_CONFIRMATION.heading)
    expect(dialog).toHaveTextContent(DELETE_PROPERTY_CONFIRMATION.body)
    expect(dialog).toHaveTextContent(DELETE_PROPERTY_CONFIRMATION.reassurance!)
  })

  it('is a modal dialog labelled by its own heading', async () => {
    await open()

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName(DELETE_PROPERTY_CONFIRMATION.heading)
  })

  it('confirms only when the confirm control is actually clicked', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<Harness onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: 'Open the confirmation' }))

    expect(onConfirm).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: DELETE_PROPERTY_CONFIRMATION.confirmAction }),
    )
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('closes without confirming when cancelled', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<Harness onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: 'Open the confirmation' }))
    await user.click(
      screen.getByRole('button', { name: DELETE_PROPERTY_CONFIRMATION.cancelAction }),
    )

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes without confirming on Escape', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<Harness onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: 'Open the confirmation' }))
    await user.keyboard('{Escape}')

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('moves focus into the dialog, landing on cancel rather than the destructive control', async () => {
    await open()

    expect(
      screen.getByRole('button', { name: DELETE_PROPERTY_CONFIRMATION.cancelAction }),
    ).toHaveFocus()
  })

  it('traps Tab inside the dialog, wrapping from the last control to the first', async () => {
    const user = await open()
    const cancel = screen.getByRole('button', { name: DELETE_PROPERTY_CONFIRMATION.cancelAction })
    const confirm = screen.getByRole('button', { name: DELETE_PROPERTY_CONFIRMATION.confirmAction })

    await user.tab()
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
  })

  it('traps Shift+Tab too, wrapping backwards from the first control to the last', async () => {
    const user = await open()
    const confirm = screen.getByRole('button', { name: DELETE_PROPERTY_CONFIRMATION.confirmAction })

    await user.tab({ shift: true })
    expect(confirm).toHaveFocus()
  })

  it('returns focus to the trigger when it closes', async () => {
    const user = await open()
    const trigger = screen.getByRole('button', { name: 'Open the confirmation' })

    await user.keyboard('{Escape}')

    expect(trigger).toHaveFocus()
  })

  it('disables both controls while the delete is in flight, so the same press cannot land twice', async () => {
    const user = userEvent.setup()
    render(<Harness busy />)
    await user.click(screen.getByRole('button', { name: 'Open the confirmation' }))

    expect(
      screen.getByRole('button', { name: DELETE_PROPERTY_CONFIRMATION.confirmAction }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: DELETE_PROPERTY_CONFIRMATION.cancelAction }),
    ).toBeDisabled()
  })

  it('ignores Escape while the delete is in flight', async () => {
    const user = userEvent.setup()
    render(<Harness busy />)
    await user.click(screen.getByRole('button', { name: 'Open the confirmation' }))
    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
