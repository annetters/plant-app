import { describe, expect, it } from 'vitest'
import { isDesktopViewport } from './isDesktopViewport'

describe('isDesktopViewport', () => {
  it('is desktop at a wide viewport with a fine (mouse/trackpad) pointer', () => {
    expect(isDesktopViewport(1440, false)).toBe(true)
  })

  it('is not desktop when the primary pointer is coarse (touch), even at a wide viewport', () => {
    expect(isDesktopViewport(1440, true)).toBe(false)
  })

  it('is not desktop below the minimum width, even with a fine pointer', () => {
    expect(isDesktopViewport(600, false)).toBe(false)
  })

  it('is desktop right at the minimum width threshold', () => {
    expect(isDesktopViewport(900, false)).toBe(true)
  })
})
