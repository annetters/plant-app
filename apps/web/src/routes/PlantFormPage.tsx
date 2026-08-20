import {
  FOLIAGE_TYPES,
  HARDINESS_ZONE_NUMBERS,
  NATIVE_STATUSES,
  SUN_REQUIREMENTS,
  dateRangeWraps,
  validateCareTaskTemplateInput,
  validatePlantInput,
  type CareTaskTemplate,
  type CareTaskTemplateInput,
  type CareTaskTemplateValidationErrors,
  type PlantInput,
  type PlantValidationErrors,
  type TaskTrigger,
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

function formatTrigger(trigger: TaskTrigger): string {
  if (trigger.type === 'seasonal-marker') return trigger.text
  const { start, end } = trigger
  const range = `${start.month}/${start.day} – ${end.month}/${end.day}`
  return dateRangeWraps(trigger) ? `${range} (wraps to the following year)` : range
}

const EMPTY_TEMPLATE_FORM = {
  name: '',
  triggerType: '' as TaskTrigger['type'] | '',
  startMonth: '',
  startDay: '',
  endMonth: '',
  endDay: '',
  seasonalText: '',
}

/** Whether the in-progress date-range fields represent a wraparound — `false` while any field is still blank. */
function templateFormDateRangeWraps(form: typeof EMPTY_TEMPLATE_FORM): boolean {
  const { startMonth, startDay, endMonth, endDay } = form
  if (!startMonth || !startDay || !endMonth || !endDay) return false
  return dateRangeWraps({
    type: 'date-range',
    start: { month: Number(startMonth), day: Number(startDay) },
    end: { month: Number(endMonth), day: Number(endDay) },
  })
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)

  const [careTaskTemplates, setCareTaskTemplates] = useState<CareTaskTemplate[]>([])
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE_FORM)
  const [templateErrors, setTemplateErrors] = useState<CareTaskTemplateValidationErrors>({})
  const [templateTriggerTypeError, setTemplateTriggerTypeError] = useState<string | null>(null)
  const [templateBusy, setTemplateBusy] = useState(false)
  const [templateFormError, setTemplateFormError] = useState<string | null>(null)
  const [templateStatusMessage, setTemplateStatusMessage] = useState<string | null>(null)

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

  useEffect(() => {
    if (!plantId) return
    let cancelled = false
    repository
      .listCareTaskTemplates(plantId)
      .then((templates) => {
        if (!cancelled) setCareTaskTemplates(templates)
      })
      .catch(() => {
        // Non-fatal, mirroring photo preview loading — the rest of the page still works.
      })
    return () => {
      cancelled = true
    }
  }, [plantId, repository])

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
    setSubmitting(true)
    try {
      if (plantId) {
        await repository.update(plantId, input)
        setStatusMessage('Saved.')
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

  function updateTemplateField<K extends keyof typeof EMPTY_TEMPLATE_FORM>(
    key: K,
    value: (typeof EMPTY_TEMPLATE_FORM)[K],
  ) {
    setTemplateForm((current) => ({ ...current, [key]: value }))
    if (key === 'triggerType') setTemplateTriggerTypeError(null)
    setTemplateStatusMessage(null)
  }

  async function handleAddCareTaskTemplate(event: FormEvent) {
    event.preventDefault()
    if (!plantId) return

    if (templateForm.triggerType === '') {
      setTemplateTriggerTypeError('Select a trigger type.')
      return
    }
    setTemplateTriggerTypeError(null)

    const trigger: TaskTrigger =
      templateForm.triggerType === 'date-range'
        ? {
            type: 'date-range',
            start: { month: Number(templateForm.startMonth), day: Number(templateForm.startDay) },
            end: { month: Number(templateForm.endMonth), day: Number(templateForm.endDay) },
          }
        : { type: 'seasonal-marker', text: templateForm.seasonalText }

    const input: CareTaskTemplateInput = { plantId, name: templateForm.name, trigger }
    const result = validateCareTaskTemplateInput(input)
    if (!result.ok) {
      setTemplateErrors(result.errors)
      return
    }
    setTemplateErrors({})
    setTemplateBusy(true)
    setTemplateFormError(null)
    setTemplateStatusMessage(null)
    try {
      const created = await repository.createCareTaskTemplate(input)
      setCareTaskTemplates((current) => [...current, created])
      setTemplateForm(EMPTY_TEMPLATE_FORM)
      setTemplateStatusMessage('Task template added.')
    } catch {
      setTemplateFormError('Could not add this task template. Please try again.')
    } finally {
      setTemplateBusy(false)
    }
  }

  async function handleRemoveCareTaskTemplate(id: string) {
    setTemplateBusy(true)
    setTemplateFormError(null)
    setTemplateStatusMessage(null)
    try {
      await repository.removeCareTaskTemplate(id)
      setCareTaskTemplates((current) => current.filter((template) => template.id !== id))
      setTemplateStatusMessage('Task template removed.')
    } catch {
      setTemplateFormError('Could not remove this task template. Please try again.')
    } finally {
      setTemplateBusy(false)
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

        <button type="submit" disabled={submitting}>
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

        <section aria-label="Care task templates">
          <h2>Care task templates</h2>
          <ul>
            {careTaskTemplates.map((template) => (
              <li key={template.id}>
                <strong>{template.name}</strong> — {formatTrigger(template.trigger)}
                <button
                  type="button"
                  aria-label={`Remove ${template.name}`}
                  onClick={() => handleRemoveCareTaskTemplate(template.id)}
                  disabled={templateBusy}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={handleAddCareTaskTemplate}>
            <label htmlFor="care-task-name">Name</label>
            <input
              id="care-task-name"
              value={templateForm.name}
              onChange={(event) => updateTemplateField('name', event.target.value)}
            />
            {templateErrors.name && <p role="alert">{templateErrors.name}</p>}

            <label htmlFor="care-task-trigger-type">Trigger type</label>
            <select
              id="care-task-trigger-type"
              value={templateForm.triggerType}
              onChange={(event) =>
                updateTemplateField(
                  'triggerType',
                  event.target.value as (typeof EMPTY_TEMPLATE_FORM)['triggerType'],
                )
              }
            >
              <option value="">Select a trigger type</option>
              <option value="date-range">Fixed date range</option>
              <option value="seasonal-marker">Seasonal marker</option>
            </select>
            {templateTriggerTypeError && <p role="alert">{templateTriggerTypeError}</p>}

            {templateForm.triggerType === 'date-range' && (
              <fieldset>
                <legend>Trigger date range</legend>
                <div className="date-pair">
                  <div>
                    <label htmlFor="care-task-start-month">Trigger start month</label>
                    <input
                      id="care-task-start-month"
                      type="number"
                      min={1}
                      max={12}
                      value={templateForm.startMonth}
                      onChange={(event) => updateTemplateField('startMonth', event.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="care-task-start-day">Trigger start day</label>
                    <input
                      id="care-task-start-day"
                      type="number"
                      min={1}
                      max={31}
                      value={templateForm.startDay}
                      onChange={(event) => updateTemplateField('startDay', event.target.value)}
                    />
                  </div>
                </div>
                <div className="date-pair">
                  <div>
                    <label htmlFor="care-task-end-month">Trigger end month</label>
                    <input
                      id="care-task-end-month"
                      type="number"
                      min={1}
                      max={12}
                      value={templateForm.endMonth}
                      onChange={(event) => updateTemplateField('endMonth', event.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="care-task-end-day">Trigger end day</label>
                    <input
                      id="care-task-end-day"
                      type="number"
                      min={1}
                      max={31}
                      value={templateForm.endDay}
                      onChange={(event) => updateTemplateField('endDay', event.target.value)}
                    />
                  </div>
                </div>
                {(templateErrors['trigger.start'] || templateErrors['trigger.end']) && (
                  <p role="alert">
                    {templateErrors['trigger.start'] ?? templateErrors['trigger.end']}
                  </p>
                )}
                {templateFormDateRangeWraps(templateForm) && (
                  <p>This range wraps into the following year.</p>
                )}
              </fieldset>
            )}

            {templateForm.triggerType === 'seasonal-marker' && (
              <>
                <label htmlFor="care-task-seasonal-text">Seasonal marker text</label>
                <input
                  id="care-task-seasonal-text"
                  placeholder="e.g. After first hard frost"
                  value={templateForm.seasonalText}
                  onChange={(event) => updateTemplateField('seasonalText', event.target.value)}
                />
                {templateErrors['trigger.text'] && <p role="alert">{templateErrors['trigger.text']}</p>}
              </>
            )}

            {templateFormError && <p role="alert">{templateFormError}</p>}
            {templateStatusMessage && <p role="status">{templateStatusMessage}</p>}

            <button type="submit" disabled={templateBusy}>
              Add task template
            </button>
          </form>
        </section>

        <hr />

        <button type="button" onClick={handleDelete} disabled={submitting}>
          Delete Plant
        </button>
        </>
      )}

      <Link to="/registry">Back to Registry</Link>
    </main>
  )
}
