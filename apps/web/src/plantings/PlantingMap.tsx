import type { Bed, BedPoint, Plant, Planting, PlantingInput, PlantingPhoto, Property } from '@plant-app/domain'
import {
  STAGE_SIZE_PX,
  feetToPixels,
  pixelsPerFootForProperty,
  plantLabel,
  renderedBedOutlines,
  resolvePinDrop,
  validatePlantingInput,
  validatePlantingPhotoInput,
} from '@plant-app/domain'
import Konva from 'konva'
import { useEffect, useRef, useState } from 'react'
import { usePlantsRepository } from '../plants/PlantsRepositoryContext'
import { BaseMapBackground } from '../property/BaseMapBackground'
import { buildOutlineLine } from '../property/bedOutline'
import { useBedsRepository } from '../property/BedsRepositoryContext'
import { usePlantingsRepository } from './PlantingsRepositoryContext'

const BED_STROKE = '#52b788'
const BED_FILL = 'rgba(82,183,136,0.12)'
const PIN_FILL = '#2d6a4f'
const NEW_PIN_FILL = '#e63946'
const PIN_RADIUS_PX = 7
const NEW_PIN_RADIUS_PX = 9

const EMPTY_FORM = {
  plantId: '',
  quantity: '1',
  yearAcquired: '',
  sourceNursery: '',
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * The read-only map view for Plantings (ticket #8): shows every Bed outline
 * and each Planting's Pin, lets a gardener create a Planting by dragging a
 * new Pin directly onto a Bed (no manual coordinates — CONTEXT.md's Pin
 * entry), and tapping an existing Pin (or its list entry) opens that
 * Planting's details, including its dated photo log. Unlike `BedEditor`,
 * this isn't gated to desktop — Pin placement is meant to work identically
 * on desktop and phone.
 */
export function PlantingMap({
  property,
  beds: bedsProp,
  selectPlantingId,
}: {
  property: Property
  /** When provided (e.g. by `PropertyPage`, which also renders `BedEditor` against the same Property), this list is used as-is instead of self-fetching — so a Bed drawn and saved in the sibling editor shows up here immediately, not just after a reload. Omit to self-fetch (used by this component's own tests in isolation). */
  beds?: Bed[]
  /** A Planting to jump straight to once loaded — the Registry's "View on the map" link (#10) lands here via `?plantingId=`, so a gardener reaches that Planting's details without hunting for its Pin. */
  selectPlantingId?: string
}) {
  const bedsRepository = useBedsRepository()
  const plantsRepository = usePlantsRepository()
  const plantingsRepository = usePlantingsRepository()

  const [fetchedBeds, setFetchedBeds] = useState<Bed[]>([])
  const beds = bedsProp ?? fetchedBeds
  const [plants, setPlants] = useState<Plant[]>([])
  const [plantings, setPlantings] = useState<Planting[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [pinFeet, setPinFeet] = useState<BedPoint | null>(null)
  const [resolvedBedId, setResolvedBedId] = useState<string | null>(null)
  const [pinMessage, setPinMessage] = useState<string | null>(
    'Drag the pin onto a Bed to place this Planting.',
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [selectedPlanting, setSelectedPlanting] = useState<Planting | null>(null)
  const [photos, setPhotos] = useState<PlantingPhoto[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({})
  const [newPhotoDate, setNewPhotoDate] = useState(todayIsoDate())
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const bedsLayerRef = useRef<Konva.Layer | null>(null)
  const pinsLayerRef = useRef<Konva.Layer | null>(null)
  const newPinLayerRef = useRef<Konva.Layer | null>(null)
  const newPinPxRef = useRef({ x: STAGE_SIZE_PX / 2, y: STAGE_SIZE_PX / 2 })
  // Which `selectPlantingId` we've already auto-opened — so a `plantings`
  // reference change from an unrelated create/remove elsewhere doesn't
  // reopen a panel the gardener has since closed. Resets only when
  // `selectPlantingId` itself changes to a new value.
  const autoSelectedPlantingIdRef = useRef<string | undefined>(undefined)

  const pixelsPerFootValue = pixelsPerFootForProperty(property)

  useEffect(() => {
    if (bedsProp !== undefined) return
    let cancelled = false
    bedsRepository
      .list(property.id)
      .then((result) => {
        if (!cancelled) setFetchedBeds(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load this Property’s Beds.')
      })
    return () => {
      cancelled = true
    }
  }, [bedsProp, property.id, bedsRepository])

  useEffect(() => {
    let cancelled = false
    plantsRepository
      .list()
      .then((result) => {
        if (!cancelled) setPlants(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load your Plants.')
      })
    return () => {
      cancelled = true
    }
  }, [plantsRepository])

  useEffect(() => {
    if (beds.length === 0) {
      setPlantings([])
      return
    }
    let cancelled = false
    plantingsRepository
      .listByBeds(beds.map((bed) => bed.id))
      .then((result) => {
        if (!cancelled) setPlantings(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load this Property’s Plantings.')
      })
    return () => {
      cancelled = true
    }
  }, [beds, plantingsRepository])

  // Mounts a real Konva stage, mirroring BedEditor's lifecycle — only while
  // there's a scale to draw against.
  useEffect(() => {
    if (!containerRef.current || pixelsPerFootValue === null) return

    const stage = new Konva.Stage({
      container: containerRef.current,
      width: STAGE_SIZE_PX,
      height: STAGE_SIZE_PX,
    })
    const bedsLayer = new Konva.Layer()
    const pinsLayer = new Konva.Layer()
    const newPinLayer = new Konva.Layer()
    stage.add(bedsLayer, pinsLayer, newPinLayer)
    stageRef.current = stage
    bedsLayerRef.current = bedsLayer
    pinsLayerRef.current = pinsLayer
    newPinLayerRef.current = newPinLayer

    return () => {
      stage.destroy()
      stageRef.current = null
      bedsLayerRef.current = null
      pinsLayerRef.current = null
      newPinLayerRef.current = null
    }
  }, [pixelsPerFootValue])

  // Renders Bed outlines, read-only — reuses BedEditor's exact rendering so
  // a Bed looks identical on both surfaces.
  useEffect(() => {
    const layer = bedsLayerRef.current
    if (!layer || pixelsPerFootValue === null) return
    layer.destroyChildren()
    for (const bed of beds) {
      layer.add(
        buildOutlineLine(bed.points, bed.tool, bed.smoothingEnabled, pixelsPerFootValue, {
          stroke: BED_STROKE,
          fill: BED_FILL,
          strokeWidth: 1.5,
        }),
      )
    }
    layer.batchDraw()
  }, [beds, pixelsPerFootValue])

  // Renders every existing Planting's Pin, tappable to open its details.
  useEffect(() => {
    const layer = pinsLayerRef.current
    if (!layer || pixelsPerFootValue === null) return
    layer.destroyChildren()
    for (const planting of plantings) {
      const [px] = feetToPixels([planting.pin], pixelsPerFootValue)
      const circle = new Konva.Circle({
        x: px.x,
        y: px.y,
        radius: PIN_RADIUS_PX,
        fill: PIN_FILL,
        stroke: 'white',
        strokeWidth: 1.5,
      })
      circle.on('click tap', () => handleSelectPlanting(planting))
      layer.add(circle)
    }
    layer.batchDraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantings, pixelsPerFootValue])

  // Renders the draggable new-Pin marker while adding a Planting; resolves
  // which Bed it landed in on every drag, per CONTEXT.md's Pin entry (no
  // manual coordinates, no Bed picker — the drop location decides both).
  useEffect(() => {
    const layer = newPinLayerRef.current
    if (!layer || pixelsPerFootValue === null) return
    layer.destroyChildren()
    if (!adding) {
      layer.batchDraw()
      return
    }

    // Reassigned into its own const so the null-check above narrows it for
    // `resolve` below — TS doesn't carry narrowing of an outer variable
    // into a nested function declaration referenced from a later callback.
    const scale = pixelsPerFootValue
    // Computed once per Bed list, not per drag frame — see `renderedBedOutlines`.
    const outlines = renderedBedOutlines(beds)
    const start = newPinPxRef.current
    const circle = new Konva.Circle({
      x: start.x,
      y: start.y,
      radius: NEW_PIN_RADIUS_PX,
      fill: NEW_PIN_FILL,
      stroke: 'white',
      strokeWidth: 2,
      draggable: true,
    })

    function resolve(x: number, y: number) {
      newPinPxRef.current = { x, y }
      const { feet, bed } = resolvePinDrop({ x, y }, scale, outlines)
      if (bed) {
        setPinFeet(feet)
        setResolvedBedId(bed.id)
        setPinMessage(null)
      } else {
        setResolvedBedId(null)
        setPinMessage('Drop the pin inside a Bed.')
      }
    }

    circle.on('dragmove', () => resolve(circle.x(), circle.y()))
    circle.on('dragend', () => resolve(circle.x(), circle.y()))
    layer.add(circle)
    layer.batchDraw()
    // Resolve the starting position immediately, so re-opening the form
    // where the marker was last left doesn't show a stale message.
    resolve(start.x, start.y)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adding, beds, pixelsPerFootValue])

  function handleSelectPlanting(planting: Planting) {
    setSelectedPlanting(planting)
    setPhotoError(null)
    setNewPhotoDate(todayIsoDate())
  }

  // Jumps straight to the requested Planting once it's loaded — e.g. from
  // the Registry's "View on the map" link (#10). Keeps re-checking as
  // `plantings` loads in, but only ever auto-opens once per
  // `selectPlantingId` (tracked via the ref above) — otherwise a `plantings`
  // reference change from an unrelated create/remove elsewhere (e.g.
  // dropping a new Pin) would reopen a panel the gardener already closed.
  useEffect(() => {
    if (!selectPlantingId) return
    if (autoSelectedPlantingIdRef.current === selectPlantingId) return
    const planting = plantings.find((p) => p.id === selectPlantingId)
    if (planting) {
      handleSelectPlanting(planting)
      autoSelectedPlantingIdRef.current = selectPlantingId
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectPlantingId, plantings])

  useEffect(() => {
    if (!selectedPlanting) {
      setPhotos([])
      return
    }
    let cancelled = false
    plantingsRepository
      .listPhotos(selectedPlanting.id)
      .then((result) => {
        if (!cancelled) setPhotos(result)
      })
      .catch(() => {
        if (!cancelled) setPhotoError('Could not load this Planting’s photo log.')
      })
    return () => {
      cancelled = true
    }
  }, [selectedPlanting, plantingsRepository])

  useEffect(() => {
    let cancelled = false
    Promise.allSettled(
      photos.map(async (photo) => [photo.path, await plantingsRepository.getPhotoUrl(photo.path)] as const),
    ).then((results) => {
      if (cancelled) return
      // Thumbnails are a nice-to-have; one photo's signing failure shouldn't
      // blank out every other photo's already-successful thumbnail.
      const entries = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
      setPhotoPreviews(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [photos, plantingsRepository])

  function handleStartAdding() {
    setAdding(true)
    setForm(EMPTY_FORM)
    setFormError(null)
    newPinPxRef.current = { x: STAGE_SIZE_PX / 2, y: STAGE_SIZE_PX / 2 }
    setPinFeet(null)
    setResolvedBedId(null)
    setPinMessage('Drag the pin onto a Bed to place this Planting.')
  }

  function handleCancelAdding() {
    setAdding(false)
    setFormError(null)
  }

  function updateField<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function buildInput(): PlantingInput | null {
    if (!resolvedBedId || !pinFeet) {
      setFormError('Drop the pin inside a Bed before saving.')
      return null
    }
    const input: PlantingInput = {
      plantId: form.plantId,
      bedId: resolvedBedId,
      quantity: Number(form.quantity),
      pin: pinFeet,
      ...(form.yearAcquired && { yearAcquired: Number(form.yearAcquired) }),
      ...(form.sourceNursery.trim() && { sourceNursery: form.sourceNursery.trim() }),
    }
    return input
  }

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSave() {
    const input = buildInput()
    if (!input) return
    const validation = validatePlantingInput(input)
    if (!validation.ok) {
      setFieldErrors(validation.errors)
      setFormError(Object.values(validation.errors)[0] ?? 'Could not save this Planting.')
      return
    }
    setFieldErrors({})
    setFormError(null)
    setSaving(true)
    try {
      const created = await plantingsRepository.create(input)
      setPlantings((current) => [...current, created])
      setAdding(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save this Planting.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemovePlanting(id: string) {
    try {
      await plantingsRepository.remove(id)
      setPlantings((current) => current.filter((p) => p.id !== id))
      if (selectedPlanting?.id === id) setSelectedPlanting(null)
    } catch {
      setLoadError('Could not remove this Planting.')
    }
  }

  async function handleAddPhoto(fileList: FileList | null) {
    if (!selectedPlanting || !fileList || fileList.length === 0) return
    const file = fileList[0]
    const photoInput = { plantingId: selectedPlanting.id, path: 'pending', takenOn: newPhotoDate }
    const validation = validatePlantingPhotoInput(photoInput)
    if (!validation.ok) {
      setPhotoError(Object.values(validation.errors)[0] ?? 'Could not add this photo.')
      return
    }
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      const photo = await plantingsRepository.addPhoto(selectedPlanting.id, file, newPhotoDate)
      setPhotos((current) => [photo, ...current])
    } catch {
      setPhotoError('Could not upload this photo. Please try again.')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function handleRemovePhoto(photo: PlantingPhoto) {
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      await plantingsRepository.removePhoto(photo.id, photo.path)
      setPhotos((current) => current.filter((p) => p.id !== photo.id))
    } catch {
      setPhotoError('Could not remove this photo. Please try again.')
    } finally {
      setPhotoBusy(false)
    }
  }

  if (pixelsPerFootValue === null) {
    return null
  }

  return (
    <section className="planting-map">
      <h2>Plantings</h2>
      {loadError && <p role="alert">{loadError}</p>}

      {
        // The map surface always mounts once there's a scale to draw
        // against — never gated on beds.length. It used to be conditional
        // on beds.length > 0, which meant the Konva stage-mount effect (it
        // only depends on pixelsPerFootValue, so it runs once) found
        // containerRef.current still null on that first run whenever the
        // Property's Beds hadn't loaded yet — the refs it sets stayed null
        // forever, even after Beds arrived and the container appeared, so
        // no Pin ever resolved into a Bed. Keeping the surface unconditional
        // means the container exists on that very first effect run.
      }
      <div style={{ position: 'relative', width: STAGE_SIZE_PX, height: STAGE_SIZE_PX }}>
        <BaseMapBackground property={property} />
        <div
          ref={containerRef}
          data-testid="planting-map-surface"
          style={{ position: 'absolute', inset: 0 }}
        />
      </div>

      {beds.length === 0 && <p>Draw a Bed first before adding Plantings.</p>}

      {beds.length > 0 && (
        <>
          {!adding ? (
            <button type="button" onClick={handleStartAdding} disabled={plants.length === 0}>
              Add Planting
            </button>
          ) : (
            <section aria-label="Add Planting">
              {pinMessage && <p>{pinMessage}</p>}

              <label htmlFor="planting-plant">Plant *</label>
              <select
                id="planting-plant"
                aria-required="true"
                value={form.plantId}
                onChange={(event) => updateField('plantId', event.target.value)}
              >
                <option value="">Select a Plant</option>
                {plants.map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plantLabel(plant)}
                  </option>
                ))}
              </select>

              <label htmlFor="planting-quantity">Quantity *</label>
              <input
                id="planting-quantity"
                type="number"
                min={1}
                step={1}
                aria-required="true"
                value={form.quantity}
                onChange={(event) => updateField('quantity', event.target.value)}
              />
              {fieldErrors.quantity && <p role="alert">{fieldErrors.quantity}</p>}

              <label htmlFor="planting-year-acquired">Year acquired</label>
              <input
                id="planting-year-acquired"
                type="number"
                value={form.yearAcquired}
                onChange={(event) => updateField('yearAcquired', event.target.value)}
              />
              {fieldErrors.yearAcquired && <p role="alert">{fieldErrors.yearAcquired}</p>}

              <label htmlFor="planting-source-nursery">Source / nursery</label>
              <input
                id="planting-source-nursery"
                value={form.sourceNursery}
                onChange={(event) => updateField('sourceNursery', event.target.value)}
              />

              {formError && <p role="alert">{formError}</p>}

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !form.plantId || !resolvedBedId}
              >
                {saving ? 'Saving…' : 'Save Planting'}
              </button>
              <button type="button" onClick={handleCancelAdding} disabled={saving}>
                Cancel
              </button>
            </section>
          )}

          {plants.length === 0 && <p>Add a Plant to the Registry before creating a Planting.</p>}

          <ul>
            {plantings.map((planting) => {
              const plant = plants.find((p) => p.id === planting.plantId)
              const bed = beds.find((b) => b.id === planting.bedId)
              return (
                <li key={planting.id}>
                  {plantLabel(plant)} ×{planting.quantity}
                  {bed && ` in ${bed.name}`}
                  <button type="button" onClick={() => handleSelectPlanting(planting)}>
                    View {plantLabel(plant)}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${plantLabel(plant)} Planting`}
                    onClick={() => handleRemovePlanting(planting.id)}
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>

          {selectedPlanting && (
            <section aria-label="Planting details">
              <h3>{plantLabel(plants.find((p) => p.id === selectedPlanting.plantId))}</h3>
              <p>Quantity: {selectedPlanting.quantity}</p>
              {selectedPlanting.yearAcquired && <p>Year acquired: {selectedPlanting.yearAcquired}</p>}
              {selectedPlanting.sourceNursery && <p>Source: {selectedPlanting.sourceNursery}</p>}

              <h4>Photo log</h4>
              {photoError && <p role="alert">{photoError}</p>}
              <ul>
                {photos.map((photo) => (
                  <li key={photo.id}>
                    {photoPreviews[photo.path] && (
                      <img src={photoPreviews[photo.path]} alt="" width={96} />
                    )}
                    <span>{photo.takenOn}</span>
                    <button
                      type="button"
                      aria-label={`Remove photo from ${photo.takenOn}`}
                      onClick={() => handleRemovePhoto(photo)}
                      disabled={photoBusy}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>

              <label htmlFor="planting-photo-date">Photo date</label>
              <input
                id="planting-photo-date"
                type="date"
                value={newPhotoDate}
                onChange={(event) => setNewPhotoDate(event.target.value)}
              />
              <label htmlFor="planting-photo-upload">Add a dated photo</label>
              <input
                id="planting-photo-upload"
                type="file"
                accept="image/*"
                disabled={photoBusy}
                onChange={(event) => {
                  void handleAddPhoto(event.target.files)
                  event.target.value = ''
                }}
              />

              <button type="button" onClick={() => setSelectedPlanting(null)}>
                Close
              </button>
            </section>
          )}
        </>
      )}
    </section>
  )
}
