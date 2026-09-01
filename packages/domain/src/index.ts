export { DASHBOARD_TILES } from "./dashboard.js";
export type { DashboardTile } from "./dashboard.js";

export { MONTH_NAMES, formatMonthDay, formatOption, plantLabel } from "./plantDisplay.js";

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
  pixelsPerFootForProperty,
  propertyFromRow,
  propertyInputToRow,
  validatePropertyInput,
} from "./property.js";
export type {
  AddressCandidate,
  BaseMapSource,
  Property,
  PropertyInput,
  PropertyRow,
  PropertyValidationErrors,
  PropertyValidationResult,
  ZoomProbeResult,
} from "./property.js";

export {
  derivePixelsPerFootFromScaleReference,
  validateScaleReferenceInput,
} from "./scaleReference.js";
export type {
  ScalePoint,
  ScaleReferenceInput,
  ScaleReferenceMode,
  ScaleReferenceValidationErrors,
  ScaleReferenceValidationResult,
} from "./scaleReference.js";

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

export {
  bloomWindowIncludesMonth,
  bloomWindowWraps,
  buildBloomTimelineBars,
  dayOfYear,
  filterBloomTimelineBarsByMonth,
} from "./bloomTimeline.js";
export type { BloomTimelineBar } from "./bloomTimeline.js";

export { filterRegistryEntries } from "./registry.js";
export type { RegistryFilters } from "./registry.js";

export {
  buildPlantingTaskHistory,
  taskCompletionFromRow,
  taskCompletionInputToRow,
  validateTaskCompletionInput,
} from "./taskCompletion.js";
export type {
  PlantingTaskHistoryEntry,
  TaskCompletion,
  TaskCompletionInput,
  TaskCompletionRow,
  TaskCompletionStatus,
  TaskCompletionValidationErrors,
  TaskCompletionValidationResult,
} from "./taskCompletion.js";

export {
  oneOffTodoFromRow,
  oneOffTodoInputToRow,
  validateOneOffTodoInput,
} from "./oneOffTodo.js";
export type {
  OneOffTodo,
  OneOffTodoInput,
  OneOffTodoRow,
  OneOffTodoValidationErrors,
  OneOffTodoValidationResult,
} from "./oneOffTodo.js";

export {
  EMPTY_PLANT_FORM_FIELDS,
  plantFormFieldsFromPlant,
  plantInputFromFormFields,
} from "./plantFormFields.js";
export type { PlantFormFields } from "./plantFormFields.js";
