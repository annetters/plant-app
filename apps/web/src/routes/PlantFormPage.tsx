import {
  FOLIAGE_TYPES,
  NATIVE_STATUSES,
  SUN_REQUIREMENTS,
  validatePlantInput,
  type PlantInput,
  type PlantValidationErrors,
} from '@plant-app/domain'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  EMPTY_PLANT_FORM_FIELDS,
  plantFormFieldsFromPlant,
  plantInputFromFormFields,
  type PlantFormFields,
} from '../plants/plantFormFields'
import { usePlantsRepository } from '../plants/PlantsRepositoryContext'

function formatOption(value: string): string {
  return value.replace(/-/g, ' ')
}

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
  const [submitting, setSubmitting] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)

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

  function updateField<K extends keyof PlantFormFields>(key: K, value: PlantFormFields[K]) {
    setFields((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const input = validatedInputFor(referencePhotoPaths)
    if (!input) return
    setFormError(null)
    setSubmitting(true)
    try {
      if (plantId) {
        await repository.update(plantId, input)
      } else {
        const created = await repository.create(input)
        navigate(`/registry/${created.id}`, { replace: true })
        return
      }
    } catch {
      setFormError('Could not save this plant. Please try again.')
    } finally {
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
    try {
      // Storage first: if this fails, the Plant row is never touched, so
      // nothing goes out of sync between what's stored and what's referenced.
      await repository.removeReferencePhoto(path)
      await repository.update(plantId, input)
      setReferencePhotoPaths(nextPaths)
    } catch {
      setFormError('Could not remove this photo. Please try again.')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function handleDelete() {
    if (!plantId) return
    if (!window.confirm('Delete this plant? This cannot be undone.')) return
    setSubmitting(true)
    try {
      await repository.remove(plantId)
      navigate('/registry', { replace: true })
    } catch {
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

        <label htmlFor="plant-flower-color">Flower color</label>
        <input
          id="plant-flower-color"
          value={fields.flowerColor}
          onChange={(event) => updateField('flowerColor', event.target.value)}
        />

        <fieldset>
          <legend>Bloom window</legend>
          <label htmlFor="plant-bloom-start-month">Start month</label>
          <input
            id="plant-bloom-start-month"
            type="number"
            min={1}
            max={12}
            value={fields.bloomStartMonth}
            onChange={(event) => updateField('bloomStartMonth', event.target.value)}
          />
          <label htmlFor="plant-bloom-start-day">Start day</label>
          <input
            id="plant-bloom-start-day"
            type="number"
            min={1}
            max={31}
            value={fields.bloomStartDay}
            onChange={(event) => updateField('bloomStartDay', event.target.value)}
          />
          <label htmlFor="plant-bloom-end-month">End month</label>
          <input
            id="plant-bloom-end-month"
            type="number"
            min={1}
            max={12}
            value={fields.bloomEndMonth}
            onChange={(event) => updateField('bloomEndMonth', event.target.value)}
          />
          <label htmlFor="plant-bloom-end-day">End day</label>
          <input
            id="plant-bloom-end-day"
            type="number"
            min={1}
            max={31}
            value={fields.bloomEndDay}
            onChange={(event) => updateField('bloomEndDay', event.target.value)}
          />
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

        <label htmlFor="plant-hardiness-zone">USDA hardiness zone</label>
        <input
          id="plant-hardiness-zone"
          placeholder="e.g. 6a"
          value={fields.hardinessZone}
          onChange={(event) => updateField('hardinessZone', event.target.value)}
        />
        {errors.hardinessZone && <p role="alert">{errors.hardinessZone}</p>}

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

        <button type="submit" disabled={submitting}>
          {isEditing ? 'Save changes' : 'Add Plant'}
        </button>
      </form>

      {isEditing && (
        <section aria-label="Reference photos">
          <h2>Reference photos</h2>
          <ul>
            {referencePhotoPaths.map((path) => (
              <li key={path}>
                {photoPreviews[path] && <img src={photoPreviews[path]} alt="" width={96} />}
                <button type="button" onClick={() => handleRemovePhoto(path)} disabled={photoBusy}>
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
      )}

      {isEditing && (
        <button type="button" onClick={handleDelete} disabled={submitting}>
          Delete Plant
        </button>
      )}

      <Link to="/registry">Back to Registry</Link>
    </main>
  )
}
