const { mapGeometry, parseCoordinate } = require("@lodgist/spatial-core");

function tileHostAllowed(template) {
  if (/^https:\/\//.test(template)) return true;
  return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(template);
}

function fillLocalTileTemplate(template, tile) {
  if (typeof template !== "string" || !template.includes("{z}") || !template.includes("{x}") || !template.includes("{y}")) {
    return null;
  }
  if (!tileHostAllowed(template)) return null;
  if (!tile || !Number.isInteger(tile.z) || !Number.isInteger(tile.x) || !Number.isInteger(tile.y)) return null;
  if (tile.z < 0 || tile.z > 19 || tile.y < 0) return null;
  return template
    .replaceAll("{z}", String(tile.z))
    .replaceAll("{x}", String(tile.x))
    .replaceAll("{y}", String(tile.y));
}

function webMercator(lat, lng, zoom) {
  const scale = 256 * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale;
  return { x, y };
}

function chooseTileZoom(lat, radiusM, width, height) {
  const shorter = Math.min(width, height);
  const cos = Math.cos((lat * Math.PI) / 180);
  for (let zoom = 16; zoom >= 11; zoom -= 1) {
    const metersPerPixel = (156543.03392 * Math.max(cos, 0.01)) / 2 ** zoom;
    const diameterPx = (radiusM * 2) / metersPerPixel;
    if (diameterPx <= shorter * 0.62 || zoom === 11) return zoom;
  }
  return 11;
}

/**
 * Geographic tile grid for the public focus only.
 * Returns null when the location is unknown, the template is unusable, or attribution is missing.
 * Tile URLs contain z/x/y indexes, not a building coordinate.
 */
function tileLayer({ focus, template, attribution, width, height }) {
  const geometry = mapGeometry(focus);
  if (geometry.kind === "none") return null;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 64 || height < 64) return null;
  const credit = typeof attribution === "string" ? attribution.trim() : "";
  if (!credit) return null;
  const radiusM = geometry.kind === "area" ? geometry.radiusM : 400;
  const zoom = chooseTileZoom(geometry.lat, radiusM, width, height);
  const center = webMercator(geometry.lat, geometry.lng, zoom);
  const originX = center.x - width / 2;
  const originY = center.y - height / 2;
  const tileSize = 256;
  const n = 2 ** zoom;
  const x0 = Math.floor(originX / tileSize);
  const y0 = Math.floor(originY / tileSize);
  const x1 = Math.floor((originX + width - 1) / tileSize);
  const y1 = Math.floor((originY + height - 1) / tileSize);
  const tiles = [];
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      if (y < 0 || y >= n) continue;
      const wrapped = ((x % n) + n) % n;
      const url = fillLocalTileTemplate(template, { z: zoom, x: wrapped, y });
      if (!url) return null;
      tiles.push({
        url,
        left: x * tileSize - originX,
        top: y * tileSize - originY,
        z: zoom,
        x: wrapped,
        y,
      });
    }
  }
  if (tiles.length === 0) return null;
  const metersPerPixel = (156543.03392 * Math.cos((geometry.lat * Math.PI) / 180)) / 2 ** zoom;
  return {
    zoom,
    attribution: credit,
    width,
    height,
    originX,
    originY,
    tiles,
    focusRadiusPx: geometry.kind === "area" ? radiusM / metersPerPixel : null,
  };
}

function projectOnLayer(layer, lat, lng) {
  if (!layer) return null;
  const point = parseCoordinate(lat, lng);
  if (!point) return null;
  const projected = webMercator(point.lat, point.lng, layer.zoom);
  return { x: projected.x - layer.originX, y: projected.y - layer.originY };
}

module.exports = { tileLayer, projectOnLayer };
