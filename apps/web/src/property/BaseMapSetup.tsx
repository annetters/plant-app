import type { BaseMapSource, BedPoint, Property, ScalePoint, ScaleReferenceMode } from '@plant-app/domain'
import { validateScaleReferenceInput } from '@plant-app/domain'
import { useState, type MouseEvent as ReactMouseEvent } from 'react'
import { strokePoints } from './baseMapDrawing'
import { STAGE_SIZE_PX } from './baseMapTiles'
import { usePropertiesRepository } from './PropertiesRepositoryContext'

type Step = 'choose' | 'photo' | 'draw' | 'calibrate'

/**
 * `'create'`: no Property exists yet — the gardener picked "upload/draw my
 * own base map" up front, before any address/aerial attempt (see
 * CONTEXT.md's Property entry). `'update'`: a Property already exists (it
 * was created as `'aerial'`) but its address turned out to have no imagery
 * coverage — this is completing that original setup via a fallback, not
 * changing a settled choice.
 */
type BaseMapSetupProps =
  | { mode: 'create'; name: string; onCreated: (property: Property) => void }
  | { mode: 'update'; property: Property; onUpdated: (property: Property) => void }

function clickPoint(event: ReactMouseEvent<HTMLDivElement>): ScalePoint {
  const rect = event.currentTarget.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

/**
 * Ticket #6: upload a photographed plot plan/survey, or draw a base plan
 * directly in the app, then calibrate whichever one against a real-world
 * distance. Everything here stays local state until "Save Scale Reference"
 * persists it all in one call, so a Property never sits half-configured
 * (e.g. a photo saved with no scale yet) between steps.
 */
export function BaseMapSetup(props: BaseMapSetupProps) {
  const repository = usePropertiesRepository()
  const [step, setStep] = useState<Step>('choose')
  const [source, setSource] = useState<BaseMapSource | null>(null)
  // Generated up front even in 'update' mode (where it's unused) so the
  // storage path an uploaded photo lands under is stable for the whole flow
  // — see `createWithBaseMap`, which inserts the Property row under this
  // same id afterward.
  const [pendingId] = useState(() => crypto.randomUUID())
  const propertyId = props.mode === 'update' ? props.property.id : pendingId

  const [uploading, setUploading] = useState(false)
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)

  const [strokes, setStrokes] = useState<BedPoint[][]>([])
  const [currentStroke, setCurrentStroke] = useState<BedPoint[]>([])

  const [points, setPoints] = useState<ScalePoint[]>([])
  const [mode, setMode] = useState<ScaleReferenceMode>('known-measurement')
  const [distanceFeet, setDistanceFeet] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handlePhotoSelected(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const path = await repository.uploadBaseMapPhoto(propertyId, file)
      const url = await repository.getBaseMapPhotoUrl(path)
      setPhotoPath(path)
      setPhotoPreviewUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload this photo. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function handleCanvasClick(event: ReactMouseEvent<HTMLDivElement>) {
    const point = clickPoint(event)
    if (step === 'draw') {
      setCurrentStroke((prev) => [...prev, point])
    } else if (step === 'calibrate') {
      setPoints((prev) => (prev.length >= 2 ? [point] : [...prev, point]))
    }
  }

  function handleFinishLine() {
    if (currentStroke.length < 2) return
    setStrokes((prev) => [...prev, currentStroke])
    setCurrentStroke([])
  }

  function handleUndoLine() {
    setStrokes((prev) => prev.slice(0, -1))
  }

  function handleDoneDrawing() {
    const finalStrokes = currentStroke.length >= 2 ? [...strokes, currentStroke] : strokes
    if (finalStrokes.length === 0) {
      setError('Draw at least one line — trace the property boundary, driveway, or house outline — before continuing.')
      return
    }
    setStrokes(finalStrokes)
    setCurrentStroke([])
    setError(null)
    setStep('calibrate')
  }

  async function handleSaveScaleReference() {
    if (points.length < 2) {
      setError('Click two points on the base map to calibrate its scale.')
      return
    }
    const scaleReference = {
      pointA: points[0],
      pointB: points[1],
      realDistanceFeet: Number(distanceFeet),
      mode,
    }
    const validation = validateScaleReferenceInput(scaleReference)
    if (!validation.ok) {
      setError(Object.values(validation.errors)[0] ?? 'Could not save this Scale Reference.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      if (props.mode === 'create') {
        const created = await repository.createWithBaseMap({
          id: propertyId,
          name: props.name,
          baseMapSource: source as 'photo' | 'drawn',
          baseMapPhotoPath: source === 'photo' ? photoPath : null,
          baseMapDrawing: source === 'drawn' ? strokes : null,
          scaleReference,
        })
        props.onCreated(created)
      } else {
        const updated = await repository.updateBaseMap(props.property.id, {
          baseMapSource: source as BaseMapSource,
          baseMapPhotoPath: source === 'photo' ? photoPath : null,
          baseMapDrawing: source === 'drawn' ? strokes : null,
          scaleReference,
        })
        props.onUpdated(updated)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this base map.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      aria-label={props.mode === 'create' ? 'Upload or draw your base map' : 'Set up a base map another way'}
      className="base-map-setup"
    >
      {error && <p role="alert">{error}</p>}

      {step === 'choose' && (
        <>
          <button
            type="button"
            onClick={() => {
              setSource('photo')
              setStep('photo')
            }}
          >
            Upload a plot plan photo
          </button>
          <button
            type="button"
            onClick={() => {
              setSource('drawn')
              setStep('draw')
            }}
          >
            Draw a base plan
          </button>
        </>
      )}

      {step === 'photo' && (
        <>
          <label htmlFor="base-map-photo">Plot plan or survey photo</label>
          <input
            id="base-map-photo"
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(event) => {
              void handlePhotoSelected(event.target.files)
              event.target.value = ''
            }}
          />
          {uploading && <p>Uploading…</p>}
          {photoPreviewUrl && (
            <>
              <div style={{ position: 'relative', width: STAGE_SIZE_PX, height: STAGE_SIZE_PX }}>
                <img
                  src={photoPreviewUrl}
                  alt="Uploaded plot plan or survey"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <button type="button" onClick={() => setStep('calibrate')}>
                Continue to Scale Reference
              </button>
            </>
          )}
        </>
      )}

      {step === 'draw' && (
        <>
          <p>
            Click to place points along a structural line — the property boundary, driveway, or
            house outline. Click "Finish this line" to complete it, then start another.
          </p>
          <div
            data-testid="base-map-drawing-surface"
            onClick={handleCanvasClick}
            style={{
              position: 'relative',
              width: STAGE_SIZE_PX,
              height: STAGE_SIZE_PX,
              border: '1px solid #ccc',
            }}
          >
            <svg
              viewBox={`0 0 ${STAGE_SIZE_PX} ${STAGE_SIZE_PX}`}
              style={{ width: '100%', height: '100%' }}
            >
              {strokes.map((stroke, i) => (
                <polyline key={i} points={strokePoints(stroke)} fill="none" stroke="#333" strokeWidth={2} />
              ))}
              {currentStroke.length > 0 && (
                <polyline
                  points={strokePoints(currentStroke)}
                  fill="none"
                  stroke="#1b4332"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
              )}
            </svg>
          </div>
          <button type="button" onClick={handleFinishLine} disabled={currentStroke.length < 2}>
            Finish this line
          </button>
          <button type="button" onClick={handleUndoLine} disabled={strokes.length === 0}>
            Undo last line
          </button>
          <button type="button" onClick={handleDoneDrawing}>
            Done drawing
          </button>
        </>
      )}

      {step === 'calibrate' && (
        <>
          <h3>Scale Reference</h3>
          <p>Click two points on the base map below, then enter the real-world distance between them.</p>
          <p>
            Pick points as far apart as the base map allows — a longer reference makes the
            resulting scale far less sensitive to a slightly-off click or measurement.
          </p>
          <div
            data-testid="scale-reference-surface"
            onClick={handleCanvasClick}
            style={{
              position: 'relative',
              width: STAGE_SIZE_PX,
              height: STAGE_SIZE_PX,
              border: '1px solid #ccc',
            }}
          >
            {source === 'photo' && photoPreviewUrl && (
              <img
                src={photoPreviewUrl}
                alt="Uploaded plot plan or survey"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )}
            <svg
              viewBox={`0 0 ${STAGE_SIZE_PX} ${STAGE_SIZE_PX}`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            >
              {source === 'drawn' &&
                strokes.map((stroke, i) => (
                  <polyline key={i} points={strokePoints(stroke)} fill="none" stroke="#333" strokeWidth={2} />
                ))}
              {points.map((point, i) => (
                <circle key={i} cx={point.x} cy={point.y} r={6} fill="#e63946" stroke="white" strokeWidth={1.5} />
              ))}
              {points.length === 2 && (
                <line
                  x1={points[0].x}
                  y1={points[0].y}
                  x2={points[1].x}
                  y2={points[1].y}
                  stroke="#e63946"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              )}
            </svg>
          </div>

          <fieldset>
            <legend>Mode</legend>
            <label>
              <input
                type="radio"
                name="scale-reference-mode"
                value="known-measurement"
                checked={mode === 'known-measurement'}
                onChange={() => setMode('known-measurement')}
              />
              Known measurement (a stated distance, e.g. from a printed plan)
            </label>
            <label>
              <input
                type="radio"
                name="scale-reference-mode"
                value="measured-object"
                checked={mode === 'measured-object'}
                onChange={() => setMode('measured-object')}
              />
              Measured object (a fence or wall you tape-measured yourself)
            </label>
          </fieldset>

          <label htmlFor="scale-reference-distance">Real-world distance (feet)</label>
          <input
            id="scale-reference-distance"
            type="number"
            min={0}
            step="any"
            value={distanceFeet}
            onChange={(event) => setDistanceFeet(event.target.value)}
          />

          <button type="button" onClick={() => void handleSaveScaleReference()} disabled={saving}>
            {saving ? 'Saving…' : 'Save Scale Reference'}
          </button>
        </>
      )}
    </section>
  )
}
