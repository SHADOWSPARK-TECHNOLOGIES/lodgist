"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import {
  AMENITY_CATEGORIES,
  CATEGORY_LABEL,
  CAMPUSES,
  DISCLAIMER,
  amenityMessage,
  describeRoute,
  externalDirectionsUrl,
  filterAmenities,
  straightLineLabel,
  straightLineMeters,
  type AmenityPayload,
  type Campus,
  type RoutePayload,
  type SpatialFocus,
} from "@/lib/spatialLab";

const SpatialMap = lazyMap();

function lazyMap() {
  return function MapSlot(props: {
    focus: SpatialFocus;
    campus: Campus | null;
    amenities: ReturnType<typeof filterAmenities>;
    tileTemplate: string | null;
  }) {
    const [View, setView] = useState<typeof import("./SpatialMap").default | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
      let cancelled = false;
      import("./SpatialMap")
        .then((mod) => {
          if (!cancelled) setView(() => mod.default);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
      return () => {
        cancelled = true;
      };
    }, []);
    if (failed) return <p className="spatial-note">The map could not load. The list below still works.</p>;
    if (!View) return <div className="skeleton spatial-map-loading" aria-hidden="true" />;
    return <View {...props} />;
  };
}

export type LabModel = {
  title: string;
  focus: SpatialFocus;
  amenities: AmenityPayload;
  route: RoutePayload;
  allowExactOrigin: boolean;
  fixture: boolean;
  subject?: string;
};

type Props = {
  model: LabModel;
  campusId: string | null;
  onCampus: (id: string) => void;
  loading: boolean;
  unavailable: boolean;
  onReturn: () => void;
  returnLabel: string;
  tileTemplate: string | null;
};

