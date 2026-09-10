import type { BaseMapCalibration } from '@plant-app/domain'
import { GRID_SPACING_CHOICES_FEET, defaultGridSpacingFeet } from '@plant-app/domain'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

interface MeasurementGridState {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  spacingFeet: number
  setSpacingFeet: (spacingFeet: number) => void
  /**
   * The scale the grid is drawn against, passed in rather than derived here
   * — the Property page states the same scale in words just above the map,
   * and the two must be describing one calculation, not two that happen to
   * agree today.
   */
  calibration: BaseMapCalibration | null
}

/**
 * Deliberately optional (`null` when absent), like
 * `useOptionalPropertiesRepository`: `BedEditor` and `PlantingMap` are
 * rendered on their own in their own tests, and a map surface with no grid
 * control above it should simply not draw a grid rather than throw.
 */
const MeasurementGridContext = createContext<MeasurementGridState | null>(null)

export function useOptionalMeasurementGrid(): MeasurementGridState | null {
  return useContext(MeasurementGridContext)
}

/**
 * The on/off state and square size for #28's measurement grid, held once for
 * the whole page rather than per map surface — `PropertyPage` shows the
 * preview, the Bed editor and the Plantings map one under another, and a
 * grid that meant a different distance on each of them would be worse than
 * no grid at all.
 */
export function MeasurementGridProvider({
  calibration,
  children,
}: {
  calibration: BaseMapCalibration | null
  children: ReactNode
}) {
  const [enabled, setEnabled] = useState(false)
  // `null` means "whatever suits the current scale". Kept as an absence
  // rather than resolved into state up front so that recalibrating a
  // Property re-picks a sensible spacing on its own, without an effect
  // watching the scale to reset it.
  const [chosenSpacingFeet, setSpacingFeet] = useState<number | null>(null)

  const pixelsPerFoot = calibration?.calibrated ? calibration.pixelsPerFoot : null

  const value = useMemo<MeasurementGridState>(
    () => ({
      enabled,
      setEnabled,
      spacingFeet:
        chosenSpacingFeet ??
        (pixelsPerFoot === null
          ? GRID_SPACING_CHOICES_FEET[0]
          : defaultGridSpacingFeet(pixelsPerFoot)),
      setSpacingFeet,
      calibration,
    }),
    [enabled, chosenSpacingFeet, pixelsPerFoot, calibration],
  )

  return <MeasurementGridContext.Provider value={value}>{children}</MeasurementGridContext.Provider>
}
