import type { Plant } from '@plant-app/domain'

/** A Plant's display label — its common name, with the cultivar appended in parentheses when set. Shared by any UI listing Plants (the map's Pin list and details panel, the Registry). */
export function plantLabel(plant: Plant | undefined): string {
  if (!plant) return 'Unknown plant'
  return plant.cultivar ? `${plant.commonName} (${plant.cultivar})` : plant.commonName
}
