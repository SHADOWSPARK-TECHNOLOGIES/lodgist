# Nigeria spatial coverage (research)

Status: research. Promoted from the 2026-10-10 draft. Licence rows are as checked on 2026-10-10 (UTC). This is not legal advice.
Scope: the Lodgist rental platform in Port Harcourt, Lagos, Abuja and Owerri, plus university areas (UNIPORT, UNILAG, UNIABUJA, FUTO, IMSU, Federal Poly Nekede).

## 1. Licence classification

"VERIFIED" means I opened the terms page with WebFetch on 2026-10-10 and the class below matches what the page says. "UNVERIFIED" means the page was not fetched or could not be read. UNVERIFIED rows need a manual check.

| Provider | Class | What the fetched page says | Terms link | Status |
|---|---|---|---|---|
| OpenStreetMap data | APPROVED_WITH_ATTRIBUTION | ODbL. You must credit OpenStreetMap and make clear the data is ODbL. If you alter or build on the data and distribute the result, it must also be ODbL (share-alike). | https://www.openstreetmap.org/copyright | VERIFIED (url above, 2026-10-10) |
| Public Overpass API | DEVELOPMENT_ONLY | Guideline is about 10,000 requests/day and under 1 GB/day. The page lists "setting up an app for more than just OSM mappers and relying on the public instances as backend" as problematic behaviour. | https://dev.overpass-api.de/overpass-doc/en/preface/commons.html | VERIFIED (2026-10-10) |
| OSRM public demo | NON_COMMERCIAL | "restricted to reasonable, non-commercial use-cases. Do not exceed 1 request per second." No uptime guarantees. | https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server | VERIFIED (2026-10-10) |
| Self-hosted OSRM / Valhalla / GraphHopper | APPROVED_WITH_ATTRIBUTION (OSM data) | Engine licences assumed to be BSD-2 / MIT / Apache-2.0. | https://github.com/Project-OSRM/osrm-backend/blob/master/LICENSE.TXT , https://github.com/valhalla/valhalla/blob/master/COPYING , https://github.com/graphhopper/graphhopper/blob/master/LICENSE.txt | UNVERIFIED (licence files not fetched) |
| Nominatim public | DEVELOPMENT_ONLY | Maximum 1 request/second. Requires a real User-Agent and attribution. Forbids autocomplete, systematic queries, and reselling geocoding. Warns commercial apps that access can be withdrawn. The policy does not apply to self-hosted instances, so a self-hosted Nominatim would be APPROVED_WITH_ATTRIBUTION. | https://operations.osmfoundation.org/policies/nominatim/ | VERIFIED (2026-10-10) |
| Photon public (komoot) | DEVELOPMENT_ONLY | "please be fair - extensive usage will be throttled. We do not guarantee for the availability." | https://photon.komoot.io/ | VERIFIED (2026-10-10). The self-host licence (Apache-2.0) is UNVERIFIED. |
| Google Maps Platform | APPROVED_COMMERCIAL (paid, restrictive) | Geocoding, Places, Routes and Directions content must not be used with a non-Google map. Lat/lng may be cached for at most 30 days. place_id may be cached. Geocoding results may be cached indefinitely only per end user, isolated to that user. The Places Aggregate API cannot be used for decisions or scoring about housing (section 13.3), which matters for a rental platform. | https://cloud.google.com/maps-platform/terms/maps-service-terms | VERIFIED (2026-10-10) |
| Mapbox Geocoding | APPROVED_COMMERCIAL (paid) | Temporary results may not be cached. Permanent results (which need a card on file) may be stored. "You may only use responses from the Geocoding API in conjunction with a Mapbox map." | https://docs.mapbox.com/api/search/geocoding/ | VERIFIED (2026-10-10) |
| HERE | UNKNOWN | Not verified; the URL I guessed returned 404. | https://legal.here.com/en-gb/terms | UNVERIFIED |
| TomTom | APPROVED_COMMERCIAL (paid subscription); free tier = DEVELOPMENT_ONLY | Free access is for Evaluation Use only (section 2.2). Caching is allowed only per client and within cache headers (section 11.4). Building a derived database is forbidden (section 11.6.1). Results must not be combined with ODbL/copyleft data (section 20.2.3). | https://developer.tomtom.com/terms-and-conditions | VERIFIED (2026-10-10) |
| Mapillary | APPROVED_WITH_ATTRIBUTION | Images are CC-BY-SA. The page gives an attribution format. | https://help.mapillary.com/hc/en-us/articles/115001770409 | VERIFIED (2026-10-10). The API/platform terms (https://www.mapillary.com/terms) are UNVERIFIED. |
| Open-Meteo | NON_COMMERCIAL (free); APPROVED_COMMERCIAL (paid API Standard and above) | Free tier is non-commercial only. Apps with subscriptions or ads count as commercial. Data is CC-BY 4.0. | https://open-meteo.com/en/terms | VERIFIED (2026-10-10) |
| NASA Earthdata / GFMS | APPROVED_WITH_ATTRIBUTION (presumed) | The fetch timed out. | https://www.earthdata.nasa.gov/engage/open-data-services-software-policies , http://flood.umd.edu/ | UNVERIFIED |
| Copernicus (EMS / GloFAS) | UNKNOWN for data | The page I fetched covers only the Copernicus trademark licence. The data licence was not confirmed. | https://www.copernicus.eu/en/access-data/copyright-and-licences | UNVERIFIED (data terms) |
| GRID3 Nigeria | UNKNOWN | The data hub is live. Nigeria Health Facilities v3.0 (published Aug 2026), Settlement Extents v4.1, Roads v1.0 and Operational Wards v3.0 are listed. No licence text on the hub page, and the terms URL I guessed returned 404. | https://data.grid3.org/ | UNVERIFIED (licence). Check each dataset page. |
| HDX datasets | UNKNOWN (licence set per dataset) | The page returned 403 to the fetch tool. | https://data.humdata.org/faqs/licenses | UNVERIFIED |
| healthsites.io | APPROVED_WITH_ATTRIBUTION | "freely available under an Open Data License (ODBL)". | https://healthsites.io/ | VERIFIED (2026-10-10) |
| Land registries (LASRRA/Lands Bureau, AGIS, Rivers/Imo) | UNKNOWN | No open licence found. Do not scrape. | https://agis.fcta.gov.ng/ , https://lands.lagosstate.gov.ng/ | UNVERIFIED |

