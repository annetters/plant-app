import type { Property } from '@plant-app/domain'
import { useEffect, useState } from 'react'
import { baseMapTiles, GRID_RADIUS, STAGE_SIZE_PX } from './baseMapTiles'
import { strokePoints } from './baseMapDrawing'
import { useOptionalPropertiesRepository } from './PropertiesRepositoryContext'

/**
 * The drawing surface's backdrop, for whichever of the three base-map
 * sources (CONTEXT.md's Property entry) this Property uses — extracted out
 * of `BedEditor`/`PlantingMap`, which used to duplicate the aerial-tile-grid
 * JSX identically. Renders inside a `position: relative` container sized to
 * `STAGE_SIZE_PX` (see either caller); this component only fills it.
 */
export function BaseMapBackground({ property }: { property: Property }) {
  const repository = useOptionalPropertiesRepository()
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (property.baseMapSource !== 'photo' || !property.baseMapPhotoPath || !repository) {
      setPhotoUrl(null)
      return
    }
    let cancelled = false
    const path = property.baseMapPhotoPath
    repository
      .getBaseMapPhotoUrl(path)
      .then((url) => {
        if (!cancelled) setPhotoUrl(url)
      })
      .catch(() => {
        if (!cancelled) setPhotoUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [property.baseMapSource, property.baseMapPhotoPath, repository])

  if (property.baseMapSource === 'aerial') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_RADIUS * 2 + 1}, 1fr)`,
        }}
      >
        {baseMapTiles(property).map((tile) => (
          <img
            key={tile.key}
            src={tile.url}
            alt=""
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        ))}
      </div>
    )
  }

  if (property.baseMapSource === 'photo') {
    if (!photoUrl) return null
    return (
      <img
        src={photoUrl}
        alt="Photographed plot plan or survey"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
      />
    )
  }

  // 'drawn' — the hand-drawn structural plan itself, in the same pixel space
  // it and its Scale Reference were captured in (see BaseMapDrawingPad).
  return (
    <svg
      viewBox={`0 0 ${STAGE_SIZE_PX} ${STAGE_SIZE_PX}`}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      aria-label="Drawn base plan"
    >
      {(property.baseMapDrawing ?? []).map((stroke, i) => (
        <polyline key={i} points={strokePoints(stroke)} fill="none" stroke="#333" strokeWidth={2} />
      ))}
    </svg>
  )
}
