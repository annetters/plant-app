export { DASHBOARD_TILES } from "./dashboard.js";
export type { DashboardTile } from "./dashboard.js";

export {
  FOLIAGE_TYPES,
  HARDINESS_ZONE_NUMBERS,
  NATIVE_STATUSES,
  SUN_REQUIREMENTS,
  plantFromRow,
  plantInputToRow,
  validatePlantInput,
} from "./plant.js";
export type {
  BloomWindow,
  FoliageType,
  HardinessZoneRange,
  MonthDay,
  NativeStatus,
  Plant,
  PlantInput,
  PlantRow,
  PlantValidationErrors,
  PlantValidationResult,
  SunRequirement,
} from "./plant.js";

export {
  careTaskTemplateFromRow,
  careTaskTemplateInputToRow,
  computeTriggerDateRange,
  dateRangeWraps,
  validateCareTaskTemplateInput,
} from "./careTaskTemplate.js";
export type {
  CareTaskTemplate,
  CareTaskTemplateInput,
  CareTaskTemplateRow,
  CareTaskTemplateValidationErrors,
  CareTaskTemplateValidationResult,
  DateRangeTrigger,
  SeasonalMarkerTrigger,
  TaskTrigger,
} from "./careTaskTemplate.js";

export {
  AERIAL_ZOOM_CANDIDATES,
  aerialTileUrl,
  feetPerPixel,
  lonLatToTile,
  metersPerPixel,
  pickBestZoom,
  pixelsPerFoot,
  propertyFromRow,
  propertyInputToRow,
  validatePropertyInput,
} from "./property.js";
export type {
  AddressCandidate,
  Property,
  PropertyInput,
  PropertyRow,
  PropertyValidationErrors,
  PropertyValidationResult,
  ZoomProbeResult,
} from "./property.js";

export {
  bedFromRow,
  bedInputToRow,
  chaikinSmooth,
  decimatePoints,
  feetToPixels,
  pixelsToFeet,
  smoothBedOutline,
  validateBedInput,
} from "./bed.js";
export type {
  Bed,
  BedInput,
  BedPoint,
  BedRow,
  BedTool,
  BedValidationErrors,
  BedValidationResult,
} from "./bed.js";

export { manualEntryAdapter, resolveCommonName, reviewTagOcrCandidates } from "./tagScanCandidate.js";
export type {
  CommonNameResolution,
  SpeciesNameSummary,
  TagOcrAdapter,
  TagOcrCandidateFields,
  TagOcrSource,
  TagPhotoInput,
  TagScanCandidateReview,
} from "./tagScanCandidate.js";

export { checkForDuplicatePlant, parseScientificName } from "./tagScanMatching.js";
export type { DuplicatePlantCheck, ParsedScientificName, TagScanPlantIdentity } from "./tagScanMatching.js";

export { deriveHardinessZoneFromMinimumTemperatureF, projectUsdaSpeciesTraits } from "./usdaTraits.js";
export type { UsdaCharacteristic, UsdaSpeciesSuggestedTraits } from "./usdaTraits.js";

export { parseOcrTextLines } from "./tagOcrParsing.js";
export type { TagOcrTextObservation } from "./tagOcrParsing.js";

export {
  findBedContainingPoint,
  plantingFromRow,
  plantingInputToRow,
  plantingPhotoFromRow,
  plantingPhotoInputToRow,
  validatePlantingInput,
  validatePlantingPhotoInput,
} from "./planting.js";
export type {
  Planting,
  PlantingInput,
  PlantingPhoto,
  PlantingPhotoInput,
  PlantingPhotoRow,
  PlantingPhotoValidationErrors,
  PlantingPhotoValidationResult,
  PlantingRow,
  PlantingValidationErrors,
  PlantingValidationResult,
} from "./planting.js";
