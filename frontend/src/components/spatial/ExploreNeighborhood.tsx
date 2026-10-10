"use client";

import { useEffect, useMemo, useState } from "react";
import { focusFromPublicListing, type AmenityPayload, type RoutePayload, type SpatialFocus } from "@/lib/spatialLab";
import type { ApproxLocation } from "@/lib/types";
import type { LabModel } from "./SpatialLabView";

type PanelComponent = typeof import("./SpatialLabPanel").default;

type RemoteData = {
  focus: SpatialFocus;
  amenities: AmenityPayload;
  route: RoutePayload;
  title: string;
};

const EMPTY_AMENITIES: AmenityPayload = { status: "unconfigured", items: [], provenance: null };
const EMPTY_ROUTE: RoutePayload = { status: "needs-campus", distanceM: null, durationS: null };

export default function ExploreNeighborhood({
  listingId,
  title,
  place,
  approxLocation,
  startOpen = false,
}: {
  listingId: number;
  title: string;
  place: string;
  approxLocation: ApproxLocation | null;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [Panel, setPanel] = useState<PanelComponent | null>(null);
  const [chunkFailed, setChunkFailed] = useState(false);
  const [campusId, setCampusId] = useState<string | null>(null);
  const [loading, setLoading] = useState(startOpen);
  const [unavailable, setUnavailable] = useState(false);
  const [remote, setRemote] = useState<RemoteData | null>(null);
  const lat = approxLocation?.lat ?? null;
  const lng = approxLocation?.lng ?? null;
  const radius = approxLocation?.radius_m ?? null;
  const localFocus = useMemo(() => focusFromPublicListing({
    property: place ? { city: place } : {},
    approxLocation: lat != null && lng != null && radius != null ? { lat, lng, radius_m: radius } : null,
  }), [place, lat, lng, radius]);

  useEffect(() => {
    if (!open || unavailable) return;
    const controller = new AbortController();
    const campus = campusId ? `?campus=${encodeURIComponent(campusId)}` : "";
    fetch(`/api/spatial/listings/${listingId}${campus}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) {
          setUnavailable(true);
          setRemote(null);
          return;
        }
        if (!response.ok) throw new Error("spatial request failed");
        const body = (await response.json()) as { data?: RemoteData & { title?: string; focus?: SpatialFocus; amenities?: AmenityPayload; route?: RoutePayload } };
        if (!body.data?.focus || !body.data.amenities || !body.data.route) throw new Error("spatial payload incomplete");
        setRemote({
          title: body.data.title || title,
          focus: body.data.focus,
          amenities: body.data.amenities,
          route: body.data.route,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRemote({
          title,
          focus: localFocus,
          amenities: { status: "failed", items: [], provenance: null },
          route: { status: "failed", distanceM: null, durationS: null },
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, listingId, campusId, title, unavailable, localFocus]);

  async function openLab() {
    setLoading(true);
    setOpen(true);
    if (Panel || chunkFailed) return;
    try {
      const mod = await import("./SpatialLabPanel");
      setPanel(() => mod.default);
    } catch {
      setChunkFailed(true);
    }
  }

  useEffect(() => {
    if (!startOpen || Panel || chunkFailed) return;
    import("./SpatialLabPanel")
      .then((mod) => setPanel(() => mod.default))
      .catch(() => setChunkFailed(true));
  }, [startOpen, Panel, chunkFailed]);

  const model: LabModel = {
    title: remote?.title || title,
    focus: remote?.focus || localFocus,
    amenities: remote?.amenities || EMPTY_AMENITIES,
    route: remote?.route || EMPTY_ROUTE,
    allowExactOrigin: false,
    fixture: false,
  };

  return (
    <section className="card mb-4" aria-labelledby="explore-neighborhood">
      <h2 id="explore-neighborhood" className="font-poppins font-semibold text-white mb-2">Neighborhood</h2>
      <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.65)" }}>
        Spatial Lab shows the published area, the journey to a campus, and nearby places. A map does not prove who owns the home.
      </p>
      <button type="button" className="btn btn-secondary" onClick={openLab}>Explore neighborhood</button>
      {chunkFailed && (
        <p className="text-sm mt-3" style={{ color: "rgba(255,255,255,0.7)" }}>
          The neighborhood map could not load. You can still enquire about this home below.
        </p>
      )}
      {Panel && (
        <Panel
          open={open}
          model={model}
          campusId={campusId}
          onCampus={(id) => {
            setLoading(true);
            setCampusId(id);
          }}
          loading={loading}
          unavailable={unavailable}
          tileTemplate={process.env.NEXT_PUBLIC_MAP_TILE_URL || null}
          tileAttribution={process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || null}
          onClose={() => setOpen(false)}
          returnLabel="Back to this home"
          onReturn={() => {
            setOpen(false);
            document.getElementById("listing-actions")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}
    </section>
  );
}
