import type { DeleteConfirmationCopy } from '@plant-app/domain'
import { useEffect, useRef } from 'react'

/**
 * The one confirmation every destructive web action asks through (#47).
 *
 * **Not `window.confirm`.** Browsers offer a "prevent this page from creating
 * additional dialogs" control, which appears after a page shows several in
 * short succession — exactly what the delete-and-recreate loop produces, since
 * MVP allows one Property per account. Once set, `window.confirm` returns
 * `false` immediately without displaying anything, so the handler returns
 * before any state change and the button is indistinguishable from dead. A
 * suppressed dialog and a declined one are the same value, so there is nothing
 * to branch on and nothing to report.
 *
 * **Not `<dialog>`/`showModal()` either**, despite that element being
 * page content rather than a system dialog and so equally unsuppressible.
 * jsdom 25 ships `HTMLDialogElement` but implements neither `showModal()` nor
 * `close()`, so driving one under test means polyfilling them — and then the
 * focus-trap and Escape tests below would be proving the polyfill works, not
 * this component. Built from plain elements, every behaviour the ticket asks
 * for is our own code and is really exercised. This also keeps it consistent
 * with the in-page duplicate-Plant offer, which is the house pattern.
 *
 * The wording is never passed as a literal — it comes from `@plant-app/domain`
 * so web and native cannot drift apart.
 */
export function ConfirmDialog({
  copy,
  busy,
  onConfirm,
  onCancel,
}: {
  copy: DeleteConfirmationCopy
  /** A delete is in flight: both controls go inert, including Escape, so the same decision can't land twice. */
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Whatever the gardener was on when this opened — restored on close, so
  // dismissing a confirmation puts them back on the button they pressed
  // rather than at the top of the document.
  const triggerRef = useRef<Element | null>(null)
  if (triggerRef.current === null) triggerRef.current = document.activeElement

  useEffect(() => {
    // Cancel, not confirm: the focused control is the one an unthinking Enter
    // presses, and on a destructive dialog that must be the harmless one.
    cancelRef.current?.focus()
    return () => {
      const trigger = triggerRef.current
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus()
    }
  }, [])

  function handleKeyDown(event: React.KeyboardEvent) {
    if (busy) return

    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
      return
    }

    if (event.key !== 'Tab') return

    // Focus trap. Read live rather than at mount: `busy` disables both
    // buttons, and a disabled button is not tabbable.
    const focusable = containerRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (!focusable || focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement

    // Only the two edges need handling — Tab moves correctly on its own in
    // between, and intercepting every press would fight the browser.
    if (event.shiftKey && (active === first || !containerRef.current?.contains(active))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    // The backdrop is a plain element, not a button: clicking away must not
    // answer a destructive question. Only the two controls below do that.
    <div className="confirm-dialog-backdrop">
      {/* The key handler is the focus trap and Escape, which belong on the
          dialog itself rather than on either control. */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-heading"
        className="confirm-dialog"
        onKeyDown={handleKeyDown}
      >
        <h2 id="confirm-dialog-heading">{copy.heading}</h2>
        <p>{copy.body}</p>
        {copy.reassurance && (
          <p>
            <strong>{copy.reassurance}</strong>
          </p>
        )}
        <button type="button" ref={cancelRef} disabled={busy} onClick={onCancel}>
          {copy.cancelAction}
        </button>
        <button type="button" disabled={busy} onClick={onConfirm}>
          {copy.confirmAction}
        </button>
      </div>
    </div>
  )
}