## 2. Measured OSM coverage (offline)

Generated by `scripts/nigeria_benchmark.py`; machine-readable output in `docs/benchmarks/nigeria-osm-2026-10-09.json`.
Source: Geofabrik `nigeria-latest.osm.pbf` (710,005,275 bytes), OSM replication timestamp **2026-10-09T20:21:04Z**. The extract is not committed.
Data © OpenStreetMap contributors, available under the Open Database License (ODbL 1.0): https://www.openstreetmap.org/copyright

Method: nodes and ways with matching tags whose point (node) or vertex mean (way) is within 3,000 m (haversine) of the point. Relations (multipolygon campuses) are not counted, so numbers are lower bounds. "highway ways" counts all `highway=*` ways; "named" counts those with a `name` tag. No online provider was called.

Grade (rule-based): EMPTY = 0 POI and fewer than 100 highway ways; POOR = fewer than 15 POI or under 5% named roads; PARTIAL = fewer than 50 POI or under 20% named; otherwise GOOD.

Coordinates: every point except Nekede was checked against a named OSM feature in this extract (see `coordNote` in the JSON). Nekede has no campus feature in OSM; the only named feature is an off-campus guest house, so its point stays approximate and its zero counts are not meaningful.

| Point (lat,lon) | verified | hospital | clinic | pharmacy | school | university | college | marketplace | supermarket | fuel | bank | police | bus_station | POI | highway ways | named | % named | grade |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| UNIPORT Choba (4.9,6.918) | yes | 1 | 4 | 0 | 9 | 3 | 0 | 2 | 1 | 6 | 9 | 0 | 2 | 37 | 1708 | 159 | 9.3% | PARTIAL |
| Rumuokoro (4.8668,6.997) | yes | 2 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 3 | 2 | 0 | 1 | 11 | 2376 | 64 | 2.7% | POOR |
| Yaba / UNILAG (6.5164,3.3943) | yes | 5 | 1 | 2 | 22 | 2 | 1 | 1 | 1 | 2 | 9 | 2 | 2 | 50 | 1756 | 460 | 26.2% | GOOD |
| Surulere (6.5008,3.3571) | yes | 36 | 0 | 2 | 25 | 0 | 2 | 4 | 2 | 7 | 10 | 1 | 3 | 92 | 2905 | 830 | 28.6% | GOOD |
| Wuse (9.0621,7.4666) | yes | 6 | 0 | 6 | 4 | 0 | 1 | 6 | 10 | 18 | 28 | 0 | 1 | 80 | 3453 | 572 | 16.6% | PARTIAL |
| UNIABUJA main campus (8.981,7.1761) | yes | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 272 | 5 | 1.8% | POOR |
| Gwagwalada town (8.936,7.0859) | yes | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 2 | 0 | 0 | 4 | 1807 | 15 | 0.8% | POOR |
| Owerri town (5.4897,7.0342) | yes | 2 | 0 | 2 | 6 | 1 | 0 | 1 | 4 | 6 | 6 | 0 | 0 | 28 | 1506 | 112 | 7.4% | PARTIAL |
| IMSU (5.5065,7.044) | yes | 2 | 0 | 2 | 2 | 1 | 0 | 0 | 3 | 4 | 5 | 0 | 0 | 19 | 1347 | 35 | 2.6% | POOR |
| FUTO (5.385,6.993) | yes | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 384 | 4 | 1.0% | POOR |
| Federal Polytechnic Nekede (5.43,7.03) | no | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 600 | 1 | 0.2% | POOR |

