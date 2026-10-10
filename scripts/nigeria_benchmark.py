#!/usr/bin/env python3
"""Offline Nigeria OSM coverage benchmark for Lodgist.

Reads a Geofabrik Nigeria extract and counts mapped amenities and named roads
within RADIUS_M of fixed golden points. Writes benchmark.json.

Input:
  --input PATH   .osm.pbf (needs pyosmium: pip install osmium) or .osm XML
                 (stdlib only; used by the test fixture). Defaults to
                 $NIGERIA_OSM_PBF. The extract is never committed.
  --output PATH  defaults to benchmark.json
  --extract-date ISO timestamp; defaults to the file header
                 osmosis_replication_timestamp, else UNKNOWN.

Method: a node or way counts when its point (node) or vertex mean (way) is
within RADIUS_M (haversine). Relations (multipolygons) are not counted, so
counts are lower bounds. Data: (c) OpenStreetMap contributors, ODbL 1.0.
"""
import argparse
import json
import math
import os
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

SCHEMA_VERSION = 1
RADIUS_M = 3000
EARTH_RADIUS_M = 6371000.0

AMENITY_CATEGORIES = (
    "hospital", "clinic", "pharmacy", "school", "university", "college",
    "marketplace", "fuel", "bank", "police", "bus_station",
)
SHOP_CATEGORIES = ("supermarket",)
CATEGORIES = AMENITY_CATEGORIES[:7] + SHOP_CATEGORIES + AMENITY_CATEGORIES[7:]

PROVIDER = {
    "id": "osm-geofabrik-extract",
    "name": "OpenStreetMap via Geofabrik nigeria-latest.osm.pbf",
    "access": "offline extract",
    "license": "ODbL-1.0",
    "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
    "attribution": "\u00a9 OpenStreetMap contributors",
    "attributionUrl": "https://www.openstreetmap.org/copyright",
    "commercialUse": "APPROVED_WITH_ATTRIBUTION",
}

# verified: true means the coordinate was checked against a named OSM feature
# in the extract (see the note). false means an approximate centre.
GOLDEN_POINTS = (
    {"id": "uniport-choba", "label": "UNIPORT Choba", "city": "Port Harcourt", "lat": 4.9000, "lon": 6.9180,
     "verified": True, "note": "Near OSM 'Institute of Petroleum Studies' (4.8938,6.9161), on campus"},
    {"id": "rumuokoro", "label": "Rumuokoro", "city": "Port Harcourt", "lat": 4.8668, "lon": 6.9970,
     "verified": True, "note": "OSM node 501498446 'Rumuokoro' place=village"},
    {"id": "yaba-unilag", "label": "Yaba / UNILAG", "city": "Lagos", "lat": 6.5164, "lon": 3.3943,
     "verified": True, "note": "OSM way 539288366 'University of Lagos' amenity=university, vertex mean"},
    {"id": "surulere", "label": "Surulere", "city": "Lagos", "lat": 6.5008, "lon": 3.3571,
     "verified": True, "note": "OSM node 501527946 'Surulere' place=town"},
    {"id": "wuse", "label": "Wuse", "city": "Abuja", "lat": 9.0621, "lon": 7.4666,
     "verified": True, "note": "OSM node 8329698302 'Wuse District' place=suburb"},
    {"id": "uniabuja", "label": "UNIABUJA main campus", "city": "Abuja", "lat": 8.9810, "lon": 7.1761,
     "verified": True, "note": "OSM way 1133000152 'University of Abuja' amenity=university, vertex mean"},
    {"id": "gwagwalada", "label": "Gwagwalada town", "city": "Abuja", "lat": 8.9360, "lon": 7.0859,
     "verified": True, "note": "OSM node 501471969 'Gwagwalada' place=town"},
    {"id": "owerri-town", "label": "Owerri town", "city": "Owerri", "lat": 5.4897, "lon": 7.0342,
     "verified": True, "note": "OSM node 2469246094 'Owerri' place=city"},
    {"id": "imsu", "label": "IMSU", "city": "Owerri", "lat": 5.5065, "lon": 7.0440,
     "verified": True, "note": "OSM way 797998350 'Imo State University' amenity=university, vertex mean"},
    {"id": "futo", "label": "FUTO", "city": "Owerri", "lat": 5.3850, "lon": 6.9930,
     "verified": True, "note": "Between OSM 'DEPARTMENT OF ARCHITECTURE' and 'SOES FACULTY', on campus"},
    {"id": "nekede-poly", "label": "Federal Polytechnic Nekede", "city": "Owerri", "lat": 5.4300, "lon": 7.0300,
     "verified": False, "note": "Approximate. No OSM campus feature for the polytechnic; the only named feature is way 1334821787 'Federal Polytechnic Nekede Guest House' at 5.5038,7.0353 (off campus)"},
)


def haversine_m(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(min(1.0, a)))


def categorize(tags):
    """Return the benchmark category for an OSM tag dict, or None."""
    amenity = tags.get("amenity")
    if amenity in AMENITY_CATEGORIES:
        return amenity
    if tags.get("shop") in SHOP_CATEGORIES:
        return tags["shop"]
    return None


