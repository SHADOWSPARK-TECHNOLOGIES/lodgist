# Spatial Lab

Renters can open Spatial Lab from a public home, see the published area, pick a campus, and read straight-line distance to the campus area center. Road time appears only when a routing provider answers, and that road result ends at the campus area center, not an entrance. Nearby shops, pharmacies, clinics, and transport stops appear only when a place provider answers. Map imagery does not prove ownership, condition, availability, or safety. The lab does not infer crime, flood, power, or safety.

The Nekede page (`/nekede`, commits `c8683fb4` and `9aaeba7a`) stays a labelled example. It is not a listing and Spatial Lab does not publish it.

A second, smaller surface already ships on the listing page from `d904f92d` (`frontend/src/lib/campusDirections.js`). It is not Spatial Lab. It prints an approximate distance for a Nekede area and links the browser to openstreetmap.org. See "Listing-page map link" below.

## Provider choice

No code, data, or assets were copied from [gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view). Rechecked `main` at `e7707d9a0f34d9fbffc300023c319f95caa5be30` (2026-09-29). The repository LICENSE is MIT for source code only. Bundled datasets and models keep their own terms, including noncommercial sets (TeleGeography cables CC BY-NC-SA, flood imagery CC BY-NC) and surveillance-style layers (aircraft, ships, military). Those are out of scope.

| Need | Choice | When it runs |
|---|---|---|
| Map | In-repo distance sketch, kept as the fallback | Always, unless a tile layer is actually drawn. |
| Imagery | Web Mercator grid from `NEXT_PUBLIC_MAP_TILE_URL` | Only when that template is set and `NEXT_PUBLIC_MAP_ATTRIBUTION` is non-empty. One failed image returns to the sketch. There is no default tile server. |
| Campuses | Two OpenStreetMap area centers, ODbL 1.0 | Bundled. Federal Polytechnic Nekede is relation `12519494`. Imo State University is way `797998350`. These are area centers, not building doors and not entrances. |
| Straight-line | Haversine in `frontend/src/lib/spatialLab.js` | Always, labelled `straight-line to campus center`. No assumed speed and no invented minutes. |
| Road route | OSRM-compatible HTTP API | Only if `OSRM_BASE_URL` is set. Otherwise the UI says `Routing unavailable`. The public OSRM demo is not a default. |
| Nearby places | Overpass interpreter | Only if `OVERPASS_INTERPRETER_URL` is set. Failure and missing config return an empty list. Fixture businesses are never inserted. |

Campus coordinates are © OpenStreetMap contributors, ODbL 1.0. https://www.openstreetmap.org/copyright

Federal University of Technology Owerri is not in the campus list. A search returned a motorway junction and a road, not a campus area. No entrance coordinate is bundled. Do not describe a route to an area center as a route to a campus entrance.

### Production terms checked 2026-10-07

No service was purchased. No public demo URL is the default.

