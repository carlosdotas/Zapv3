export type MapPoint = { latitude: number; longitude: number };
export type MapTile = { x: number; y: number; left: number; top: number };

export interface MapsProvider {
  tileUrl(zoom: number, x: number, y: number): string;
}

export const openStreetMapProvider: MapsProvider = {
  tileUrl: (zoom, x, y) => `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
};

const TILE_SIZE = 256;
const MAX_LATITUDE = 85.05112878;

export function validMapPoint(point: MapPoint | null): point is MapPoint {
  return Boolean(point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= MAX_LATITUDE && Math.abs(point.longitude) <= 180);
}

export function projectMapPoint(point: MapPoint, zoom: number) {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const latitude = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, point.latitude));
  const sin = Math.sin(latitude * Math.PI / 180);
  return {
    x: (point.longitude + 180) / 360 * worldSize,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize,
  };
}

export function unprojectMapPoint(x: number, y: number, zoom: number): MapPoint {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const wrappedX = ((x % worldSize) + worldSize) % worldSize;
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / worldSize))) * 180 / Math.PI;
  return { latitude, longitude: wrappedX / worldSize * 360 - 180 };
}

export function visibleMapTiles(center: MapPoint, zoom: number, width: number, height: number): MapTile[] {
  if (!validMapPoint(center) || width <= 0 || height <= 0) return [];
  const worldSize = TILE_SIZE * 2 ** zoom;
  const projected = projectMapPoint(center, zoom);
  const minX = Math.floor((projected.x - width / 2) / TILE_SIZE);
  const maxX = Math.floor((projected.x + width / 2) / TILE_SIZE);
  const minY = Math.max(0, Math.floor((projected.y - height / 2) / TILE_SIZE));
  const maxY = Math.min(2 ** zoom - 1, Math.floor((projected.y + height / 2) / TILE_SIZE));
  const tiles: MapTile[] = [];
  for (let tileY = minY; tileY <= maxY; tileY++) {
    for (let tileX = minX; tileX <= maxX; tileX++) {
      const wrappedX = ((tileX % 2 ** zoom) + 2 ** zoom) % 2 ** zoom;
      tiles.push({
        x: wrappedX,
        y: tileY,
        left: tileX * TILE_SIZE - projected.x + width / 2,
        top: tileY * TILE_SIZE - projected.y + height / 2,
      });
    }
  }
  return tiles;
}

export function panMapPoint(center: MapPoint, zoom: number, deltaX: number, deltaY: number): MapPoint {
  const projected = projectMapPoint(center, zoom);
  return unprojectMapPoint(projected.x - deltaX, projected.y - deltaY, zoom);
}
