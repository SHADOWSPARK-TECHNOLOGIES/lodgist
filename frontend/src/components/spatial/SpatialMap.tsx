"use client";

import { useState } from "react";
import type { Amenity, Campus, SpatialFocus } from "@lodgist/spatial-core";
import { mapGeometry } from "@/lib/spatialPublic";
import { projectOnLayer, tileLayer } from "@/lib/spatialTiles";

type Props = {
  focus: SpatialFocus;
  campus: Campus | null;
  amenities: Amenity[];
  tileTemplate: string | null;
  tileAttribution: string | null;
};

const WIDTH = 640;
const HEIGHT = 280;

function inside(point: { x: number; y: number } | null) {
  if (!point) return false;
  return point.x >= 8 && point.x <= WIDTH - 8 && point.y >= 8 && point.y <= HEIGHT - 8;
}

export default function SpatialMap({ focus, campus, amenities, tileTemplate, tileAttribution }: Props) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const geometry = mapGeometry(focus);
  const layer = tilesFailed ? null : tileLayer({
    focus,
    template: tileTemplate,
    attribution: tileAttribution,
    width: WIDTH,
    height: HEIGHT,
  });

  if (layer) {
    const area = geometry.kind === "area" ? projectOnLayer(layer, geometry.lat, geometry.lng) : null;
    const pin = geometry.kind === "pin" ? projectOnLayer(layer, geometry.lat, geometry.lng) : null;
    const campusPoint = campus ? projectOnLayer(layer, campus.lat, campus.lng) : null;
    return (
      <figure className="spatial-map-figure">
        <div className="spatial-tiles-map">
          {layer.tiles.map((tile) => (
            // Tile hosts are chosen at deploy time, so next/image remotePatterns cannot list them.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={tile.url}
              alt=""
              src={tile.url}
              style={{
                left: `${(tile.left / WIDTH) * 100}%`,
                top: `${(tile.top / HEIGHT) * 100}%`,
                width: `${(256 / WIDTH) * 100}%`,
              }}
              onError={() => setTilesFailed(true)}
            />
          ))}
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="presentation">
            {area && layer.focusRadiusPx && (
              <circle cx={area.x} cy={area.y} r={Math.max(layer.focusRadiusPx, 12)} fill="rgba(26,188,156,0.28)" stroke="#1ABC9C" strokeWidth="2" />
            )}
            {amenities.map((amenity) => {
              const spot = projectOnLayer(layer, amenity.lat, amenity.lng);
              if (!inside(spot) || !spot) return null;
              return <circle key={amenity.id} cx={spot.x} cy={spot.y} r="5" fill="#FF6F3C" />;
            })}
            {pin && <g><circle cx={pin.x} cy={pin.y} r="8" fill="#FF6F3C" /><circle cx={pin.x} cy={pin.y} r="3" fill="#fff" /></g>}
            {campusPoint && inside(campusPoint) && (
              <circle cx={campusPoint.x} cy={campusPoint.y} r="7" fill="#0B1B2B" stroke="#FFFFFF" strokeWidth="2" />
            )}
          </svg>
          <p className="spatial-attribution">{layer.attribution}</p>
        </div>
        <figcaption className="spatial-note">
          {geometry.kind === "area" && "Published area on the configured map. The circle is not a building pin."}
          {geometry.kind === "pin" && "DEV fixture pin on the configured map. Not a surveyed building."}
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="spatial-map-figure">
      <Sketch focus={focus} campus={campus} amenities={amenities} />
      <figcaption className="spatial-note">
        {tilesFailed
          ? "Map imagery could not load. The distance sketch above still works."
          : geometry.kind === "none"
            ? "No photograph. This home has no published location."
            : tileTemplate && !tileAttribution
              ? "Map imagery stays off until an attribution line is configured. The distance sketch above still works."
              : "Distance sketch. Not a photograph. Map imagery is not configured."}
      </figcaption>
    </figure>
  );
}

function Sketch({ focus, campus, amenities }: { focus: SpatialFocus; campus: Campus | null; amenities: Amenity[] }) {
  const geometry = mapGeometry(focus);
  const points: Array<{ lat: number; lng: number; radiusM?: number }> = [];
  if (geometry.kind === "area") points.push({ lat: geometry.lat, lng: geometry.lng, radiusM: geometry.radiusM });
  if (geometry.kind === "pin") points.push({ lat: geometry.lat, lng: geometry.lng, radiusM: 250 });
  if (campus) points.push({ lat: campus.lat, lng: campus.lng });
  amenities.forEach((amenity) => points.push({ lat: amenity.lat, lng: amenity.lng }));
  if (points.length === 0 && campus) points.push({ lat: campus.lat, lng: campus.lng, radiusM: 400 });
  const frame = points.length === 0 ? null : sketchFrame(points);
  const radiusPx = frame && geometry.kind === "area" ? (geometry.radiusM / frame.mPerLat / frame.spanLat) * HEIGHT : 0;

  return (
    <div className="spatial-map" aria-hidden="true">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="presentation">
        <rect width={WIDTH} height={HEIGHT} fill="#0B1B2B" />
        <rect x="24" y="24" width={WIDTH - 48} height={HEIGHT - 48} rx="18" fill="#112436" />
        {frame && geometry.kind === "area" && (
          <circle
            cx={frame.project(geometry.lat, geometry.lng).x}
            cy={frame.project(geometry.lat, geometry.lng).y}
            r={Math.max(radiusPx, 18)}
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
          <circle cx={frame.project(campus.lat, campus.lng).x} cy={frame.project(campus.lat, campus.lng).y} r="7" fill="#0B1B2B" stroke="#FFFFFF" strokeWidth="2" />
        )}
      </svg>
      <p className="spatial-map-caption">
        {geometry.kind === "area" && "Published area. The circle is not a building pin."}
        {geometry.kind === "pin" && "DEV fixture pin. Not a surveyed building."}
        {geometry.kind === "none" && "No pin. This home has no published location."}
      </p>
    </div>
  );
}

function sketchFrame(points: Array<{ lat: number; lng: number; radiusM?: number }>) {
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
  const spanLat = maxLat - minLat;
  const spanLng = maxLng - minLng;
  return {
    mPerLat,
    spanLat,
    project: (lat: number, lng: number) => ({
      x: ((lng - minLng) / spanLng) * WIDTH,
      y: ((maxLat - lat) / spanLat) * HEIGHT,
    }),
  };
}
