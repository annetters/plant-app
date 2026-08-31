import type { PropertyRow } from '@plant-app/domain'

export function propertyRow(overrides: Partial<PropertyRow> = {}): PropertyRow {
  return {
    id: 'property-existing',
    address: '1 Main St',
    resolved_address: '1 Main St, Anytown',
    latitude: 40,
    longitude: -70,
    imagery_zoom: 20,
    imagery_available: true,
    base_map_source: 'aerial',
    base_map_photo_path: null,
    base_map_drawing: null,
    scale_reference: null,
    name: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
