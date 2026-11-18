export interface MapCamera { x: number; y: number; zoom: number }
export function zoomAt(camera: MapCamera, point: { x: number; y: number }, factor: number): MapCamera {
  const zoom = Math.max(0.25, Math.min(4, camera.zoom * factor));
  const ratio = zoom / camera.zoom;
  return { x: point.x - (point.x - camera.x) * ratio, y: point.y - (point.y - camera.y) * ratio, zoom };
}