How to read this:
- Lagos (Yaba, Surulere) is the only GOOD area; even there only 26-29% of road segments are named.
- Wuse Abuja has many POIs but 17% named roads.
- Port Harcourt and Owerri/Imo points have 1-9% named roads and few POIs.
- UNIABUJA, Gwagwalada, FUTO and Nekede are close to empty for POIs.

Re-run:

```
pip install osmium
NIGERIA_OSM_PBF=/path/to/nigeria-latest.osm.pbf python3 scripts/nigeria_benchmark.py --output docs/benchmarks/nigeria-osm-<date>.json
```
About 9 minutes and a few GB of RAM on the full extract. Tests: `node --test packages/spatial-core/test/nigeriaBenchmark.test.cjs` (tiny synthetic fixture, no pyosmium needed).

## 3. Coverage matrix

| Capability | Primary | Coverage (evidence) | Freshness | Known gaps | Commercial rights | Fallback |
|---|---|---|---|---|---|---|
| Geocoding | Landlord pin-drop plus self-hosted Photon or Nominatim | POOR outside Lagos/Abuja (named roads 0-9% in PH, Owerri and campus towns; §2) | OSM daily | No house numbers or street names | ODbL (VERIFIED) | Google Geocoding. Paid; no non-Google map; 30-day lat/lng caching (VERIFIED) |
| Reverse geocoding | Self-hosted Nominatim | PARTIAL, area level only | daily | Street level weak | ODbL | Google (same restrictions) |
| Neighborhood names | OSM place=* plus GRID3 settlements | UNMEASURED | — | Local names inconsistent | ODbL / GRID3 UNKNOWN | Lodgist's own list of area names |
| Roads | OSM | PARTIAL-GOOD geometry: 1,347-3,453 ways per 3 km in towns; 272-600 on peri-urban campuses | daily | Names, oneway, surface | ODbL | — |
| Routing | Self-hosted OSRM or Valhalla | PARTIAL (inherits road quality) | rebuild weekly | No traffic | OSS + ODbL | Google Routes or TomTom (paid) |
| Schools / universities | GRID3 plus OSM | OSM schools: 22-25 in Lagos, 0-9 elsewhere | GRID3 periodic | Private schools | GRID3 UNKNOWN | Google Places (live only) |
| Health | GRID3 Health Facilities v3.0 (Aug 2026) plus healthsites.io | OSM hospitals: 36 in Surulere, 0-6 elsewhere; pharmacies 0-6 | GRID3 Aug 2026 | Patent medicine stores | GRID3 UNKNOWN; healthsites ODbL VERIFIED | Google Places |
| Markets / supermarkets | OSM | POOR (0-6 marketplaces; supermarkets 0-10, with 10 in Wuse) | daily | Informal markets | ODbL | Google Places; manual entry |
| Transit | OSM | POOR (0-3 bus stations) | — | Danfo/keke routes absent | ODbL | Manual entry |
| Fuel / banks | OSM | PARTIAL in cores (Wuse: 18 fuel, 28 banks); 0 on outer campuses | daily | Peri-urban areas | ODbL | Google Places |
| Police / public facilities | GRID3 plus OSM | POOR (0-2 police per point) | — | — | GRID3 UNKNOWN | Google Places |
| Street-level imagery | Mapillary | UNMEASURED | sporadic | — | CC-BY-SA (VERIFIED) | Landlord photos |
| Flood | GloFAS / GFMS | Regional scale | daily | No street-level data | UNVERIFIED | User reports |
| Traffic | TomTom or Google (paid) | UNMEASURED | live | No open source | Paid; no derived database (VERIFIED) | none |
| Weather | Open-Meteo paid plan | City level | hourly | — | Free tier NON_COMMERCIAL (VERIFIED) | — |
| Land / property | none | — | — | Registries closed | UNKNOWN | Manual verification |

## 4. Blockers
1. Points of interest and street names in PH, Owerri, Gwagwalada and the campus towns are sparse in OSM; this was measured (§2).
2. Google, Mapbox and TomTom all restrict caching, derived databases, and use with non-Google/other maps. TomTom also forbids combining its results with ODbL data. This conflicts with an OSM-based Lodgist map. Google additionally bars housing-related scoring with the Places Aggregate API.
3. The free tiers of the public OSRM demo, Nominatim, Overpass, Photon, Open-Meteo and TomTom are non-commercial or evaluation-only.
4. Licences for GRID3, HDX, Copernicus and HERE are still UNVERIFIED.
