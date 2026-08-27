/**
 * Registry (#10, see CONTEXT.md): the searchable, filterable Plant list.
 * Every filter axis below is independently optional and combined with AND —
 * a Plant must satisfy every axis present in `RegistryFilters` to survive.
 * Filtering runs client-side over the full Plant list, matching this app's
 * scale (a personal collection of 50-100 plantings), so no server-side
 * search is needed.
 */

import { bloomWindowIncludesMonth } from "./bloomTimeline.js";
import type { FoliageType, NativeStatus, Plant, SunRequirement } from "./plant.js";

export interface RegistryFilters {
  /** Case-insensitive substring match against common name, scientific name, or cultivar. */
  search?: string;
  /** Case-insensitive substring match against flower color. */
  flowerColor?: string;
  /** 1-12 — matches a Plant whose bloom window (wrap-aware) includes this calendar month. */
  bloomMonth?: number;
  sunRequirement?: SunRequirement;
  foliageType?: FoliageType;
  nativeStatus?: NativeStatus;
}

function includesCaseInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}

function matchesSearch(plant: Plant, search: string): boolean {
  return [plant.commonName, plant.scientificName, plant.cultivar]
    .filter((value): value is string => value !== undefined)
    .some((value) => includesCaseInsensitive(value, search));
}

/** Every Plant satisfying every axis present in `filters`. */
export function filterRegistryEntries(plants: readonly Plant[], filters: RegistryFilters): Plant[] {
  return plants.filter((plant) => {
    if (filters.search?.trim() && !matchesSearch(plant, filters.search)) return false;
    if (
      filters.flowerColor?.trim() &&
      (plant.flowerColor === undefined || !includesCaseInsensitive(plant.flowerColor, filters.flowerColor))
    ) {
      return false;
    }
    if (
      filters.bloomMonth !== undefined &&
      (plant.bloomWindow === undefined || !bloomWindowIncludesMonth(plant.bloomWindow, filters.bloomMonth))
    ) {
      return false;
    }
    if (filters.sunRequirement !== undefined && plant.sunRequirement !== filters.sunRequirement) return false;
    if (filters.foliageType !== undefined && plant.foliageType !== filters.foliageType) return false;
    if (filters.nativeStatus !== undefined && plant.nativeStatus !== filters.nativeStatus) return false;
    return true;
  });
}