- Tiles. The OSMF tile policy (https://operations.osmfoundation.org/policies/tiles/) allows `https://tile.openstreetmap.org/{z}/{x}/{y}.png` only with visible attribution, an identifiable User-Agent, a valid Referer, and caching. Bulk download is forbidden. OSMF may block traffic without notice. This app does not set a custom User-Agent and does not implement a seven-day tile cache, so that host is not a suitable production default. Put a host this product is allowed to use in `NEXT_PUBLIC_MAP_TILE_URL`.
- Routing. Spatial Lab calls `GET {OSRM_BASE_URL}/route/v1/driving/{lng},{lat};{destLng},{destLat}?overview=false` only when `OSRM_BASE_URL` is set. The FOSSGIS demo at `router.project-osrm.org` is a demo: about one request per second, no uptime guarantee, and a poor fit for a commercial product (https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server and https://map.project-osrm.org/about.html). Production routing is a self-hosted OSRM, or a contracted router that speaks this path. The destination coordinate is the campus area center.
- Amenities. Spatial Lab POSTs to `OVERPASS_INTERPRETER_URL` only when it is set. The public Overpass instance asks commercial apps to use a self-hosted or paid server, and the wiki describes that instance as overloaded (https://wiki.openstreetmap.org/wiki/Overpass_API). Do not point production at `https://overpass-api.de/api/interpreter` by default.

### Listing-page map link

`campusDirections` builds a browser link. For a Nekede place with a public `approxLocation`, the link is `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route={snappedLat},{snappedLng};{campusLat},{campusLng}`. That is the OSM website, not `OSRM_BASE_URL`. The coordinates are the public snapped area (about 500 m), not the landlord latitude and longitude. The sentence on the page says this is not a door-to-gate measurement. Other areas get an OSM map link at the snapped point, with no invented campus distance.

## Environment variable names

Values are not documented here. None of these were set in the environment used to verify this change.

| Name | Where it is read | Format |
|---|---|---|
| `NEXT_PUBLIC_MAP_TILE_URL` | Build-time browser config. Next inlines `NEXT_PUBLIC_*` into the client bundle. | `https` URL containing `{z}`, `{x}`, and `{y}`. `http://127.0.0.1` and `http://localhost` are accepted so a local tile fixture can be tested. Any other `http` host is rejected. |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | Build-time browser config. | Plain-text credit. Tiles do not render while this is empty. |
| `OSRM_BASE_URL` | Server runtime. The Next route reads `process.env`. | Base URL with no path suffix. |
| `OVERPASS_INTERPRETER_URL` | Server runtime. The Next route reads `process.env`. | Full interpreter URL. |
| `NEXT_PUBLIC_API_URL` | Build-time, and also read by the Next server from `process.env`. | Express listings API base. Default in code is `http://localhost:4000`. This is not the service that implements `/api/spatial/listings/:id`. That route is the Next app on the same origin. It fetches `{NEXT_PUBLIC_API_URL}/api/listings/:id` with no `Authorization` header. |

## What is fixture-tested vs live

Fixture-tested in `frontend` `npm test` (node:test, no network):

- Coordinate parsing
- Publication gate (samples, fixtures, flagged, suspended, rejected, fraud)
- `reviewStatus: APPROVED` is review-for-display, not evidence verification
- Exact coordinates, snapped coordinates, and campus-center coordinates stay out of Spatial Lab directions links
- Straight-line label says `straight-line to campus center` and has no travel time
- A successful route description names the campus area center and says it is not an entrance
- Routing failure, missing routing config, amenity failure, missing amenity config
- Preview model `inventory: "excluded"` and `fixture: true` cannot be built as a public home
- A tile template with attribution produces a Web Mercator grid around the public focus. Unknown locations produce no tiles. Missing attribution produces no tiles. A non-local `http` template is rejected. Private coordinate strings are not in the tile payload.
- `campusDirections` distance copy and its OSM link shape
- Viewing-status labels

Not proven by those unit tests:

- A live tile host, live OSRM, or live Overpass. No provider variable was set, so those calls were not made. Status: **BLOCKED**.
- Database-backed HTTP checks of published, unpublished, and approximate homes. No isolated database was started, and the production database was not used. The publication helper tests are not proof that every public route enforces the helper. Status: **BLOCKED**.

The preview route `/spatial-lab/preview` and `GET /api/spatial/preview` always use the DEV fixture. They do not call those providers and they are not part of listing search. `robots` is `noindex`. Enquiry is disabled.

`GET /api/spatial/listings/:id` loads the public listing anonymously, drops unpublished and sample rows, and never attaches fixture amenities. It does not send exact landlord coordinates to a provider. The public listing API already exposes only a snapped area.

An approximate directions link uses the area name and the campus name. It does not put a home coordinate or a campus-center coordinate in the URL. An exact origin is allowed only for the DEV fixture pin, and only on the preview. The destination is still the campus name, because no entrance coordinate is confirmed.

## Deploy and rollback

Frontend only for this Spatial Lab change. No Spatial Lab schema change. No production deploy is part of this change. Do not set the public demo tile, OSRM, or Overpass URLs.

1. Deploy the frontend the same way the current Next app is deployed.
2. Leave the provider variables unset to ship the sketch, straight-line distances to campus centers, and explicit unavailable states.
3. To turn imagery on, set both `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_ATTRIBUTION` at **build** time, then rebuild. Unset either one and rebuild to return to the sketch.
4. Set `OSRM_BASE_URL` or `OVERPASS_INTERPRETER_URL` on the **Next server** runtime to turn that provider on. Unset it to turn that provider off. The sketch remains.
5. `NEXT_PUBLIC_API_URL` must point at the Express listings API, not at the Next app itself.
6. Rollback of Spatial Lab is reverting this frontend change. Listing pages keep the separate area-and-campus link from `campusDirections`. Nothing in this change is written to the listing database.

## Remaining blockers

- No tile, routing, or amenity provider is configured. Live provider status is blocked, not a failed live test.
- `tile.openstreetmap.org`, `router.project-osrm.org`, and `overpass-api.de` are not acceptable production defaults for this app.
- Public homes still have no exact pin by design. Spatial Lab will not geocode a building.
- Owerri campus coverage is Federal Polytechnic Nekede and Imo State University area centers only. FUTO stays off the list. No entrance coordinate is confirmed.
- The listing-page OSM directions link sends the public snapped area into the OSM website. Spatial Lab does not. Those two surfaces are intentionally different, and the OSM link is not a production routing integration.
- Database-backed checks of the public page and the spatial HTTP API have not been run.
- Zero reviewed Nekede homes remain a product fact from the handoff, not a count taken from a database in this run. The preview fixture must not be treated as inventory.
