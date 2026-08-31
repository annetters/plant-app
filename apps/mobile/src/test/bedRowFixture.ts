import type { BedRow } from '@plant-app/domain'

export function bedRow(overrides: Partial<BedRow> = {}): BedRow {
  return {
    id: 'bed-existing',
    property_id: 'property-1',
    name: 'Front border',
    tool: 'freehand',
    points: [],
    smoothing_enabled: true,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
