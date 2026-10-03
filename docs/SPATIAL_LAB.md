# Spatial Lab

Renters can open Spatial Lab from a public home, see the published area, pick a campus, and read straight-line distance. Road time appears only when a routing provider answers. Nearby shops, pharmacies, clinics, and transport stops appear only when a place provider answers. Map imagery does not prove ownership, condition, availability, or safety. The lab does not infer crime, flood, power, or safety.

The Nekede page (`/nekede`, commits `c8683fb4` and `9aaeba7a`) stays a labelled example. It is not a listing and Spatial Lab does not publish it.

## Provider choice

No code, data, or assets were copied from [gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view). Rechecked `main` at `e7707d9a0f34d9fbffc300023c319f95caa5be30` (2026-09-29). The repository LICENSE is MIT for source code only. Bundled datasets and models keep their own terms, including noncommercial sets (TeleGeography cables CC BY-NC-SA, flood imagery CC BY-NC) and surveillance-style layers (aircraft, ships, military). Those are out of scope. Lodgist uses a small in-repo distance sketch instead of a globe.

| Need | Choice | When it runs |
|---|---|---|
| Map | In-repo 2D distance sketch | Always. No tile host is called unless `NEXT_PUBLIC_MAP_TILE_URL` is set. |
| Imagery | Optional `https` tile template with `{z}`, `{x}`, `{y}` | Only if that env var is set. There is no default OpenStreetMap tile server. |
| Campuses | Two OpenStreetMap area centers, ODbL 1.0 | Bundled. Federal Polytechnic Nekede is relation `12519494`. Imo State University is way `797998350`. Not building doors. |
| Straight-line | Haversine in `frontend/src/lib/spatialLab.js` | Always, labelled `straight-line`. No assumed speed and no invented minutes. |
| Road route | OSRM-compatible HTTP API | Only if `OSRM_BASE_URL` is set. Otherwise the UI says `Routing unavailable`. The public OSRM demo is not a default. |
| Nearby places | Overpass interpreter | Only if `OVERPASS_INTERPRETER_URL` is set. Failure and missing config return an empty list. Fixture businesses are never inserted. |

Campus coordinates are © OpenStreetMap contributors, ODbL 1.0. https://www.openstreetmap.org/copyright

Federal University of Technology Owerri is not in the campus list. A search returned a motorway junction and a road, not a campus area.

## Environment variable names

Values are not documented here.

- `NEXT_PUBLIC_MAP_TILE_URL` — optional client tile template. Must be `https` and include `{z}`, `{x}`, and `{y}`.
- `OSRM_BASE_URL` — optional server base URL for road routing.
- `OVERPASS_INTERPRETER_URL` — optional server URL for nearby places.
- `NEXT_PUBLIC_API_URL` — existing listing API base. Spatial Lab reads public listings through it and does not forward the caller's auth header.

## What is fixture-tested vs live

Fixture-tested, with no live provider:

- Coordinate parsing
- Publication gate (samples, fixtures, flagged, suspended, rejected, fraud)
- `reviewStatus: APPROVED` is review-for-display, not evidence verification
- Exact coordinates and snapped coordinates stay out of approximate directions links
- Straight-line label
- Routing failure, missing routing config, amenity failure, missing amenity config
- Preview model `inventory: "excluded"` and `fixture: true` cannot be built as a public home

Live provider, only when the env var is present on a **public** listing:

- Road distance and duration from `OSRM_BASE_URL`
- Nearby places from `OVERPASS_INTERPRETER_URL`
- Tile images from `NEXT_PUBLIC_MAP_TILE_URL`

The preview route `/spatial-lab/preview` and `GET /api/spatial/preview` always use the DEV fixture. They do not call those providers and they are not part of listing search. `robots` is `noindex`. Enquiry is disabled.

`GET /api/spatial/listings/:id` loads the public listing anonymously, drops unpublished and sample rows, and never attaches fixture amenities. It does not send exact landlord coordinates to a provider. The public listing API already exposes only a snapped area.

An approximate directions link uses the area name. It does not put a home coordinate in the URL. An exact coordinate is allowed only for the DEV fixture pin, and only on the preview.

## Deploy and rollback

Frontend only. No schema change, no backend change, no production deploy in this change.

1. Deploy the frontend the same way the current Next app is deployed.
2. Leave the three provider variables unset to ship the sketch, straight-line distances, and explicit unavailable states.
3. Set a provider variable only for that provider. Unset it to turn that provider off. The sketch remains.
4. Rollback is reverting this frontend change. Listing pages keep working; the neighborhood control disappears with the revert. Nothing is written to the listing database.

## Remaining blockers

- No tile, routing, or amenity provider is configured in this repo. That is a live-provider gap, not an unfinished sketch.
- Public homes still have no exact pin by design. Spatial Lab will not geocode a building.
- Owerri campus coverage is Federal Polytechnic Nekede and Imo State University only.
- Zero reviewed Nekede homes remain zero. The preview fixture must not be treated as inventory.
