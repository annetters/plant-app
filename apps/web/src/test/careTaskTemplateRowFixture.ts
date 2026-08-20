import type { CareTaskTemplateRow } from '@plant-app/domain'

export function careTaskTemplateRow(
  overrides: Partial<CareTaskTemplateRow> = {},
): CareTaskTemplateRow {
  return {
    id: 'template-existing',
    plant_id: 'plant-existing',
    name: 'Prune',
    trigger_type: 'date-range',
    date_start_month: 4,
    date_start_day: 1,
    date_end_month: 4,
    date_end_day: 15,
    seasonal_marker_text: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
