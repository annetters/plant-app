import type {
  CareTaskTemplate,
  CareTaskTemplateInput,
  CareTaskTemplateRow,
  Plant,
  PlantInput,
  PlantRow,
} from '@plant-app/domain'
import {
  careTaskTemplateFromRow,
  careTaskTemplateInputToRow,
  plantFromRow,
  plantInputToRow,
} from '@plant-app/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

type Row = Record<string, unknown>
type DbResult<T> = { data: T; error: { message: string } | null }

/** The slice of a Postgrest filter builder the repository actually calls. */
interface PlantsQuery extends PromiseLike<DbResult<unknown>> {
  select(columns?: string): PlantsQuery
  eq(column: string, value: string): PlantsQuery
  order(column: string, options?: { ascending: boolean }): PlantsQuery
  single(): PlantsQuery
  maybeSingle(): PlantsQuery
}

/** The narrow shape of a Supabase client the repository needs — mirrors AuthContext's AuthClient pattern. */
export interface PlantsDbClient {
  from(table: 'plants' | 'care_task_templates'): {
    select(columns?: string): PlantsQuery
    insert(values: Row): PlantsQuery
    update(values: Row): PlantsQuery
    delete(): PlantsQuery
  }
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        file: File,
      ): Promise<{ data: { path: string } | null; error: { message: string } | null }>
      remove(paths: string[]): Promise<{ error: { message: string } | null }>
      createSignedUrl(
        path: string,
        expiresIn: number,
      ): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>
    }
  }
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null }
      error: { message: string } | null
    }>
  }
}

/**
 * `@supabase/supabase-js`'s generated Postgrest builder types are deep
 * conditional/generic types that make TypeScript's structural check against
 * PlantsDbClient blow its recursion budget. The real client satisfies this
 * interface at runtime (it's the standard `.from().select().eq()...` chain
 * every Postgrest builder implements) — this cast exists solely to stop
 * short of that recursion, not to paper over a real shape mismatch.
 */
export function asPlantsDbClient(client: SupabaseClient): PlantsDbClient {
  return client as unknown as PlantsDbClient
}

const TABLE = 'plants'
const CARE_TASK_TEMPLATES_TABLE = 'care_task_templates'
const REFERENCE_PHOTOS_BUCKET = 'plant-reference-photos'

function unwrap<T>({ data, error }: DbResult<unknown>): T {
  if (error) throw new Error(error.message)
  return data as T
}

async function requireUserId(client: PlantsDbClient): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Not authenticated.')
  return data.user.id
}

export class PlantsRepository {
  private readonly client: PlantsDbClient

  constructor(client: PlantsDbClient) {
    this.client = client
  }

  async list(): Promise<Plant[]> {
    const result = unwrap<PlantRow[]>(
      await this.client.from(TABLE).select('*').order('common_name', { ascending: true }),
    )
    return result.map(plantFromRow)
  }

  async get(id: string): Promise<Plant | null> {
    const row = unwrap<PlantRow | null>(
      await this.client.from(TABLE).select('*').eq('id', id).maybeSingle(),
    )
    return row ? plantFromRow(row) : null
  }

  async create(input: PlantInput): Promise<Plant> {
    const userId = await requireUserId(this.client)
    const row = unwrap<PlantRow>(
      await this.client
        .from(TABLE)
        .insert({ ...plantInputToRow(input), user_id: userId })
        .select()
        .single(),
    )
    return plantFromRow(row)
  }

  async update(id: string, input: PlantInput): Promise<Plant> {
    const row = unwrap<PlantRow>(
      await this.client.from(TABLE).update(plantInputToRow(input)).eq('id', id).select().single(),
    )
    return plantFromRow(row)
  }

  async remove(id: string): Promise<void> {
    unwrap(await this.client.from(TABLE).delete().eq('id', id))
  }

  /** Uploads a reference photo and returns its storage path — caller persists the path onto the Plant. */
  async uploadReferencePhoto(plantId: string, file: File): Promise<string> {
    const userId = await requireUserId(this.client)
    const path = `${userId}/${plantId}/${crypto.randomUUID()}-${file.name}`
    const { error } = await this.client.storage.from(REFERENCE_PHOTOS_BUCKET).upload(path, file)
    if (error) throw new Error(error.message)
    return path
  }

  async getReferencePhotoUrl(path: string): Promise<string> {
    const { data, error } = await this.client.storage
      .from(REFERENCE_PHOTOS_BUCKET)
      .createSignedUrl(path, 3600)
    if (error || !data) throw new Error(error?.message ?? 'Could not sign photo URL.')
    return data.signedUrl
  }

  async removeReferencePhoto(path: string): Promise<void> {
    const { error } = await this.client.storage.from(REFERENCE_PHOTOS_BUCKET).remove([path])
    if (error) throw new Error(error.message)
  }

  async listCareTaskTemplates(plantId: string): Promise<CareTaskTemplate[]> {
    const result = unwrap<CareTaskTemplateRow[]>(
      await this.client
        .from(CARE_TASK_TEMPLATES_TABLE)
        .select('*')
        .eq('plant_id', plantId)
        .order('created_at', { ascending: true }),
    )
    return result.map(careTaskTemplateFromRow)
  }

  async createCareTaskTemplate(input: CareTaskTemplateInput): Promise<CareTaskTemplate> {
    const row = unwrap<CareTaskTemplateRow>(
      await this.client
        .from(CARE_TASK_TEMPLATES_TABLE)
        .insert(careTaskTemplateInputToRow(input))
        .select()
        .single(),
    )
    return careTaskTemplateFromRow(row)
  }

  async removeCareTaskTemplate(id: string): Promise<void> {
    unwrap(await this.client.from(CARE_TASK_TEMPLATES_TABLE).delete().eq('id', id))
  }
}
