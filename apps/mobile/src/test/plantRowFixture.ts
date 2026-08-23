import type { PlantRow } from '@plant-app/domain'

export function plantRow(overrides: Partial<PlantRow> = {}): PlantRow {
  return {
    id: 'plant-existing',
    common_name: 'Coneflower',
    scientific_name: 'Echinacea purpurea',
    cultivar: null,
    flower_color: null,
    bloom_start_month: null,
    bloom_start_day: null,
    bloom_end_month: null,
    bloom_end_day: null,
    sun_requirement: null,
    mature_height_inches: null,
    mature_spread_inches: null,
    hardiness_zone_min: null,
    hardiness_zone_max: null,
    foliage_type: null,
    native_status: null,
    reference_photo_paths: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
