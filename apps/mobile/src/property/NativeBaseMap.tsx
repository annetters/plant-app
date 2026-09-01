import type { Property } from '@plant-app/domain'
import {
  GRID_RADIUS,
  STAGE_SIZE_PX,
  baseMapTiles,
  svgPointsAttribute,
} from '@plant-app/domain'
import { useEffect, useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import Svg, { Polyline } from 'react-native-svg'
import { usePropertiesRepository } from './PropertiesRepositoryContext'

const TILES_PER_ROW = GRID_RADIUS * 2 + 1

/**
 * The map's backdrop on a phone, for whichever of the three base-map sources
 * this Property uses (CONTEXT.md's Property entry) — the native counterpart
 * of web's `BaseMapBackground`, drawn with `<Image>`/`react-native-svg`
 * instead of DOM elements.
 *
 * Fills a `size`-square container the caller positions; the Bed and Pin
 * overlay sits on top of it at exactly the same size, so the two always
 * agree on where a given map coordinate is.
 */
export function NativeBaseMap({ property, size }: { property: Property; size: number }) {
  const repository = usePropertiesRepository()
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (property.baseMapSource !== 'photo' || !property.baseMapPhotoPath) {
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
    const tiles = baseMapTiles(property)
    const tileSize = size / TILES_PER_ROW
    // `baseMapTiles` is row-major, so slicing it into fixed-width rows
    // rebuilds the grid — laid out explicitly rather than left to flex-wrap,
    // which would reflow the whole grid if a fractional tile size rounded a
    // row a pixel too wide.
    const rows = Array.from({ length: TILES_PER_ROW }, (_, row) =>
      tiles.slice(row * TILES_PER_ROW, (row + 1) * TILES_PER_ROW),
    )
    return (
      <View style={[styles.fill, { width: size, height: size }]} testID="base-map-aerial">
        {rows.map((rowTiles, row) => (
          <View key={row} style={styles.tileRow}>
            {rowTiles.map((tile) => (
              <Image
                key={tile.key}
                accessibilityIgnoresInvertColors
                source={{ uri: tile.url }}
                style={{ width: tileSize, height: tileSize }}
              />
            ))}
          </View>
        ))}
      </View>
    )
  }

  if (property.baseMapSource === 'photo') {
    if (!photoUrl) return null
    return (
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel="Photographed plot plan or survey"
        source={{ uri: photoUrl }}
        resizeMode="contain"
        style={[styles.fill, { width: size, height: size }]}
        testID="base-map-photo"
      />
    )
  }

  // 'drawn' — the hand-drawn structural plan itself, in the same pixel space
  // it and its Scale Reference were captured in on the desktop app.
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${STAGE_SIZE_PX} ${STAGE_SIZE_PX}`}
      style={styles.fill}
      accessibilityLabel="Drawn base plan"
      testID="base-map-drawn"
    >
      {(property.baseMapDrawing ?? []).map((stroke, i) => (
        <Polyline
          key={i}
          points={svgPointsAttribute(stroke)}
          fill="none"
          stroke="#333"
          // Divided back out of the viewBox's own scaling, so a traced line
          // stays as thick on screen as it is on the desktop app rather than
          // thinning to a near-invisible hairline on a shrunk-to-fit phone map.
          strokeWidth={(2 * STAGE_SIZE_PX) / size}
        />
      ))}
    </Svg>
  )
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  tileRow: {
    flexDirection: 'row',
  },
})
