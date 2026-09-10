import type { BaseMapSource, BedPoint, Property, ScalePoint, ScaleReferenceMode } from '@plant-app/domain'
import { STAGE_SIZE_PX, svgPointsAttribute, validateScaleReferenceInput } from '@plant-app/domain'
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { usePropertiesRepository } from './PropertiesRepositoryContext'
import { DESKTOP_ONLY } from '../desktopOnly'
import { useIsDesktopViewport } from './useIsDesktopViewport'

type Step = 'choose' | 'photo' | 'draw' | 'calibrate'

/**
 * `'create'`: no Property exists yet — the gardener picked "upload/draw my
 * own base map" up front, before any address/aerial attempt (see
 * CONTEXT.md's Property entry). `'update'`: a Property already exists (it
 * was created as `'aerial'`) but its address turned out to have no imagery
 * coverage — this is completing that original setup via a fallback, not
 * changing a settled choice. `'recalibrate'`: the base map is already there
 * and staying; only its Scale Reference is being redone (#28).
 *
 * `'recalibrate'` is deliberately not `'update'` with a flag. It skips the
 * source choice and the upload/draw steps entirely and reuses the base map
 * on the Property, because the gardener is fixing a wrong *scale*, not
 * replacing the map it was measured against — making them re-upload a plot
 * plan to move two points is what kept anyone from doing it.
 */
type BaseMapSetupProps =
  | { mode: 'create'; name: string; onCreated: (property: Property) => void }
  | { mode: 'update'; property: Property; onUpdated: (property: Property) => void }
  | {
      mode: 'recalibrate'
      property: Property
      onUpdated: (property: Property) => void
      onCancel: () => void
    }

const SETUP_LABELS: Record<BaseMapSetupProps['mode'], string> = {
  create: 'Upload or draw your base map',
  update: 'Set up a base map another way',
  recalibrate: 'Recalibrate this base map',
}

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
  const isDesktop = useIsDesktopViewport()
  const recalibrating = props.mode === 'recalibrate'
  // Seeded from the Property when recalibrating, so the gardener lands on
  // the two-point step over the base map they already have.
  const [step, setStep] = useState<Step>(recalibrating ? 'calibrate' : 'choose')
  const [source, setSource] = useState<BaseMapSource | null>(
    props.mode === 'recalibrate' ? props.property.baseMapSource : null,
  )
  // Generated up front even in 'update' mode (where it's unused) so the
  // storage path an uploaded photo lands under is stable for the whole flow
  // — see `createWithBaseMap`, which inserts the Property row under this
  // same id afterward.
  const [pendingId] = useState(() => crypto.randomUUID())
  const propertyId = props.mode === 'create' ? pendingId : props.property.id

  const [uploading, setUploading] = useState(false)
  const [photoPath, setPhotoPath] = useState<string | null>(
    props.mode === 'recalibrate' ? props.property.baseMapPhotoPath : null,
  )
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)

  const [strokes, setStrokes] = useState<BedPoint[][]>(
    props.mode === 'recalibrate' ? (props.property.baseMapDrawing ?? []) : [],
  )
  const [currentStroke, setCurrentStroke] = useState<BedPoint[]>([])

  const [points, setPoints] = useState<ScalePoint[]>([])
  const [mode, setMode] = useState<ScaleReferenceMode>('known-measurement')
  const [distanceFeet, setDistanceFeet] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  /**
   * Whether there is actually something on screen to pick two points
   * against. Only a photo can be missing here: a drawn plan is in local
   * state by the time this step is reached, and an aerial Property never
   * reaches it at all.
   */
  const baseMapReady = source !== 'photo' || photoPreviewUrl !== null

  // Recalibrating a photo Property needs the stored photo back on screen to
  // pick two points against — it was uploaded in some earlier session, so
  // there's no local preview URL to reuse.
  useEffect(() => {
    if (!recalibrating || source !== 'photo' || !photoPath) return
    let cancelled = false
    repository
      .getBaseMapPhotoUrl(photoPath)
      .then((url) => {
        if (!cancelled) setPhotoPreviewUrl(url)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this base map photo. Please try again.')
      })
    // No `setPhotoPreviewUrl(null)` on failure is needed — it starts null,
    // and `baseMapReady` below is what keeps the calibrate surface off
    // screen until the photo actually arrives.
    return () => {
      cancelled = true
    }
  }, [recalibrating, source, photoPath, repository])

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
      aria-label={SETUP_LABELS[props.mode]}
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
          {/* ADR-0003 keeps freehand drawing desktop-only, and that covers
              the in-app drawn base plan as well as Bed outlines. The photo
              path stays available here, so a phone browser still has a way
              to set up a base map — it just can't trace one. */}
          {isDesktop ? (
            <button
              type="button"
              onClick={() => {
                setSource('drawn')
                setStep('draw')
              }}
            >
              Draw a base plan
            </button>
          ) : (
            <p>{DESKTOP_ONLY.drawing}</p>
          )}
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

      {step === 'draw' && !isDesktop && <p>{DESKTOP_ONLY.drawing}</p>}

      {step === 'draw' && isDesktop && (
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
                <polyline key={i} points={svgPointsAttribute(stroke)} fill="none" stroke="#333" strokeWidth={2} />
              ))}
              {currentStroke.length > 0 && (
                <polyline
                  points={svgPointsAttribute(currentStroke)}
                  fill="none"
                  stroke="#1b4332"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
              )}
              {/*
                One dot per placed point of the line in progress. Without these
                the first point is invisible — a polyline of a single point has
                zero length and paints nothing — so a correct first click looked
                like the surface had ignored it (#33). Smaller than the
                calibrate step's r=6 circles because here the line is the
                content and these are its vertices, where there the two points
                *are* the content. Only the in-progress stroke needs them:
                "Finish this line" is disabled below two points, so a committed
                stroke always has a length to paint.
              */}
              {currentStroke.map((point, i) => (
                <circle
                  key={i}
                  data-testid="base-map-placed-point"
                  cx={point.x}
                  cy={point.y}
                  r={4}
                  fill="#1b4332"
                  stroke="white"
                  strokeWidth={1.5}
                />
              ))}
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

      {step === 'calibrate' && !baseMapReady && (
        // Two clicks on an empty box would otherwise save a Scale Reference
        // measured against nothing at all — a silently wrong scale, which is
        // the exact failure #28 exists to make impossible.
        <p>
          This base map's photo hasn't loaded, so there's nothing to measure against yet. Try again
          in a moment.
        </p>
      )}

      {step === 'calibrate' && baseMapReady && (
        <>
          <h3>Scale Reference</h3>
          {recalibrating && (
            <p>
              This Property already has a scale. Picking two points and saving replaces it — the
              base map itself is kept, and Beds and Pins keep the real-world positions they were
              recorded at, so they redraw against the new scale.
            </p>
          )}
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
                  <polyline key={i} points={svgPointsAttribute(stroke)} fill="none" stroke="#333" strokeWidth={2} />
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
          {props.mode === 'recalibrate' && (
            <button type="button" onClick={props.onCancel} disabled={saving}>
              Keep the current scale
            </button>
          )}
        </>
      )}
    </section>
  )
}
