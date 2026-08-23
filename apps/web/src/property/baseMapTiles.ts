import { aerialTileUrl, lonLatToTile, type Property } from '@plant-app/domain'

/** A fixed grid around the property's center tile — see PropertyPage/BedEditor for why panning/zooming is out of scope. */
export const GRID_RADIUS = 1
export const TILE_SIZE_PX = 256

export interface BaseMapTile {
  key: string
  url: string
}

export function baseMapTiles(property: Property): BaseMapTile[] {
  if (property.imageryZoom === null) return []
  const center = lonLatToTile(property.latitude, property.longitude, property.imageryZoom)
  const tiles: BaseMapTile[] = []
  for (let dy = -GRID_RADIUS; dy <= GRID_RADIUS; dy++) {
    for (let dx = -GRID_RADIUS; dx <= GRID_RADIUS; dx++) {
      const x = center.x + dx
      const y = center.y + dy
      tiles.push({ key: `${x}-${y}`, url: aerialTileUrl(property.imageryZoom, x, y) })
    }
  }
  return tiles
}
