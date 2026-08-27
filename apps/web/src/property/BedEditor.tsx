import type { Bed, BedInput, BedPoint, BedTool, Property } from '@plant-app/domain'
import { pixelsPerFootForProperty, pixelsToFeet, validateBedInput } from '@plant-app/domain'
import Konva from 'konva'
import { useEffect, useRef, useState } from 'react'
import { BaseMapBackground } from './BaseMapBackground'
import { STAGE_SIZE_PX } from './baseMapTiles'
import { buildOutlineLine } from './bedOutline'
import { useBedsRepository } from './BedsRepositoryContext'
import { ovalToPoints, rectangleToPoints } from './dragShapeGeometry'
import { flattenClosedPenPath, type PenAnchor } from './penPath'
import { useIsDesktopViewport } from './useIsDesktopViewport'

const BED_STROKE = '#52b788'
const BED_FILL = 'rgba(82,183,136,0.2)'
const DRAFT_STROKE = '#1b4332'
const DRAFT_FILL = 'rgba(27,67,50,0.15)'
const CLOSE_RADIUS_PX = 14
const MIN_DRAG_PX = 4

const TOOL_LABELS: Record<BedTool, string> = {
  freehand: 'Freehand',
  rectangle: 'Rectangle',
  oval: 'Oval',
  pen: 'Bezier pen',
}
const TOOLS = Object.keys(TOOL_LABELS) as BedTool[]

interface Draft {
  tool: BedTool
  /** Raw traced points, in feet — see ADR-0001: never store the smoothed points. */
  points: BedPoint[]
}

interface DrawState {
  drawing: boolean
  rawPoints: number[]
  startPx: { x: number; y: number } | null
  previewNode: Konva.Line | Konva.Rect | Konva.Ellipse | null
  penAnchors: PenAnchor[]
  penDragging: boolean
  penDragStart: { x: number; y: number } | null
}

function freshDrawState(): DrawState {
  return {
    drawing: false,
    rawPoints: [],
    startPx: null,
    previewNode: null,
    penAnchors: [],
    penDragging: false,
    penDragStart: null,
  }
}

/**
 * The desktop-only Bed drawing surface (ADR-0001): freehand, rectangle,
 * oval, and bezier-pen tools, all normalizing to a raw point list in feet —
 * see `packages/domain/src/bed.ts`. Renders only when the Property has an
 * aerial base map (ticket #5) to draw against and scale from; a
 * photographed/in-app-drawn base map is a later ticket (#6).
 */
