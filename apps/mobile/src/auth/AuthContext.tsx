import type { AuthChangeEvent, AuthError, Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type AuthChangeCallback = (event: AuthChangeEvent, session: Session | null) => void

export interface AuthClient {
  auth: {
    onAuthStateChange(callback: AuthChangeCallback): {
      data: { subscription: { unsubscribe(): void } }
    }
    signUp(params: {
      email: string
      password: string
      options?: { emailRedirectTo?: string }
    }): Promise<{
      data: { user: User | null; session: Session | null }
      error: AuthError | null
    }>
    signInWithPassword(params: { email: string; password: string }): Promise<{
      data: { user: User | null; session: Session | null }
      error: AuthError | null
    }>
    signOut(): Promise<{ error: AuthError | null }>
  }
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  status: AuthStatus
  user: User | null
  signUp(
    email: string,
    password: string,
    options?: { emailRedirectTo?: string },
  ): Promise<{ error: AuthError | null }>
  logIn(email: string, password: string): Promise<{ error: AuthError | null }>
  logOut(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** `undefined` = not yet resolved, `null` = resolved with no session. */
type SessionState = Session | null | undefined

export function AuthProvider({ client, children }: { client: AuthClient; children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(undefined)

  useEffect(() => {
    // onAuthStateChange fires once immediately with the current session
    // (INITIAL_SESSION), then again on every subsequent change — a single
    // subscription is the one source of truth, so nothing else writes here.
    const { data: subscription } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [client])

  const value = useMemo<AuthContextValue>(
    () => ({
      status: session === undefined ? 'loading' : session ? 'authenticated' : 'unauthenticated',
      user: session?.user ?? null,
      signUp: async (email, password, options) => {
        const { error } = await client.auth.signUp({
          email,
          password,
          ...(options ? { options } : {}),
        })
        return { error }
      },
      logIn: async (email, password) => {
        const { error } = await client.auth.signInWithPassword({ email, password })
        return { error }
      },
      logOut: async () => {
        try {
          await client.auth.signOut()
        } catch {
          // Auth state is driven entirely by onAuthStateChange above, so a
          // failed remote sign-out simply leaves the user authenticated
          // until they retry, rather than desyncing local state from it.
        }
      },
    }),
    [client, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return value
}
