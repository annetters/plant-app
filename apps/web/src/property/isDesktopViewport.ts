/**
 * Bed creation is desktop-only (ADR-0001 — touchscreen freehand tracing of
 * precise outlines was evaluated and rejected as impractical). A coarse
 * (touch) primary pointer is the actual signal for "not desktop" — a narrow
 * *browser window* on a real desktop should still work, so width alone
 * isn't the gate; it's a secondary signal for phone-sized viewports that
 * don't report a pointer type reliably in tests/older browsers.
 */
const MIN_DESKTOP_WIDTH_PX = 900

export function isDesktopViewport(width: number, hasCoarsePrimaryPointer: boolean): boolean {
  if (hasCoarsePrimaryPointer) return false
  return width >= MIN_DESKTOP_WIDTH_PX
}

export function readIsDesktopViewport(): boolean {
  const hasCoarsePrimaryPointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  return isDesktopViewport(window.innerWidth, hasCoarsePrimaryPointer)
}
