"use client";

import { useMemo, useState } from "react";
import { fillTileTemplate, mapGeometry, type Amenity, type Campus, type SpatialFocus } from "@/lib/spatialLab";

type Point = { lat: number; lng: number };

type Props = {
  focus: SpatialFocus;
  campus: Campus | null;
  amenities: Amenity[];
  tileTemplate: string | null;
};

const WIDTH = 640;
const HEIGHT = 360;

function tileIndex(lat: number, lng: number, zoom: number) {
  const scale = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * scale);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale);
  return { x, y, z: zoom };
}

function expand(points: Array<Point & { radiusM?: number }>) {
  let minLat = Math.min(...points.map((point) => point.lat));
  let maxLat = Math.max(...points.map((point) => point.lat));
  let minLng = Math.min(...points.map((point) => point.lng));
  let maxLng = Math.max(...points.map((point) => point.lng));
  const midLat = (minLat + maxLat) / 2;
  const mPerLat = 111320;
  const mPerLng = Math.max(111320 * Math.cos((midLat * Math.PI) / 180), 1);
  points.forEach((point) => {
    if (!point.radiusM) return;
    minLat -= point.radiusM / mPerLat;
    maxLat += point.radiusM / mPerLat;
    minLng -= point.radiusM / mPerLng;
    maxLng += point.radiusM / mPerLng;
  });
  const latPad = Math.max((maxLat - minLat) * 0.18, 0.004);
  const lngPad = Math.max((maxLng - minLng) * 0.18, 0.004);
  minLat -= latPad;
  maxLat += latPad;
  minLng -= lngPad;
  maxLng += lngPad;
  return { minLat, maxLat, minLng, maxLng, mPerLat };
}

export default function SpatialMap({ focus, campus, amenities, tileTemplate }: Props) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const geometry = mapGeometry(focus);
  const frame = useMemo(() => {
    const points: Array<Point & { radiusM?: number }> = [];
    if (geometry.kind === "area") points.push({ lat: geometry.lat, lng: geometry.lng, radiusM: geometry.radiusM });
    if (geometry.kind === "pin") points.push({ lat: geometry.lat, lng: geometry.lng, radiusM: 250 });
    if (campus) points.push({ lat: campus.lat, lng: campus.lng });
    amenities.forEach((amenity) => points.push({ lat: amenity.lat, lng: amenity.lng }));
    if (points.length === 0 && campus) points.push({ lat: campus.lat, lng: campus.lng, radiusM: 400 });
    if (points.length === 0) return null;
    const bounds = expand(points);
    const spanLat = bounds.maxLat - bounds.minLat;
    const spanLng = bounds.maxLng - bounds.minLng;
    const project = (lat: number, lng: number) => ({
      x: ((lng - bounds.minLng) / spanLng) * WIDTH,
      y: ((bounds.maxLat - lat) / spanLat) * HEIGHT,
    });
    const radiusPx = geometry.kind === "area" ? (geometry.radiusM / bounds.mPerLat / spanLat) * HEIGHT : 0;
    return { project, radiusPx };
  }, [amenities, campus, geometry]);

  const tile = geometry.kind !== "none" && tileTemplate ? tileIndex(geometry.lat, geometry.lng, 15) : null;
  const tileUrls = tile && tileTemplate
    ? [tile, { ...tile, x: tile.x + 1 }].map((item) => fillTileTemplate(tileTemplate, item)).filter((url): url is string => Boolean(url))
    : [];

  return (
    <figure className="spatial-map-figure">
      <div className="spatial-map" aria-hidden="true">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="presentation">
          <rect width={WIDTH} height={HEIGHT} fill="#0B1B2B" />
          <rect x="24" y="24" width={WIDTH - 48} height={HEIGHT - 48} rx="18" fill="#112436" />
          {frame && geometry.kind === "area" && (
            <circle
              cx={frame.project(geometry.lat, geometry.lng).x}
              cy={frame.project(geometry.lat, geometry.lng).y}
              r={Math.max(frame.radiusPx, 18)}
              fill="rgba(26,188,156,0.22)"
              stroke="#1ABC9C"
              strokeWidth="2"
            />
          )}
          {amenities.map((amenity) => {
            if (!frame) return null;
            const spot = frame.project(amenity.lat, amenity.lng);
            return <circle key={amenity.id} cx={spot.x} cy={spot.y} r="5" fill="#FF6F3C" />;
          })}
          {frame && geometry.kind === "pin" && (
            <g>
              <circle cx={frame.project(geometry.lat, geometry.lng).x} cy={frame.project(geometry.lat, geometry.lng).y} r="8" fill="#FF6F3C" />
              <circle cx={frame.project(geometry.lat, geometry.lng).x} cy={frame.project(geometry.lat, geometry.lng).y} r="3" fill="#fff" />
            </g>
          )}
          {frame && campus && (
            <g>
              <circle cx={frame.project(campus.lat, campus.lng).x} cy={frame.project(campus.lat, campus.lng).y} r="7" fill="#0B1B2B" stroke="#FFFFFF" strokeWidth="2" />
            </g>
          )}
        </svg>
        <p className="spatial-map-caption">
          {focus.precision === "area-only" && "Known area only. No coordinates were published, so no pin was placed."}
          {geometry.kind === "area" && "Published area. The circle is not a building pin."}
          {geometry.kind === "pin" && "DEV fixture pin. Not a surveyed building."}
          {focus.precision !== "area-only" && geometry.kind === "none" && "No pin. This home has no published location."}
        </p>
      </div>
      {tileUrls.length > 0 && !tilesFailed ? (
        <div className="spatial-tiles">
          {tileUrls.map((url) => (
            // Tile hosts are chosen at deploy time, so next/image remotePatterns cannot list them.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} alt="" src={url} onError={() => setTilesFailed(true)} />
          ))}
          <p className="spatial-note">Provider imagery of the published area. It does not prove ownership, condition, availability, or safety.</p>
        </div>
      ) : (
        <p className="spatial-note">
          {tilesFailed
            ? "Map imagery could not load. The distance sketch above still works."
            : focus.precision === "area-only"
              ? "No photograph. A named area is published, but no coordinate was published."
              : geometry.kind === "none"
              ? "No photograph. This home has no published location."
              : "Distance sketch. Not a photograph. Map imagery is not configured."}
        </p>
      )}
    </figure>
  );
}
