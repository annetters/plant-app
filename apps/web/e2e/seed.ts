import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * The QA account these tests own. Everything under it is deleted and
 * re-seeded on every run, so it must never be an account with real garden
 * data in it — see `assertThrowawayAccount`.
 */
export const QA_EMAIL = process.env.E2E_EMAIL ?? 'plant-app-e2e-qa@example.com'
export const QA_PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-qa-password-1234'

/**
 * The guard that makes the wipe below safe. A mistyped `E2E_EMAIL` pointing
 * at the user's real account would otherwise cascade away every Property,
 * Bed, Planting and photo they own — the exact hazard that makes
 * fresh-Property QA need a throwaway account in the first place.
 */
function assertThrowawayAccount(email: string): void {
  if (!/e2e|qa|test/i.test(email)) {
    throw new Error(
      `Refusing to seed against "${email}": it doesn't look like a throwaway QA account. ` +
        `These tests DELETE every Plant, Property, Bed and Planting on the account they run as. ` +
        `Set E2E_EMAIL to a dedicated QA account.`,
    )
  }
}

/** Reads the same VITE_* vars the app itself uses, straight from .env.local. */
function readEnv(): { url: string; anonKey: string } {
  const raw = readFileSync(resolve(here, '../.env.local'), 'utf8')
  const values = new Map<string, string>()
  for (const line of raw.split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match) values.set(match[1], match[2].trim())
  }
  const url = values.get('VITE_SUPABASE_URL')
  const anonKey = values.get('VITE_SUPABASE_ANON_KEY')
  if (!url || !anonKey) throw new Error('apps/web/.env.local is missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  return { url, anonKey }
}

/**
 * Signs in as the QA account, creating it on first run. Email confirmation is
 * off on this project, so signUp returns a usable session immediately.
 */
export async function signInAsQaAccount(): Promise<{ client: SupabaseClient; userId: string }> {
  assertThrowawayAccount(QA_EMAIL)
  const { url, anonKey } = readEnv()
  const client = createClient(url, anonKey, { auth: { persistSession: false } })

  const signIn = await client.auth.signInWithPassword({ email: QA_EMAIL, password: QA_PASSWORD })
  if (signIn.data.session) return { client, userId: signIn.data.session.user.id }

  const signUp = await client.auth.signUp({ email: QA_EMAIL, password: QA_PASSWORD })
  if (signUp.error) throw new Error(`Could not sign in or sign up the QA account: ${signUp.error.message}`)
  if (!signUp.data.session) {
    throw new Error(
      'Sign-up returned no session. Email confirmation may have been re-enabled on this project, ' +
        'which this seed path assumes is off.',
    )
  }
  return { client, userId: signUp.data.session.user.id }
}

/**
 * Deletes everything the QA account owns. Plantings and Beds go via their
 * Property's `on delete cascade`, so removing the Property is enough — but
 * Plants are owned directly and need their own delete.
 */
export async function wipeAccount(client: SupabaseClient, userId: string): Promise<void> {
  const property = await client.from('properties').delete().eq('user_id', userId)
  if (property.error) throw new Error(`Could not clear the QA Property: ${property.error.message}`)
  const plants = await client.from('plants').delete().eq('user_id', userId)
  if (plants.error) throw new Error(`Could not clear the QA Plants: ${plants.error.message}`)
}

/**
 * Six Plants deliberately spread across every axis #10's filter checklist
 * exercises: two sun requirements that share a prefix ('full-sun' /
 * 'full-shade'), both foliage types, both native statuses, bloom windows in
 * different months, one Plant with no bloom window at all, and common names
 * whose alphabetical order differs from insertion order so the ordering
 * assertion is not trivially satisfied.
 */