export function BedEditor({
  property,
  onBedsChange,
}: {
  property: Property
  /** Notified with the current Bed list on every load/create/remove — lets a sibling like `PlantingMap` (which needs to resolve Pins against these same Beds) stay in sync instead of holding its own stale copy until a reload. */
  onBedsChange?: (beds: Bed[]) => void
}) {
  const isDesktop = useIsDesktopViewport()
  const repository = useBedsRepository()

  const [open, setOpen] = useState(false)
  const [beds, setBeds] = useState<Bed[]>([])
  const [tool, setTool] = useState<BedTool>('freehand')
  const [smoothingEnabled, setSmoothingEnabled] = useState(false)
  const [name, setName] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const bedsLayerRef = useRef<Konva.Layer | null>(null)
  const draftLayerRef = useRef<Konva.Layer | null>(null)
  const previewLayerRef = useRef<Konva.Layer | null>(null)
  const toolRef = useRef(tool)
  const drawStateRef = useRef<DrawState>(freshDrawState())

  const pixelsPerFootValue = pixelsPerFootForProperty(property)

  useEffect(() => {
    toolRef.current = tool
  }, [tool])

  useEffect(() => {
    let cancelled = false
    repository
      .list(property.id)
      .then((result) => {
        if (!cancelled) setBeds(result)
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this Property's Beds.")
      })
    return () => {
      cancelled = true
    }
  }, [property.id, repository])

  useEffect(() => {
    onBedsChange?.(beds)
    // onBedsChange intentionally excluded: it's fired whenever `beds`
    // itself changes, not whenever the caller happens to pass a new
    // (possibly unstable) callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beds])

  // Mounts a real Konva stage for hands-on drawing — only while the editor
  // is open, and only once there's a scale to draw against.
  useEffect(() => {
    if (!open || !containerRef.current || pixelsPerFootValue === null) return

    const stage = new Konva.Stage({
      container: containerRef.current,
      width: STAGE_SIZE_PX,
      height: STAGE_SIZE_PX,
    })
    const bedsLayer = new Konva.Layer()
    const draftLayer = new Konva.Layer()
    const previewLayer = new Konva.Layer()
    stage.add(bedsLayer, draftLayer, previewLayer)
    stageRef.current = stage
    bedsLayerRef.current = bedsLayer
    draftLayerRef.current = draftLayer
    previewLayerRef.current = previewLayer

    function resetDrawState() {
      drawStateRef.current = freshDrawState()
      previewLayer.destroyChildren()
      previewLayer.batchDraw()
    }

    function commitDraftPixels(pixelPoints: BedPoint[]) {
      if (pixelPoints.length < 3 || pixelsPerFootValue === null) {
        resetDrawState()
        return
      }
      setDraft({ tool: toolRef.current, points: pixelsToFeet(pixelPoints, pixelsPerFootValue) })
      resetDrawState()
    }

    function redrawPenPreview() {
      const s = drawStateRef.current
      previewLayer.destroyChildren()
      if (s.penAnchors.length > 0) {
        previewLayer.add(
          new Konva.Line({
            points: s.penAnchors.flatMap((a) => [a.x, a.y]),
            stroke: BED_STROKE,
            strokeWidth: 2,
          }),
        )
        s.penAnchors.forEach((a, i) => {
          previewLayer.add(
            new Konva.Circle({
              x: a.x,
              y: a.y,
              radius: i === 0 ? 6 : 4,
              fill: 'white',
              stroke: BED_STROKE,
              strokeWidth: 2,
            }),
          )
          if (a.cpOut) {
            previewLayer.add(
              new Konva.Line({
                points: [a.x, a.y, a.cpOut.x, a.cpOut.y],
                stroke: '#aaa',
                strokeWidth: 1,
                dash: [3, 3],
              }),
            )
          }
        })
      }
      previewLayer.batchDraw()
    }

    function handleMouseDown() {
      const pos = stage.getPointerPosition()
      if (!pos) return
      const activeTool = toolRef.current
      const s = drawStateRef.current

      if (activeTool === 'freehand') {
        s.drawing = true
        s.rawPoints = [pos.x, pos.y]
        const line = new Konva.Line({
          points: [pos.x, pos.y],
          stroke: BED_STROKE,
          strokeWidth: 2.5,
          lineCap: 'round',
          lineJoin: 'round',
        })
        previewLayer.add(line)
        s.previewNode = line
        return
      }

      if (activeTool === 'rectangle' || activeTool === 'oval') {
        s.drawing = true
        s.startPx = pos
        const node =
          activeTool === 'rectangle'
            ? new Konva.Rect({
                x: pos.x,
                y: pos.y,
                width: 0,
                height: 0,
                stroke: BED_STROKE,
                strokeWidth: 2.5,
                fill: BED_FILL,
              })
            : new Konva.Ellipse({
                x: pos.x,
                y: pos.y,
                radiusX: 0,
                radiusY: 0,
                stroke: BED_STROKE,
                strokeWidth: 2.5,
                fill: BED_FILL,
              })
        previewLayer.add(node)
        s.previewNode = node
        return
      }

      if (activeTool === 'pen') {
        if (s.penAnchors.length >= 3) {
          const first = s.penAnchors[0]
          if (Math.hypot(pos.x - first.x, pos.y - first.y) < CLOSE_RADIUS_PX) {
            commitDraftPixels(flattenClosedPenPath(s.penAnchors))
            return
          }
        }
        s.penAnchors.push({ x: pos.x, y: pos.y, cpOut: null })
        s.penDragging = true
        s.penDragStart = pos
        redrawPenPreview()
      }
    }

    function handleMouseMove() {
      const pos = stage.getPointerPosition()
      if (!pos) return
      const activeTool = toolRef.current
      const s = drawStateRef.current

      if (activeTool === 'freehand' && s.drawing && s.previewNode instanceof Konva.Line) {
        s.rawPoints.push(pos.x, pos.y)
        s.previewNode.points(s.rawPoints)
        previewLayer.batchDraw()
        return
      }

      if (s.drawing && s.startPx && s.previewNode) {
        const dx = pos.x - s.startPx.x
        const dy = pos.y - s.startPx.y
        if (activeTool === 'rectangle' && s.previewNode instanceof Konva.Rect) {
          s.previewNode.x(dx < 0 ? s.startPx.x + dx : s.startPx.x)
          s.previewNode.y(dy < 0 ? s.startPx.y + dy : s.startPx.y)
          s.previewNode.width(Math.abs(dx))
          s.previewNode.height(Math.abs(dy))
          previewLayer.batchDraw()
        } else if (activeTool === 'oval' && s.previewNode instanceof Konva.Ellipse) {
          s.previewNode.x(s.startPx.x + dx / 2)
          s.previewNode.y(s.startPx.y + dy / 2)
          s.previewNode.radiusX(Math.abs(dx) / 2)
          s.previewNode.radiusY(Math.abs(dy) / 2)
          previewLayer.batchDraw()
        }
        return
      }

      if (activeTool === 'pen' && s.penDragging && s.penDragStart && s.penAnchors.length > 0) {
        const dx = pos.x - s.penDragStart.x
        const dy = pos.y - s.penDragStart.y
        if (Math.hypot(dx, dy) > MIN_DRAG_PX) {
          const last = s.penAnchors[s.penAnchors.length - 1]
          last.cpOut = { x: last.x + dx, y: last.y + dy }
          redrawPenPreview()
        }
      }
    }

    function handleMouseUp() {
      const activeTool = toolRef.current
      const s = drawStateRef.current

      if (activeTool === 'pen') {
        s.penDragging = false
        s.penDragStart = null
        return
      }

      if (!s.drawing) return
      s.drawing = false

      if (activeTool === 'freehand') {
        const pts: BedPoint[] = []
        for (let i = 0; i < s.rawPoints.length; i += 2) {
          pts.push({ x: s.rawPoints[i], y: s.rawPoints[i + 1] })
        }
        commitDraftPixels(pts)
        return
      }

      if (activeTool === 'rectangle' && s.previewNode instanceof Konva.Rect && s.startPx) {
        const r = s.previewNode
        if (r.width() > 8 && r.height() > 8) {
          const pos = stage.getPointerPosition()
          if (pos) commitDraftPixels(rectangleToPoints(s.startPx, pos))
        } else {
          resetDrawState()
        }
        return
      }

      if (activeTool === 'oval' && s.previewNode instanceof Konva.Ellipse && s.startPx) {
        const e = s.previewNode
        if (e.radiusX() > 5 && e.radiusY() > 5) {
          const pos = stage.getPointerPosition()
          if (pos) commitDraftPixels(ovalToPoints(s.startPx, pos))
        } else {
          resetDrawState()
        }
      }
    }

    stage.on('mousedown', handleMouseDown)
    stage.on('mousemove', handleMouseMove)
    stage.on('mouseup', handleMouseUp)

    return () => {
      stage.destroy()
      stageRef.current = null
      bedsLayerRef.current = null
      draftLayerRef.current = null
      previewLayerRef.current = null
      // A Bed left half-drawn (e.g. a few pen anchors placed, not yet
      // closed) must not survive into the next time the editor is opened —
      // otherwise a stray click near where that stale anchor used to be
      // could silently close a shape made of leftover points.
      drawStateRef.current = freshDrawState()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pixelsPerFootValue])

  // Renders saved Beds — independent of the in-progress draft, so drawing
  // or toggling smoothing doesn't pay to re-smooth/rebuild every other
  // already-saved Bed on the property.
  useEffect(() => {
    const layer = bedsLayerRef.current
    if (!layer || pixelsPerFootValue === null) return
    layer.destroyChildren()
    for (const bed of beds) {
      layer.add(
        buildOutlineLine(bed.points, bed.tool, bed.smoothingEnabled, pixelsPerFootValue, {
          stroke: BED_STROKE,
          fill: BED_FILL,
          strokeWidth: 2,
        }),
      )
    }
    layer.batchDraw()
  }, [beds, pixelsPerFootValue])

  // Renders just the in-progress (committed-but-not-saved) draft outline.
  useEffect(() => {
    const layer = draftLayerRef.current
    if (!layer || pixelsPerFootValue === null) return
    layer.destroyChildren()
    if (draft) {
      layer.add(
        buildOutlineLine(draft.points, draft.tool, smoothingEnabled, pixelsPerFootValue, {
          stroke: DRAFT_STROKE,
          fill: DRAFT_FILL,
          strokeWidth: 2.5,
          dash: [6, 4],
        }),
      )
    }
    layer.batchDraw()
  }, [draft, smoothingEnabled, pixelsPerFootValue])

  function handleClearDraft() {
    setDraft(null)
    drawStateRef.current = freshDrawState()
    previewLayerRef.current?.destroyChildren()
    previewLayerRef.current?.batchDraw()
  }

  function handleToolChange(next: BedTool) {
    setTool(next)
    handleClearDraft()
  }

  async function handleSave() {
    if (!draft) return
    setError(null)
    const input: BedInput = {
      propertyId: property.id,
      name,
      tool: draft.tool,
      points: draft.points,
      smoothingEnabled: draft.tool === 'freehand' ? smoothingEnabled : false,
    }
    const validation = validateBedInput(input)
    if (!validation.ok) {
      setError(Object.values(validation.errors)[0] ?? 'Could not save this Bed.')
      return
    }
    setSaving(true)
    try {
      const created = await repository.create(input)
      setBeds((prev) => [...prev, created])
      handleClearDraft()
      setName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this Bed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(id: string) {
    setError(null)
    try {
      await repository.remove(id)
      setBeds((prev) => prev.filter((bed) => bed.id !== id))
    } catch {
      setError('Could not remove this Bed.')
    }
  }

  if (pixelsPerFootValue === null) {
    // No scale to draw against yet — either no aerial imagery and no
    // photo/drawn base map calibrated via Scale Reference (ticket #6) yet.
    return null
  }

  return (
    <section className="bed-editor">
      <h2>Beds</h2>
      {error && <p role="alert">{error}</p>}

      {!isDesktop ? (
        <p>Bed drawing is available on a larger, non-touch screen.</p>
      ) : !open ? (
        <button type="button" onClick={() => setOpen(true)}>
          Draw a Bed
        </button>
      ) : (
        <>
          <div role="toolbar" aria-label="Bed drawing tools">
            {TOOLS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tool === t}
                onClick={() => handleToolChange(t)}
              >
                {TOOL_LABELS[t]}
              </button>
            ))}
          </div>

          {tool === 'freehand' && (
            <label>
              <input
                type="checkbox"
                checked={smoothingEnabled}
                onChange={(event) => setSmoothingEnabled(event.target.checked)}
              />
              Smoothing
            </label>
          )}

          {tool === 'pen' && (
            <p>Click to place points; click near the first point to close the shape.</p>
          )}

          {/* The base map renders again here, at native/full resolution and
              pixel-for-pixel behind the Konva stage, so the two share one
              coordinate space — the always-visible thumbnail above (in
              PropertyPage) is CSS-capped to 512px and isn't usable as a
              drawing reference. */}
          <div style={{ position: 'relative', width: STAGE_SIZE_PX, height: STAGE_SIZE_PX }}>
            <BaseMapBackground property={property} />
            <div
              ref={containerRef}
              data-testid="bed-drawing-surface"
              style={{ position: 'absolute', inset: 0 }}
            />
          </div>

          <div>
            <label htmlFor="bed-name">Bed name</label>
            <input id="bed-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <button type="button" onClick={handleSave} disabled={!draft || saving}>
            {saving ? 'Saving…' : 'Save Bed'}
          </button>
          <button type="button" onClick={handleClearDraft} disabled={!draft}>
            Clear
          </button>
          <button type="button" onClick={() => setOpen(false)}>
            Close
          </button>
        </>
      )}

      <ul>
        {beds.map((bed) => (
          <li key={bed.id}>
            {bed.name}
            <button type="button" aria-label={`Remove ${bed.name}`} onClick={() => handleRemove(bed.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
