import { getQueryParams } from 'expo-auth-session/build/QueryParams'
import type { AuthError, Session } from '@supabase/supabase-js'

export interface SessionSettableClient {
  auth: {
    setSession(params: { access_token: string; refresh_token: string }): Promise<{
      data: { session: Session | null }
      error: AuthError | null
    }>
  }
}

/**
 * Supabase's email-confirmation and magic-link redirects carry the session
 * as `access_token`/`refresh_token` query params (implicit flow) rather than
 * a PKCE `code` — completing sign-in is just handing those to setSession(),
 * which then flows through AuthContext via its existing onAuthStateChange
 * subscription. Returns null for any link that isn't an auth redirect (most
 * incoming URLs), so it's safe to call on every deep link the app receives.
 */
export async function createSessionFromUrl(client: SessionSettableClient, url: string): Promise<Session | null> {
  const { params, errorCode } = getQueryParams(url)
  if (errorCode) {
    throw new Error(errorCode)
  }

  const { access_token, refresh_token } = params
  if (!access_token || !refresh_token) {
    return null
  }

  const { data, error } = await client.auth.setSession({ access_token, refresh_token })
  if (error) {
    throw error
  }
  return data.session
}
