import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DESKTOP_ONLY, MobileBrowserNotice } from './desktopOnly'

function setViewport(width: number, coarsePointer: boolean) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('coarse') ? coarsePointer : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

describe('MobileBrowserNotice', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tells a phone browser to use the native app instead', () => {
    setViewport(390, true)
    render(<MobileBrowserNotice />)
    expect(screen.getByRole('status')).toHaveTextContent(DESKTOP_ONLY.appNotice)
  })

  it('says nothing on a desktop viewport', () => {
    setViewport(1440, false)
    render(<MobileBrowserNotice />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('points drawing at a desktop browser, never at the phone app', () => {
    // The distinction that makes these two separate strings: the native app
    // deliberately has no drawing either (ADR-0003's one gap in parity), so
    // sending someone there for it would send them nowhere.
    expect(DESKTOP_ONLY.drawing).toMatch(/desktop browser/i)
    expect(DESKTOP_ONLY.drawing).not.toMatch(/use the .*app/i)
    expect(DESKTOP_ONLY.appNotice).toMatch(/iPhone app/i)
  })
})