class Collector:
    """Keeps only features near a golden point, to bound memory."""

    def __init__(self, points, radius_m=RADIUS_M):
        self.points = points
        self.radius_m = radius_m
        pad_lat = radius_m / 111320.0 + 0.01
        self.boxes = []
        for p in points:
            pad_lon = radius_m / (111320.0 * max(0.2, math.cos(math.radians(p["lat"])))) + 0.01
            self.boxes.append((p["lat"] - pad_lat, p["lat"] + pad_lat, p["lon"] - pad_lon, p["lon"] + pad_lon))
        self.counts = [{c: 0 for c in CATEGORIES} for _ in points]
        self.roads = [[0, 0] for _ in points]

    def add(self, tags, lat, lon, is_way):
        category = categorize(tags)
        highway = is_way and "highway" in tags
        if category is None and not highway:
            return
        for i, (s, n, w, e) in enumerate(self.boxes):
            if not (s <= lat <= n and w <= lon <= e):
                continue
            p = self.points[i]
            if haversine_m(p["lat"], p["lon"], lat, lon) > self.radius_m:
                continue
            if category is not None:
                self.counts[i][category] += 1
            if highway:
                self.roads[i][0] += 1
                if tags.get("name"):
                    self.roads[i][1] += 1


def read_osm_xml(path, collector):
    nodes = {}
    header_ts = None
    for event, el in ET.iterparse(path, events=("start", "end")):
        if event == "start":
            if el.tag == "osm":
                header_ts = el.get("timestamp")
            continue
        if el.tag == "node":
            lat, lon = float(el.get("lat")), float(el.get("lon"))
            nodes[el.get("id")] = (lat, lon)
            tags = {t.get("k"): t.get("v") for t in el.findall("tag")}
            if tags:
                collector.add(tags, lat, lon, False)
            el.clear()
        elif el.tag == "way":
            refs = [nodes[nd.get("ref")] for nd in el.findall("nd") if nd.get("ref") in nodes]
            tags = {t.get("k"): t.get("v") for t in el.findall("tag")}
            if refs and tags:
                collector.add(tags, sum(r[0] for r in refs) / len(refs), sum(r[1] for r in refs) / len(refs), True)
            el.clear()
    return header_ts


def read_pbf(path, collector):
    import osmium  # pyosmium; only needed for .pbf

    class Handler(osmium.SimpleHandler):
        def node(self, n):
            if len(n.tags):
                collector.add(dict(n.tags), n.location.lat, n.location.lon, False)

        def way(self, w):
            tags = w.tags
            if "highway" not in tags and categorize(dict(tags)) is None:
                return
            try:
                pts = [(nd.lat, nd.lon) for nd in w.nodes]
            except osmium.InvalidLocationError:
                return
            if pts:
                collector.add(dict(tags), sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts), True)

    header = osmium.io.Reader(path, osmium.osm.osm_entity_bits.NOTHING).header()
    ts = header.get("osmosis_replication_timestamp") or None
    Handler().apply_file(path, locations=True, idx="flex_mem")
    return ts


def coverage_grade(poi_total, named_pct, road_ways):
    """Rule-based grade. Thresholds are documented in docs/NIGERIA_SPATIAL_COVERAGE.md."""
    if poi_total == 0 and road_ways < 100:
        return "EMPTY"
    if poi_total < 15 or named_pct < 5:
        return "POOR"
    if poi_total < 50 or named_pct < 20:
        return "PARTIAL"
    return "GOOD"


def build_report(collector, extract_date, source_name, generated_at=None):
    points = []
    for i, p in enumerate(collector.points):
        counts = collector.counts[i]
        total, named = collector.roads[i]
        named_pct = round(100.0 * named / total, 1) if total else 0.0
        poi_total = sum(counts.values())
        points.append({
            "id": p["id"], "label": p["label"], "city": p["city"],
            "lat": p["lat"], "lon": p["lon"],
            "coordsVerifiedAgainstOSM": p["verified"], "coordNote": p["note"],
            "counts": counts, "poiTotal": poi_total,
            "highwayWays": total, "namedHighwayWays": named, "namedRoadPct": named_pct,
            "coverageGrade": coverage_grade(poi_total, named_pct, total),
        })
    return {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": generated_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "extractDate": extract_date or "UNKNOWN",
        "source": source_name,
        "provider": PROVIDER,
        "license": PROVIDER["license"],
        "attribution": PROVIDER["attribution"],
        "method": {
            "radiusM": collector.radius_m,
            "distance": "haversine",
            "features": "OSM nodes (point) and ways (vertex mean); relations not counted (lower bound)",
            "categories": {c: ("shop=" if c in SHOP_CATEGORIES else "amenity=") + c for c in CATEGORIES},
            "namedRoad": "highway=* way with a name tag",
            "grade": "EMPTY: 0 POI and <100 highway ways; POOR: <15 POI or <5% named; PARTIAL: <50 POI or <20% named; else GOOD",
        },
        "points": points,
        "caveats": [
            "Counts are what is mapped in OSM, not what exists on the ground.",
            "Unverified coordinates are approximate centres; see coordNote.",
            "No online provider was called.",
        ],
    }


def run(input_path, output_path, extract_date=None, generated_at=None, points=GOLDEN_POINTS):
    collector = Collector(points)
    if input_path.endswith(".pbf"):
        header_ts = read_pbf(input_path, collector)
    else:
        header_ts = read_osm_xml(input_path, collector)
    report = build_report(collector, extract_date or header_ts, os.path.basename(input_path), generated_at)
    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    return report


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--input", default=os.environ.get("NIGERIA_OSM_PBF"))
    ap.add_argument("--output", default="benchmark.json")
    ap.add_argument("--extract-date", default=None)
    ap.add_argument("--generated-at", default=None)
    args = ap.parse_args(argv)
    if not args.input or not os.path.exists(args.input):
        ap.error("pass --input or set NIGERIA_OSM_PBF to an existing .osm.pbf/.osm file")
    report = run(args.input, args.output, args.extract_date, args.generated_at)
    print(f"wrote {args.output}: {len(report['points'])} points, extract {report['extractDate']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
