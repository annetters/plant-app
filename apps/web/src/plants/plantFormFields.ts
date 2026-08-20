import type { FoliageType, NativeStatus, Plant, PlantInput, SunRequirement } from '@plant-app/domain'

/** All-string, all-controlled-input representation of a Plant form — converted to/from PlantInput at the edges. */
export interface PlantFormFields {
  commonName: string
  scientificName: string
  cultivar: string
  flowerColor: string
  bloomStartMonth: string
  bloomStartDay: string
  bloomEndMonth: string
  bloomEndDay: string
  sunRequirement: SunRequirement | ''
  matureHeightInches: string
  matureSpreadInches: string
  hardinessZone: string
  foliageType: FoliageType | ''
  nativeStatus: NativeStatus | ''
}

export const EMPTY_PLANT_FORM_FIELDS: PlantFormFields = {
  commonName: '',
  scientificName: '',
  cultivar: '',
  flowerColor: '',
  bloomStartMonth: '',
  bloomStartDay: '',
  bloomEndMonth: '',
  bloomEndDay: '',
  sunRequirement: '',
  matureHeightInches: '',
  matureSpreadInches: '',
  hardinessZone: '',
  foliageType: '',
  nativeStatus: '',
}

export function plantFormFieldsFromPlant(plant: Plant): PlantFormFields {
  return {
    commonName: plant.commonName,
    scientificName: plant.scientificName,
    cultivar: plant.cultivar ?? '',
    flowerColor: plant.flowerColor ?? '',
    bloomStartMonth: plant.bloomWindow ? String(plant.bloomWindow.start.month) : '',
    bloomStartDay: plant.bloomWindow ? String(plant.bloomWindow.start.day) : '',
    bloomEndMonth: plant.bloomWindow ? String(plant.bloomWindow.end.month) : '',
    bloomEndDay: plant.bloomWindow ? String(plant.bloomWindow.end.day) : '',
    sunRequirement: plant.sunRequirement ?? '',
    matureHeightInches: plant.matureHeightInches !== undefined ? String(plant.matureHeightInches) : '',
    matureSpreadInches: plant.matureSpreadInches !== undefined ? String(plant.matureSpreadInches) : '',
    hardinessZone: plant.hardinessZone ?? '',
    foliageType: plant.foliageType ?? '',
    nativeStatus: plant.nativeStatus ?? '',
  }
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
  ].some((value) => value !== '')

  return {
    commonName: fields.commonName,
    scientificName: fields.scientificName,
    ...(fields.cultivar !== '' && { cultivar: fields.cultivar }),
    ...(fields.flowerColor !== '' && { flowerColor: fields.flowerColor }),
    ...(bloomWindowStarted && {
      bloomWindow: {
        start: { month: Number(fields.bloomStartMonth), day: Number(fields.bloomStartDay) },
        end: { month: Number(fields.bloomEndMonth), day: Number(fields.bloomEndDay) },
      },
    }),
    ...(fields.sunRequirement !== '' && { sunRequirement: fields.sunRequirement }),
    ...(fields.matureHeightInches !== '' && {
      matureHeightInches: Number(fields.matureHeightInches),
    }),
    ...(fields.matureSpreadInches !== '' && {
      matureSpreadInches: Number(fields.matureSpreadInches),
    }),
    ...(fields.hardinessZone !== '' && { hardinessZone: fields.hardinessZone }),
    ...(fields.foliageType !== '' && { foliageType: fields.foliageType }),
    ...(fields.nativeStatus !== '' && { nativeStatus: fields.nativeStatus }),
    referencePhotoPaths,
  }
}
