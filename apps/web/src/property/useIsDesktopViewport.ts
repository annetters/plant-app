import { useEffect, useState } from 'react'
import { readIsDesktopViewport } from './isDesktopViewport'

/** Bed creation is desktop-only (ADR-0001) — re-evaluated on resize/pointer changes so a window resized mid-session updates live, not just on reload. */
export function useIsDesktopViewport(): boolean {
  const [isDesktop, setIsDesktop] = useState(readIsDesktopViewport)

  useEffect(() => {
    const update = () => setIsDesktop(readIsDesktopViewport())
    window.addEventListener('resize', update)
    const pointerQuery = window.matchMedia?.('(pointer: coarse)')
    pointerQuery?.addEventListener('change', update)
    return () => {
      window.removeEventListener('resize', update)
      pointerQuery?.removeEventListener('change', update)
    }
  }, [])

  return isDesktop
}