export const SEED_PLANTS = [
  {
    common_name: 'Purple Coneflower',
    scientific_name: 'Echinacea purpurea',
    cultivar: null,
    flower_color: 'purple',
    bloom_start_month: 6,
    bloom_start_day: 15,
    bloom_end_month: 8,
    bloom_end_day: 31,
    sun_requirement: 'full-sun',
    foliage_type: 'deciduous',
    native_status: 'native',
  },
  {
    common_name: 'Black-eyed Susan',
    scientific_name: 'Rudbeckia fulgida',
    cultivar: 'Goldsturm',
    flower_color: 'yellow',
    bloom_start_month: 7,
    bloom_start_day: 1,
    bloom_end_month: 9,
    bloom_end_day: 30,
    sun_requirement: 'full-sun',
    foliage_type: 'deciduous',
    native_status: 'native',
  },
  {
    common_name: 'Hosta',
    scientific_name: 'Hosta sieboldiana',
    cultivar: null,
    flower_color: 'white',
    bloom_start_month: 7,
    bloom_start_day: 1,
    bloom_end_month: 7,
    bloom_end_day: 31,
    sun_requirement: 'full-shade',
    foliage_type: 'deciduous',
    native_status: 'non-native',
  },
  {
    common_name: 'Astilbe',
    scientific_name: 'Astilbe chinensis',
    cultivar: null,
    flower_color: 'pink',
    bloom_start_month: 6,
    bloom_start_day: 1,
    bloom_end_month: 7,
    bloom_end_day: 15,
    sun_requirement: 'part-shade',
    foliage_type: 'deciduous',
    native_status: 'non-native',
  },
  {
    // No bloom window and no flower color: the Plant that must DISAPPEAR
    // from every bloom-month and color filter, not merely rank lower.
    common_name: 'Boxwood',
    scientific_name: 'Buxus sempervirens',
    cultivar: null,
    flower_color: null,
    bloom_start_month: null,
    bloom_start_day: null,
    bloom_end_month: null,
    bloom_end_day: null,
    sun_requirement: 'part-sun',
    foliage_type: 'evergreen',
    native_status: 'non-native',
  },
  {
    common_name: 'Wild Ginger',
    scientific_name: 'Asarum canadense',
    cultivar: null,
    flower_color: 'brown',
    bloom_start_month: 4,
    bloom_start_day: 1,
    bloom_end_month: 5,
    bloom_end_day: 15,
    sun_requirement: 'full-shade',
    foliage_type: 'evergreen',
    native_status: 'native',
  },
  // The three below exist so the three-axis intersection test is not
  // vacuous. Wild Ginger above is the only full-shade + evergreen + native
  // Plant; without these, ANY TWO of those three filters already isolated
  // it, so the third contributed nothing and a broken filter still passed.
  // A mutation run (disabling the native-status filter) is what caught that.
  // Each of these makes exactly one axis load-bearing:
  {
    // full-shade + evergreen, but NOT native -> makes the native filter matter.
    common_name: 'Japanese Sedge',
    scientific_name: 'Carex oshimensis',
    cultivar: null,
    flower_color: null,
    bloom_start_month: null,
    bloom_start_day: null,
    bloom_end_month: null,
    bloom_end_day: null,
    sun_requirement: 'full-shade',
    foliage_type: 'evergreen',
    native_status: 'non-native',
  },
  {
    // full-shade + native, but NOT evergreen -> makes the foliage filter matter.
    common_name: 'Mayapple',
    scientific_name: 'Podophyllum peltatum',
    cultivar: null,
    flower_color: 'white',
    bloom_start_month: 4,
    bloom_start_day: 15,
    bloom_end_month: 5,
    bloom_end_day: 31,
    sun_requirement: 'full-shade',
    foliage_type: 'deciduous',
    native_status: 'native',
  },
  {
    // evergreen + native, but NOT full-shade -> makes the sun filter matter.
    common_name: 'Inkberry',
    scientific_name: 'Ilex glabra',
    cultivar: null,
    flower_color: null,
    bloom_start_month: null,
    bloom_start_day: null,
    bloom_end_month: null,
    bloom_end_day: null,
    sun_requirement: 'part-sun',
    foliage_type: 'evergreen',
    native_status: 'native',
  },
] as const

/** Common names in the order the Registry should list them (Postgres sorts on `common_name`). */
export const SEED_PLANTS_ALPHABETICAL = [
  'Astilbe',
  'Black-eyed Susan (Goldsturm)',
  'Boxwood',
  'Hosta',
  'Inkberry',
  'Japanese Sedge',
  'Mayapple',
  'Purple Coneflower',
  'Wild Ginger',
]