function CampusList({
  focus,
  campusId,
  onCampus,
  name,
}: {
  focus: SpatialFocus;
  campusId: string | null;
  onCampus: (id: string) => void;
  name: string;
}) {
  const point = focus.precision === "approximate" || focus.precision === "exact"
    ? { lat: focus.lat, lng: focus.lng }
    : null;
  return (
    <fieldset className="spatial-fieldset">
      <legend>Campus</legend>
      {CAMPUSES.map((campus) => {
        const meters = point ? straightLineMeters(point, campus) : null;
        const label = straightLineLabel(meters);
        return (
          <label key={campus.id} className="spatial-campus">
            <input
              type="radio"
              name={name}
              value={campus.id}
              checked={campusId === campus.id}
              onChange={() => onCampus(campus.id)}
            />
            <span>
              <strong>{campus.name}</strong>
              <span className="spatial-distance">{label || "Straight-line distance needs a published location."}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

export default function SpatialLabView({
  model,
  campusId,
  onCampus,
  loading,
  unavailable,
  onReturn,
  returnLabel,
  tileTemplate,
}: Props) {
  const [category, setCategory] = useState("all");
  const campusName = useId();
  const campus = CAMPUSES.find((item) => item.id === campusId) || null;
  const subject = model.subject || "home";
  const routeCopy = describeRoute(model.route);
  const amenities = filterAmenities(model.amenities.items, category, model.fixture);
  const amenityCopy = amenityMessage(model.amenities.status);
  const directions = campus
    ? externalDirectionsUrl({
        precision: model.focus.precision,
        originLabel: model.focus.label,
        originExact: model.focus.precision === "exact" ? { lat: model.focus.lat, lng: model.focus.lng } : null,
        allowExactOrigin: model.allowExactOrigin,
        fixturePin: model.focus.precision === "exact" && model.focus.fixturePin === true,
        destination: campus,
      })
    : null;

  if (unavailable) {
    return (
      <div>
        <h2 className="font-poppins text-xl text-white">This {subject} is not available</h2>
        <p className="spatial-quiet">Spatial Lab does not open unpublished homes, samples, or fixtures from a public link.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="spatial-kicker">{model.fixture ? "DEV fixture · not a home · not for rent" : "Neighborhood"}</p>
      <h2 className="font-poppins text-xl text-white mb-1">Spatial Lab</h2>
      <p className="text-sm text-white mb-3">{model.title}</p>
      <p className="spatial-disclaimer">{DISCLAIMER}</p>
      <p className="spatial-quiet">
        {model.fixture && "This preview is excluded from the public inventory. "}
        {model.focus.precision === "approximate" && "You are looking at the published area, not an exact building pin."}
        {model.focus.precision === "area-only" && `Known area: ${model.focus.label}. No coordinate was published, so none was added.`}
        {model.focus.precision === "exact" && "This pin exists only on the DEV fixture."}
        {model.focus.precision === "unknown" && `Lodgist has not published a location for this ${subject}.`}
      </p>

      {loading ? <div className="skeleton spatial-map-loading" /> : <SpatialMap focus={model.focus} campus={campus} amenities={amenities} tileTemplate={tileTemplate} />}

      <CampusList focus={model.focus} campusId={campusId} onCampus={onCampus} name={campusName} />

      <section className="spatial-block" aria-live="polite">
        <h3 className="spatial-heading">Journey</h3>
        {loading ? <p className="text-sm text-white">Loading neighborhood details…</p> : (
          <>
            <p className="text-sm text-white">{routeCopy.primary}</p>
            <p className="spatial-quiet">{routeCopy.detail}</p>
          </>
        )}
        {directions && (
          <p className="mt-2">
            <a className="nav-link" href={directions} target="_blank" rel="noopener noreferrer">
              {model.focus.precision === "approximate" || model.focus.precision === "area-only" ? "Directions from the area name" : model.focus.precision === "exact" ? "Directions from the fixture pin" : "Directions to the campus"}
            </a>
          </p>
        )}
        {(model.focus.precision === "approximate" || model.focus.precision === "area-only") && (
          <p className="spatial-quiet">The directions link uses the area name. It does not include a coordinate for this {subject}.</p>
        )}
      </section>

      <section className="spatial-block">
        <h3 className="spatial-heading">Nearby places</h3>
        <div className="spatial-filters" role="toolbar" aria-label="Amenity categories">
          <FilterButton current={category} value="all" onSelect={setCategory}>All</FilterButton>
          {AMENITY_CATEGORIES.map((value) => (
            <FilterButton key={value} current={category} value={value} onSelect={setCategory}>{CATEGORY_LABEL[value]}</FilterButton>
          ))}
        </div>
        {amenityCopy && <p className="spatial-quiet">{amenityCopy}</p>}
        {model.amenities.provenance && <p className="spatial-quiet">Source: {model.amenities.provenance}</p>}
        {amenities.length === 0 && model.amenities.status === "ok" && (
          <p className="spatial-quiet">Nothing in this category was returned.</p>
        )}
        <ul className="spatial-amenity-list">
          {amenities.map((amenity) => (
            <li key={amenity.id}>
              <span className="text-white">{amenity.name}</span>
              <span className="spatial-quiet"> · {CATEGORY_LABEL[amenity.category]} · {amenity.provenance}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="spatial-block" aria-label="Text alternative">
        <h3 className="spatial-heading">Same details in text</h3>
        <p className="spatial-quiet">Campus marks are OpenStreetMap area centers (ODbL), not building doors.</p>
        <p className="spatial-quiet">
          {model.focus.precision === "approximate" && `${model.focus.label}. Area radius about ${model.focus.radiusM} m. No building pin.`}
          {model.focus.precision === "area-only" && `${model.focus.label}. Named area only. No pin or distance was added.`}
          {model.focus.precision === "exact" && `${model.focus.label}. Fixture pin only.`}
          {model.focus.precision === "unknown" && "Location unknown. No pin was placed."}
        </p>
        <ul className="spatial-amenity-list">
          {CAMPUSES.map((item) => {
            const point = model.focus.precision === "approximate" || model.focus.precision === "exact"
              ? { lat: model.focus.lat, lng: model.focus.lng }
              : null;
            const label = point ? straightLineLabel(straightLineMeters(point, item)) : null;
            return <li key={item.id}>{item.name}: {label || "straight-line distance unavailable"}</li>;
          })}
        </ul>
      </section>

      <button type="button" className="btn btn-secondary mt-3" onClick={onReturn}>{returnLabel}</button>
    </div>
  );
}

function FilterButton({
  current,
  value,
  onSelect,
  children,
}: {
  current: string;
  value: string;
  onSelect: (value: string) => void;
  children: ReactNode;
}) {
  const selected = current === value;
  return (
    <button type="button" className={selected ? "spatial-chip spatial-chip-on" : "spatial-chip"} aria-pressed={selected} onClick={() => onSelect(value)}>
      {children}
    </button>
  );
}
