import { useLinkingURL } from 'expo-linking'
import { useEffect } from 'react'
import { createSessionFromUrl, type SessionSettableClient } from './authDeepLink'

/**
 * Completes sign-in for links that open the app from outside — an
 * email-confirmation or magic-link redirect — by handing the tokens in the
 * URL to Supabase. useLinkingURL() covers both a cold start from the link
 * and the app already running, so nothing else needs to listen separately.
 * AuthContext picks up the resulting session on its own via
 * onAuthStateChange; this hook doesn't touch auth state directly.
 */
export function useAuthDeepLinkHandler(client: SessionSettableClient) {
  const url = useLinkingURL()

  useEffect(() => {
    if (!url) {
      return
    }
    createSessionFromUrl(client, url).catch((error: unknown) => {
      console.warn('Failed to complete sign-in from link', error)
    })
  }, [client, url])
}
