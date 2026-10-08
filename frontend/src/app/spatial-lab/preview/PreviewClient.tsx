"use client";

import { useState } from "react";
import Link from "next/link";
import SpatialLabPanel from "@/components/spatial/SpatialLabPanel";
import type { LabModel } from "@/components/spatial/SpatialLabView";
import { buildPreviewModel, publicTileTemplate } from "@/lib/spatialLab";

const SCENARIOS = [
  ["approximate", "Approximate area"],
  ["exact", "Exact fixture pin"],
  ["area-only", "Named area only"],
  ["unknown", "Location unknown"],
  ["no-amenities", "No amenities returned"],
  ["amenities-failed", "Amenity provider failed"],
  ["routing-failed", "Routing provider failed"],
  ["unavailable", "Unavailable home"],
] as const;

export default function PreviewClient() {
  const [scenario, setScenario] = useState<(typeof SCENARIOS)[number][0]>("approximate");
  const [campusId, setCampusId] = useState<string | null>("fpno");
  const [open, setOpen] = useState(true);
  const built = buildPreviewModel(scenario, campusId || "fpno");
  const fallback = buildPreviewModel("approximate", campusId || "fpno");
  const model = (built ?? fallback) as LabModel;

  return (
    <div>
      <p className="spatial-fixture-banner">DEV fixture · not a home · not for rent · not in the public inventory</p>
      <div className="container py-8 spatial-preview-layout">
        <article className="card spatial-preview-card" id="fixture-summary">
          <p className="spatial-kicker">Example journey · Owerri student</p>
          <h1 className="font-poppins text-2xl text-white mb-2">DEV fixture · area near Nekede</h1>
          <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.7)" }}>
            A labelled fixture for Spatial Lab. It is not the Nekede example card, not a listing, and not a real home.
          </p>
          <p className="text-sm mb-4">
            <Link href="/nekede" className="nav-link">Nekede example page</Link>
            <span className="spatial-quiet"> That page is a note format, not a home.</span>
          </p>
          <label className="label" htmlFor="fixture-state">Fixture state</label>
          <select
            id="fixture-state"
            className="input mb-4"
            value={scenario}
            onChange={(event) => {
              setScenario(event.target.value as (typeof SCENARIOS)[number][0]);
              setOpen(true);
            }}
          >
            {SCENARIOS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button type="button" className="btn btn-secondary" disabled>Enquire</button>
          <p className="spatial-quiet mt-2">Enquiry is off. There is no landlord and no home to contact.</p>
          {!open && (
            <button type="button" className="btn btn-primary mt-4" onClick={() => setOpen(true)}>Explore neighborhood</button>
          )}
        </article>
      </div>
      <SpatialLabPanel
        open={open}
        model={model}
        campusId={campusId}
        onCampus={setCampusId}
        loading={false}
        unavailable={!built}
        tileTemplate={publicTileTemplate()}
        onClose={() => setOpen(false)}
        returnLabel="Return to this fixture"
        onReturn={() => {
          setOpen(false);
          document.getElementById("fixture-summary")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />
    </div>
  );
}
