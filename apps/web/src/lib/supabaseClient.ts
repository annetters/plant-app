import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function readEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy apps/web/.env.example to apps/web/.env.local and fill in your Supabase project's values.`,
    )
  }
  return value
}

export const supabase: SupabaseClient = createClient(
  readEnv('VITE_SUPABASE_URL'),
  readEnv('VITE_SUPABASE_ANON_KEY'),
)