/** How many Plants the seed creates. Kept here so a change to SEED_PLANTS doesn't silently leave stale counts in the specs. */
export const SEED_PLANT_COUNT = SEED_PLANTS.length

export async function seedPlants(client: SupabaseClient, userId: string): Promise<Map<string, string>> {
  const rows = SEED_PLANTS.map((plant) => ({ ...plant, user_id: userId }))
  const inserted = await client.from('plants').insert(rows).select('id, common_name')
  if (inserted.error) throw new Error(`Could not seed Plants: ${inserted.error.message}`)
  return new Map(inserted.data.map((row) => [row.common_name as string, row.id as string]))
}

/**
 * A Property with two Beds and three Plantings, enough for #10 item 2's map
 * links: one Plant planted in two different Beds (so it shows two links) and
 * one planted in a single Bed. Inserted directly rather than through the
 * address-geocoding Edge Function — this checklist is about the Registry's
 * links, not about Property creation, which #5's QA already covered.
 */
export async function seedPropertyWithPlantings(
  client: SupabaseClient,
  userId: string,
  plantIds: Map<string, string>,
): Promise<{ propertyId: string; bedIds: Map<string, string>; plantingIds: string[] }> {
  const property = await client
    .from('properties')
    .insert({
      user_id: userId,
      address: '1 QA Test Way, Cambridge, MA',
      latitude: 42.3736,
      longitude: -71.1097,
      imagery_zoom: 20,
      imagery_available: true,
      base_map_source: 'aerial',
    })
    .select('id')
    .single()
  if (property.error) throw new Error(`Could not seed the Property: ${property.error.message}`)
  const propertyId = property.data.id as string

  const square = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 20 },
    { x: 0, y: 20 },
  ]
  const offsetSquare = square.map((p) => ({ x: p.x + 40, y: p.y }))

  const beds = await client
    .from('beds')
    .insert([
      { property_id: propertyId, name: 'Front Border', tool: 'rectangle', points: square, smoothing_enabled: false },
      { property_id: propertyId, name: 'Shade Bed', tool: 'rectangle', points: offsetSquare, smoothing_enabled: false },
    ])
    .select('id, name')
  if (beds.error) throw new Error(`Could not seed Beds: ${beds.error.message}`)
  const bedIds = new Map(beds.data.map((row) => [row.name as string, row.id as string]))

  const hostaId = plantIds.get('Hosta')
  const coneflowerId = plantIds.get('Purple Coneflower')
  if (!hostaId || !coneflowerId) throw new Error('Seeded Plants are missing the ones the Planting seed needs')

  // Explicit, distinct created_at values. The Planting list is ordered by
  // created_at (plantingsRepository), and inserting these in one statement
  // gives them all the same timestamp — a tie Postgres then breaks
  // arbitrarily, which surfaced as a link order that differed between
  // browser runs. A gardener saves Plantings one at a time, so distinct
  // timestamps are both the realistic case and the deterministic one.
  const base = Date.parse('2026-01-01T00:00:00Z')
  const at = (minutes: number) => new Date(base + minutes * 60_000).toISOString()

  const plantings = await client
    .from('plantings')
    .insert([
      // Hosta in BOTH Beds — the "more than one link" case.
      { plant_id: hostaId, bed_id: bedIds.get('Front Border'), quantity: 3, year_acquired: 2023, source_nursery: 'QA Nursery', pin_x: 10, pin_y: 10, created_at: at(0) },
      { plant_id: hostaId, bed_id: bedIds.get('Shade Bed'), quantity: 5, year_acquired: 2024, source_nursery: 'QA Nursery', pin_x: 50, pin_y: 10, created_at: at(1) },
      // Purple Coneflower in one Bed — the single-link case.
      { plant_id: coneflowerId, bed_id: bedIds.get('Front Border'), quantity: 1, year_acquired: 2022, source_nursery: 'QA Nursery', pin_x: 5, pin_y: 15, created_at: at(2) },
    ])
    .select('id')
  if (plantings.error) throw new Error(`Could not seed Plantings: ${plantings.error.message}`)

  return { propertyId, bedIds, plantingIds: plantings.data.map((row) => row.id as string) }
}
