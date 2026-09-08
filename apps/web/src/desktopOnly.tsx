import { useIsDesktopViewport } from './property/useIsDesktopViewport'

/**
 * Copy for the two different things a phone-sized browser has to be told,
 * which are deliberately *not* the same message.
 *
 * ADR-0003 splits the platforms: the web app is the desktop surface, the
 * React Native app is the phone surface. A mobile browser is neither — it
 * isn't a supported way to use this app, so the notice points at the phone
 * app rather than pretending the site is a phone experience.
 *
 * Drawing is the exception that must NOT point at the phone app. Freehand
 * bed outlines and the in-app drawn base plan are desktop-*browser*-only
 * (ADR-0001 tried touchscreen tracing and rejected it; ADR-0003 kept that
 * as the one gap in native parity), so the native app deliberately doesn't
 * offer them either. Telling a gardener to "use the app" for drawing would
 * send them somewhere the feature doesn't exist.
 */
export const DESKTOP_ONLY = {
  appNotice:
    'This is the desktop app. On a phone, use the plant-app iPhone app instead — it has everything here, and placing Pins is built for touch.',
  drawing:
    "Drawing isn't available in a mobile browser. Use a desktop browser with a mouse or trackpad — tracing a shape by finger isn't accurate enough, which is why the iPhone app doesn't offer drawing either.",
} as const

/**
 * A standing, non-blocking notice on any phone-sized browser. Nothing is
 * gated behind it on purpose: opening a link on a phone without the app to
 * hand should still show the Registry and the Timeline rather than a dead
 * end. It sets the expectation; it doesn't enforce it.
 */
export function MobileBrowserNotice() {
  const isDesktop = useIsDesktopViewport()
  if (isDesktop) return null
  return <p role="status">{DESKTOP_ONLY.appNotice}</p>
}
