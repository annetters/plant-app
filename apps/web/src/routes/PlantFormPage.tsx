import {
  DELETE_PLANT_CONFIRMATION,
  DUPLICATE_PLANT_OFFER,
  EMPTY_PLANT_FORM_FIELDS,
  FOLIAGE_TYPES,
  HARDINESS_ZONE_NUMBERS,
  NATIVE_STATUSES,
  SUN_REQUIREMENTS,
  checkForDuplicatePlant,
  formatOption,
  plantFormFieldsFromPlant,
  plantIdentityLabel,
  plantInputFromFormFields,
  validatePlantInput,
  type Plant,
  type PlantFormFields,
  type PlantInput,
  type PlantValidationErrors,
} from '@plant-app/domain'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { usePlantsRepository } from '../plants/PlantsRepositoryContext'

export function PlantFormPage() {
  const { plantId } = useParams<{ plantId: string }>()
  const isEditing = Boolean(plantId)
  const repository = usePlantsRepository()
  const navigate = useNavigate()

  const [fields, setFields] = useState<PlantFormFields>(EMPTY_PLANT_FORM_FIELDS)
  const [referencePhotoPaths, setReferencePhotoPaths] = useState<string[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(isEditing)
  const [errors, setErrors] = useState<PlantValidationErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Open state for the delete confirmation — an in-page modal rather than
  // `window.confirm`, which a browser can suppress and answer "no" on the
  // gardener's behalf without showing anything (#47).
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  // Only ever loaded in create mode, and `null` until it arrives — "no Plants
  // yet" and "not known yet" are different answers, and Add Plant waits for
  // the second to become the first before it can run the duplicate check.
  const [existingPlants, setExistingPlants] = useState<Plant[] | null>(isEditing ? [] : null)
  const [duplicateOffer, setDuplicateOffer] = useState<{
    input: PlantInput
    existingPlant: Plant
  } | null>(null)

  useEffect(() => {
    if (!plantId) return
    let cancelled = false
    repository
      .get(plantId)
      .then((plant) => {
        if (cancelled) return
        if (!plant) {
          setFormError('Plant not found.')
          setLoading(false)
          return
        }
        setFields(plantFormFieldsFromPlant(plant))
        setReferencePhotoPaths(plant.referencePhotoPaths)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setFormError('Could not load this plant.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [plantId, repository])

  useEffect(() => {
    let cancelled = false
    Promise.all(
      referencePhotoPaths.map(
        async (path) => [path, await repository.getReferencePhotoUrl(path)] as const,
      ),
    )
      .then((entries) => {
        if (!cancelled) setPhotoPreviews(Object.fromEntries(entries))
      })
      .catch(() => {
        // Thumbnails are a nice-to-have; a signing failure shouldn't block the rest of the page.
      })
    return () => {
      cancelled = true
    }
  }, [referencePhotoPaths, repository])

  /**
   * The registry as it stands, for the duplicate check `handleSubmit` runs
   * (#37). Create only: an existing Plant is already its own record, and
   * would match itself. A failure degrades to "no known duplicates" rather
   * than blocking the form — exactly what Tag Scan's review screen does with
   * the same list, so the two surfaces fail the same way.
   */
  useEffect(() => {
    if (isEditing) return
    let cancelled = false
    repository
      .list()
      .then((plants) => {
        if (!cancelled) setExistingPlants(plants)
      })
      .catch(() => {
        if (!cancelled) setExistingPlants([])
      })
    return () => {
      cancelled = true
    }
  }, [isEditing, repository])

  function updateField<K extends keyof PlantFormFields>(key: K, value: PlantFormFields[K]) {
    setFields((current) => ({ ...current, [key]: value }))
    // An edit invalidates whatever "Saved." confirmation is currently showing.
    setStatusMessage(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const input = validatedInputFor(referencePhotoPaths)
    if (!input) return
    setFormError(null)
    setStatusMessage(null)

    if (!plantId) {
      // CONTEXT.md, Plant: one source of truth per plant type/cultivar. Runs
      // before the write, on the same fields Tag Scan checks, so this form
      // and a scan reach the same verdict about the same plant.
      const duplicate = checkForDuplicatePlant(
        { commonName: input.commonName, scientificName: input.scientificName, cultivar: input.cultivar },
        existingPlants ?? [],
      )
      if (duplicate.status === 'duplicate') {
        setDuplicateOffer({ input, existingPlant: duplicate.existingPlant })
        return
      }
      await createPlant(input)
      return
    }

    setSubmitting(true)
    try {
      await repository.update(plantId, input)
      setStatusMessage('Saved.')
    } catch {
      setFormError('Could not save this plant. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function createPlant(input: PlantInput) {
    setDuplicateOffer(null)
    setSubmitting(true)
    try {
      const created = await repository.create(input)
      navigate(`/registry/${created.id}`, { replace: true })
    } catch {
      setFormError('Could not save this plant. Please try again.')
      setSubmitting(false)
    }
  }

  /**
   * Adding/removing a photo persists the *whole* row, current text fields
   * included — so it must pass the same validation Save does, or an
   * in-progress invalid edit (e.g. a malformed hardiness zone, which has no
   * DB-level check) could be saved silently just by touching a photo.
   */
  function validatedInputFor(nextPaths: string[]): PlantInput | null {
    const input = plantInputFromFormFields(fields, nextPaths)
    const result = validatePlantInput(input)
    if (!result.ok) {
      setErrors(result.errors)
      return null
    }
    setErrors({})
    return input
  }

  async function handleAddPhotos(fileList: FileList | null) {
    if (!plantId || !fileList || fileList.length === 0) return
    setPhotoBusy(true)
    setFormError(null)
    setStatusMessage(null)
    let uploadedPaths: string[] = []
    try {
      uploadedPaths = await Promise.all(
        Array.from(fileList).map((file) => repository.uploadReferencePhoto(plantId, file)),
      )
      const nextPaths = [...referencePhotoPaths, ...uploadedPaths]
      const input = validatedInputFor(nextPaths)
      if (!input) {
        setFormError('Fix the highlighted fields above, then add photos again.')
        throw new Error('Plant fields are invalid.')
      }
      await repository.update(plantId, input)
      setReferencePhotoPaths(nextPaths)
      setStatusMessage(uploadedPaths.length > 1 ? 'Photos added.' : 'Photo added.')
    } catch {
      // Roll back any upload that never made it onto the Plant's row, so a
      // validation or save failure doesn't leave orphaned storage objects.
      if (uploadedPaths.length > 0) {
        await Promise.all(
          uploadedPaths.map((path) => repository.removeReferencePhoto(path).catch(() => {})),
        )
      }
      setFormError((current) => current ?? 'Could not upload one or more photos. Please try again.')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function handleRemovePhoto(path: string) {
    if (!plantId) return
    const nextPaths = referencePhotoPaths.filter((existing) => existing !== path)
    const input = validatedInputFor(nextPaths)
    if (!input) {
      setFormError('Fix the highlighted fields above, then remove photos again.')
      return
    }
    setPhotoBusy(true)
    setFormError(null)
    setStatusMessage(null)
    try {
      // Storage first: if this fails, the Plant row is never touched, so
      // nothing goes out of sync between what's stored and what's referenced.
      await repository.removeReferencePhoto(path)
      await repository.update(plantId, input)
      setReferencePhotoPaths(nextPaths)
      setStatusMessage('Photo removed.')
    } catch {
      setFormError('Could not remove this photo. Please try again.')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function handleDelete() {
    if (!plantId) return
    setSubmitting(true)
    try {
      await repository.remove(plantId)
      navigate('/registry', { replace: true })
    } catch {
      // The confirmation stays open on failure, so the retry is where the
      // gardener already is. On success we navigate away and it goes with
      // the page.
      setFormError('Could not delete this plant. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main>
        <p>Loading…</p>
      </main>
    )
  }

  if (duplicateOffer) {
    // Stands in for the form rather than sitting above it, exactly as the two
    // native paths do — one shape of interruption across all three surfaces.
    // The form's own fields are still in state behind this, unsent, so "go
    // back and edit" costs nothing and never depends on browser history.
    const { input, existingPlant } = duplicateOffer
    return (
      <main>
        <h1>Add Plant</h1>
        <section aria-labelledby="duplicate-plant-heading">
          <h2 id="duplicate-plant-heading">{DUPLICATE_PLANT_OFFER.heading}</h2>
          <p>{plantIdentityLabel(existingPlant)}</p>
          <p>{DUPLICATE_PLANT_OFFER.body}</p>
          {/* A new tab on purpose: the form's typed fields are still held in
              state behind this offer, and navigating this tab away to go and
              look at the existing Plant would throw them away — the same
              reason "go back and edit" never uses browser history. */}
          <p>
            <Link to={`/registry/${existingPlant.id}`} target="_blank" rel="noreferrer">
              {DUPLICATE_PLANT_OFFER.viewExistingAction}
            </Link>
          </p>
          {/* All three disabled while a create is in flight, matching the
              native `DuplicatePlantOffer`: leaving the other two live mid-save
              is how the same press lands twice. */}
          <button
            type="button"
            disabled={submitting}
            onClick={() => navigate(`/map?addPlantingForPlantId=${existingPlant.id}`)}
          >
            {DUPLICATE_PLANT_OFFER.addPlantingAction}
          </button>
          <button type="button" disabled={submitting} onClick={() => setDuplicateOffer(null)}>
            {DUPLICATE_PLANT_OFFER.keepEditingAction}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              void createPlant(input)
            }}
          >
            {DUPLICATE_PLANT_OFFER.createAnywayAction}
          </button>
        </section>
        <Link to="/registry">Back to Registry</Link>
      </main>
    )
  }

  return (
    <main>
      <h1>{isEditing ? fields.commonName || 'Plant' : 'Add Plant'}</h1>

      <form onSubmit={handleSubmit}>
        <p>Fields marked * are required.</p>

        <label htmlFor="plant-common-name">Common name *</label>
        <input
          id="plant-common-name"
          aria-required="true"
          value={fields.commonName}
          onChange={(event) => updateField('commonName', event.target.value)}
        />
        {errors.commonName && <p role="alert">{errors.commonName}</p>}

        <label htmlFor="plant-scientific-name">Scientific name *</label>
        <input
          id="plant-scientific-name"
          aria-required="true"
          value={fields.scientificName}
          onChange={(event) => updateField('scientificName', event.target.value)}
        />
        {errors.scientificName && <p role="alert">{errors.scientificName}</p>}

        <label htmlFor="plant-cultivar">Cultivar</label>
        <input
          id="plant-cultivar"
          value={fields.cultivar}
          onChange={(event) => updateField('cultivar', event.target.value)}
        />
        {errors.cultivar && <p role="alert">{errors.cultivar}</p>}

        <label htmlFor="plant-flower-color">Flower color</label>
        <input
          id="plant-flower-color"
          value={fields.flowerColor}
          onChange={(event) => updateField('flowerColor', event.target.value)}
        />
        {errors.flowerColor && <p role="alert">{errors.flowerColor}</p>}

        <fieldset>
          <legend>Bloom window</legend>
          <div className="date-pair">
            <div>
              <label htmlFor="plant-bloom-start-month">Start month</label>
              <input
                id="plant-bloom-start-month"
                type="number"
                min={1}
                max={12}
                value={fields.bloomStartMonth}
                onChange={(event) => updateField('bloomStartMonth', event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="plant-bloom-start-day">Start day</label>
              <input
                id="plant-bloom-start-day"
                type="number"
                min={1}
                max={31}
                value={fields.bloomStartDay}
                onChange={(event) => updateField('bloomStartDay', event.target.value)}
              />
            </div>
          </div>
          <div className="date-pair">
            <div>
              <label htmlFor="plant-bloom-end-month">End month</label>
              <input
                id="plant-bloom-end-month"
                type="number"
                min={1}
                max={12}
                value={fields.bloomEndMonth}
                onChange={(event) => updateField('bloomEndMonth', event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="plant-bloom-end-day">End day</label>
              <input
                id="plant-bloom-end-day"
                type="number"
                min={1}
                max={31}
                value={fields.bloomEndDay}
                onChange={(event) => updateField('bloomEndDay', event.target.value)}
              />
            </div>
          </div>
          {(errors['bloomWindow.start'] || errors['bloomWindow.end']) && (
            <p role="alert">{errors['bloomWindow.start'] ?? errors['bloomWindow.end']}</p>
          )}
        </fieldset>

        <label htmlFor="plant-sun-requirement">Sun/shade requirement</label>
        <select
          id="plant-sun-requirement"
          value={fields.sunRequirement}
          onChange={(event) =>
            updateField('sunRequirement', event.target.value as PlantFormFields['sunRequirement'])
          }
        >
          <option value="">Not specified</option>
          {SUN_REQUIREMENTS.map((value) => (
            <option key={value} value={value}>
              {formatOption(value)}
            </option>
          ))}
        </select>

        <label htmlFor="plant-mature-height">Mature height (inches)</label>
        <input
          id="plant-mature-height"
          type="number"
          min={0}
          value={fields.matureHeightInches}
          onChange={(event) => updateField('matureHeightInches', event.target.value)}
        />
        {errors.matureHeightInches && <p role="alert">{errors.matureHeightInches}</p>}

        <label htmlFor="plant-mature-spread">Mature spread (inches)</label>
        <input
          id="plant-mature-spread"
          type="number"
          min={0}
          value={fields.matureSpreadInches}
          onChange={(event) => updateField('matureSpreadInches', event.target.value)}
        />
        {errors.matureSpreadInches && <p role="alert">{errors.matureSpreadInches}</p>}

        <fieldset>
          <legend>USDA hardiness zone</legend>
          <label htmlFor="plant-hardiness-zone-min">Min zone</label>
          <select
            id="plant-hardiness-zone-min"
            value={fields.hardinessZoneMin}
            onChange={(event) => updateField('hardinessZoneMin', event.target.value)}
          >
            <option value="">Not specified</option>
            {HARDINESS_ZONE_NUMBERS.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
          <label htmlFor="plant-hardiness-zone-max">Max zone</label>
          <select
            id="plant-hardiness-zone-max"
            value={fields.hardinessZoneMax}
            onChange={(event) => updateField('hardinessZoneMax', event.target.value)}
          >
            <option value="">Not specified</option>
            {HARDINESS_ZONE_NUMBERS.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
          {(errors['hardinessZoneRange.min'] || errors['hardinessZoneRange.max']) && (
            <p role="alert">
              {errors['hardinessZoneRange.min'] ?? errors['hardinessZoneRange.max']}
            </p>
          )}
        </fieldset>

        <label htmlFor="plant-foliage-type">Foliage</label>
        <select
          id="plant-foliage-type"
          value={fields.foliageType}
          onChange={(event) =>
            updateField('foliageType', event.target.value as PlantFormFields['foliageType'])
          }
        >
          <option value="">Not specified</option>
          {FOLIAGE_TYPES.map((value) => (
            <option key={value} value={value}>
              {formatOption(value)}
            </option>
          ))}
        </select>

        <label htmlFor="plant-native-status">Native status</label>
        <select
          id="plant-native-status"
          value={fields.nativeStatus}
          onChange={(event) =>
            updateField('nativeStatus', event.target.value as PlantFormFields['nativeStatus'])
          }
        >
          <option value="">Not specified</option>
          {NATIVE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {formatOption(value)}
            </option>
          ))}
        </select>

        {formError && <p role="alert">{formError}</p>}
        {statusMessage && <p role="status">{statusMessage}</p>}
        {/* The duplicate check can't run until the registry has loaded, so
            Add Plant waits for it rather than writing a Plant the check
            would have caught — the same gate Tag Scan's review screen puts
            on Continue, worded the same way. */}
        {existingPlants === null && <p>{DUPLICATE_PLANT_OFFER.checkingMessage}</p>}

        <button type="submit" disabled={submitting || existingPlants === null}>
          {isEditing ? 'Save changes' : 'Add Plant'}
        </button>
      </form>

      {isEditing && (
        <>
        <hr />

        <section aria-label="Reference photos">
          <h2>Reference photos</h2>
          <ul>
            {referencePhotoPaths.map((path) => (
              <li key={path}>
                {photoPreviews[path] && <img src={photoPreviews[path]} alt="" width={96} />}
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => handleRemovePhoto(path)}
                  disabled={photoBusy}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <label htmlFor="plant-photo-upload">Add reference photos</label>
          <input
            id="plant-photo-upload"
            type="file"
            accept="image/*"
            multiple
            disabled={photoBusy}
            onChange={(event) => {
              void handleAddPhotos(event.target.files)
              event.target.value = ''
            }}
          />
        </section>

        <hr />

        <button type="button" onClick={() => setConfirmingDelete(true)} disabled={submitting}>
          Delete Plant
        </button>
        {confirmingDelete && (
          <ConfirmDialog
            copy={DELETE_PLANT_CONFIRMATION}
            busy={submitting}
            onConfirm={handleDelete}
            onCancel={() => setConfirmingDelete(false)}
          />
        )}
        </>
      )}

      <Link to="/registry">Back to Registry</Link>
    </main>
  )
}
