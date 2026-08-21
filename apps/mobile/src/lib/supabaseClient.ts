import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'

function readEnv(name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}. Copy apps/mobile/.env.example to apps/mobile/.env.local and fill in your Supabase project's values.`)
  }
  return value
}

export const supabase: SupabaseClient = createClient(
  readEnv('EXPO_PUBLIC_SUPABASE_URL'),
  readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
)

// Supabase's own token-refresh timer only runs while the app is in the
// foreground; without this, a session left backgrounded past its expiry
// won't refresh until the next explicit auth call.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh()
  } else {
    supabase.auth.stopAutoRefresh()
  }
})
