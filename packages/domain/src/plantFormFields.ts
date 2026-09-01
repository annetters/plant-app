import type { FoliageType, NativeStatus, Plant, PlantInput, SunRequirement } from "./plant.js";

/** All-string, all-controlled-input representation of a Plant form — converted to/from PlantInput at the edges. */
export interface PlantFormFields {
  commonName: string;
  scientificName: string;
  cultivar: string;
  flowerColor: string;
  bloomStartMonth: string;
  bloomStartDay: string;
  bloomEndMonth: string;
  bloomEndDay: string;
  sunRequirement: SunRequirement | "";
  matureHeightInches: string;
  matureSpreadInches: string;
  hardinessZoneMin: string;
  hardinessZoneMax: string;
  foliageType: FoliageType | "";
  nativeStatus: NativeStatus | "";
}

export const EMPTY_PLANT_FORM_FIELDS: PlantFormFields = {
  commonName: "",
  scientificName: "",
  cultivar: "",
  flowerColor: "",
  bloomStartMonth: "",
  bloomStartDay: "",
  bloomEndMonth: "",
  bloomEndDay: "",
  sunRequirement: "",
  matureHeightInches: "",
  matureSpreadInches: "",
  hardinessZoneMin: "",
  hardinessZoneMax: "",
  foliageType: "",
  nativeStatus: "",
};

export function plantFormFieldsFromPlant(plant: Plant): PlantFormFields {
  return {
    commonName: plant.commonName,
    scientificName: plant.scientificName,
    cultivar: plant.cultivar ?? "",
    flowerColor: plant.flowerColor ?? "",
    bloomStartMonth: plant.bloomWindow ? String(plant.bloomWindow.start.month) : "",
    bloomStartDay: plant.bloomWindow ? String(plant.bloomWindow.start.day) : "",
    bloomEndMonth: plant.bloomWindow ? String(plant.bloomWindow.end.month) : "",
    bloomEndDay: plant.bloomWindow ? String(plant.bloomWindow.end.day) : "",
    sunRequirement: plant.sunRequirement ?? "",
    matureHeightInches: plant.matureHeightInches !== undefined ? String(plant.matureHeightInches) : "",
    matureSpreadInches: plant.matureSpreadInches !== undefined ? String(plant.matureSpreadInches) : "",
    hardinessZoneMin: plant.hardinessZoneRange ? String(plant.hardinessZoneRange.min) : "",
    hardinessZoneMax: plant.hardinessZoneRange ? String(plant.hardinessZoneRange.max) : "",
    foliageType: plant.foliageType ?? "",
    nativeStatus: plant.nativeStatus ?? "",
  };
}

/**
 * `referencePhotoPaths` is threaded in separately rather than kept on
 * PlantFormFields — photo staging/upload is async and keyed by storage
 * path, not a plain string a text input could hold.
 */
export function plantInputFromFormFields(
  fields: PlantFormFields,
  referencePhotoPaths: string[],
): PlantInput {
  const bloomWindowStarted = [
    fields.bloomStartMonth,
    fields.bloomStartDay,
    fields.bloomEndMonth,
    fields.bloomEndDay,
  ].some((value) => value !== "");

  const hardinessZoneRangeStarted =
    fields.hardinessZoneMin !== "" || fields.hardinessZoneMax !== "";

  return {
    commonName: fields.commonName,
    scientificName: fields.scientificName,
    ...(fields.cultivar !== "" && { cultivar: fields.cultivar }),
    ...(fields.flowerColor !== "" && { flowerColor: fields.flowerColor }),
    ...(bloomWindowStarted && {
      bloomWindow: {
        start: { month: Number(fields.bloomStartMonth), day: Number(fields.bloomStartDay) },
        end: { month: Number(fields.bloomEndMonth), day: Number(fields.bloomEndDay) },
      },
    }),
    ...(fields.sunRequirement !== "" && { sunRequirement: fields.sunRequirement }),
    ...(fields.matureHeightInches !== "" && {
      matureHeightInches: Number(fields.matureHeightInches),
    }),
    ...(fields.matureSpreadInches !== "" && {
      matureSpreadInches: Number(fields.matureSpreadInches),
    }),
    ...(hardinessZoneRangeStarted && {
      hardinessZoneRange: {
        min: Number(fields.hardinessZoneMin),
        max: Number(fields.hardinessZoneMax),
      },
    }),
    ...(fields.foliageType !== "" && { foliageType: fields.foliageType }),
    ...(fields.nativeStatus !== "" && { nativeStatus: fields.nativeStatus }),
    referencePhotoPaths,
  };
}
