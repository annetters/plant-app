import type { Session } from '@supabase/supabase-js'
import type { AuthChangeCallback, AuthClient } from '../auth/AuthContext'

/**
 * A fake AuthClient that immediately emits `initialSession` on subscribe —
 * mirroring Supabase's real INITIAL_SESSION behavior — and exposes
 * `emitSession` to simulate later sign-in/sign-out events.
 */
export function createMockAuthClient(initialSession: Session | null = null) {
  let onChange: AuthChangeCallback | null = null

  const client: AuthClient = {
    auth: {
      onAuthStateChange: jest.fn((callback: AuthChangeCallback) => {
        onChange = callback
        queueMicrotask(() => callback('INITIAL_SESSION', initialSession))
        return { data: { subscription: { unsubscribe: jest.fn() } } }
      }),
      signUp: jest.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
      signInWithPassword: jest
        .fn()
        .mockResolvedValue({ data: { user: null, session: null }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  }

  return {
    client,
    emitSession(session: Session | null) {
      onChange?.('SIGNED_IN', session)
    },
  }
}
