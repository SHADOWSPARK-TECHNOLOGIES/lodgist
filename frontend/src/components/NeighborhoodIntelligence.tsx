"use client";

import { useState } from "react";
import {
  MapPin,
  TrendingUp,
  TrendingDown,
  Users,
  Building2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Star,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface NeighborhoodStats {
  name: string;
  avg_rent: number;
  currency: string;
  occupancy_rate: number; // 0-100
  population_density: string;
  growth_trend: "rising" | "stable" | "declining";
  safety_index: number; // 0-100
  flood_risk: "low" | "medium" | "high";
  amenities_count: number;
  description?: string;
}

interface NeighborhoodIntelligenceProps {
  data: NeighborhoodStats | null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function NeighborhoodIntelligence({
  data,
}: NeighborhoodIntelligenceProps) {
  const [expanded, setExpanded] = useState(false);

  if (!data) {
    return (
      <div className="rounded-xl border border-white/10 bg-deep-navy/60 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-3 text-light-gray">
          <MapPin className="h-5 w-5 text-vibrant-orange" />
          <span className="text-sm">Neighborhood intelligence not available</span>
        </div>
      </div>
    );
  }

  const trendIcon = (trend: string) => {
    switch (trend) {
      case "rising":
        return <TrendingUp className="h-4 w-4 text-teal" />;
      case "declining":
        return <TrendingDown className="h-4 w-4 text-red-400" />;
      default:
        return <TrendingUp className="h-4 w-4 text-yellow-400" />;
    }
  };

  const safetyColor = (idx: number) => {
    if (idx >= 70) return "text-teal";
    if (idx >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  const floodColor = (risk: string) => {
    switch (risk) {
      case "low":
        return "text-teal";
      case "medium":
        return "text-yellow-400";
      case "high":
        return "text-red-400";
      default:
        return "text-light-gray";
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-deep-navy/60 p-5 backdrop-blur-sm">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal/15">
            <Building2 className="h-5 w-5 text-teal" />
          </div>
          <div className="text-left">
            <h3 className="font-heading text-base font-semibold text-off-white">
              {data.name}
            </h3>
            <p className="text-xs text-light-gray">
              Avg. Rent: {data.currency} {data.avg_rent.toLocaleString()} ·{" "}
              {data.occupancy_rate}% occupied
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-light-gray" />
        ) : (
          <ChevronDown className="h-4 w-4 text-light-gray" />
        )}
      </button>

      {/* Quick Stats Row (always visible) */}
      <div className="mt-3 flex flex-wrap gap-3">
        <div className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs">
          {trendIcon(data.growth_trend)}
          <span className="text-light-gray">{data.growth_trend}</span>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs">
          <Users className="h-3 w-3 text-light-gray" />
          <span className="text-light-gray">{data.population_density}</span>
        </div>
        <div
          className={`flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs ${safetyColor(data.safety_index)}`}
        >
          <Star className="h-3 w-3" />
          <span>Safety: {data.safety_index}</span>
        </div>
        <div
          className={`flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs ${floodColor(data.flood_risk)}`}
        >
          <AlertTriangle className="h-3 w-3" />
          <span>Flood: {data.flood_risk}</span>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          {data.description && (
            <p className="text-sm leading-relaxed text-light-gray">
              {data.description}
            </p>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-light-gray">
                Avg Rent
              </p>
              <p className="font-mono text-sm font-semibold text-off-white">
                {data.currency} {data.avg_rent.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-light-gray">
                Occupancy
              </p>
              <p className="font-mono text-sm font-semibold text-off-white">
                {data.occupancy_rate}%
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-light-gray">
                Amenities
              </p>
              <p className="font-mono text-sm font-semibold text-off-white">
                {data.amenities_count}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
