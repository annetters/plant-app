import type { PlantingRow } from '@plant-app/domain'

export function plantingRow(overrides: Partial<PlantingRow> = {}): PlantingRow {
  return {
    id: 'planting-existing',
    plant_id: 'plant-existing',
    bed_id: 'bed-existing',
    quantity: 1,
    year_acquired: null,
    source_nursery: null,
    pin_x: 0,
    pin_y: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
