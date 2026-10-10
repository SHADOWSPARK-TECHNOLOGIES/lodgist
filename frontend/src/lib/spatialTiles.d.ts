import type { SpatialFocus } from "@lodgist/spatial-core";

export interface MapTile {
  url: string;
  left: number;
  top: number;
  z: number;
  x: number;
  y: number;
}

export interface TileLayer {
  zoom: number;
  attribution: string;
  width: number;
  height: number;
  originX: number;
  originY: number;
  tiles: MapTile[];
  focusRadiusPx: number | null;
}

export function tileLayer(input: {
  focus: SpatialFocus;
  template: string | null;
  attribution: string | null;
  width: number;
  height: number;
}): TileLayer | null;

export function projectOnLayer(layer: TileLayer | null, lat: number, lng: number): { x: number; y: number } | null;
