"use client";

import {
  MapPin, Train, ShoppingBag, School, Hospital, ShieldCheck, Star, Wifi, Utensils,
} from "lucide-react";
import { neighborhood } from "@/lib/copy";

interface Amenity {
  type: string;
  name: string;
  distance?: string;
  rating?: number;
}

interface NeighborhoodData {
  name: string;
  city: string;
  state: string;
  safety_rating?: number;
  amenities: Amenity[];
  flood_risk?: "low" | "medium" | "high";
  description?: string;
}

interface NeighborhoodGridProps {
  data: NeighborhoodData | null;
}

const amenityIcon = (type: string) => {
  switch (type) {
    case "transit":
    case "train":
      return Train;
    case "shopping":
    case "mall":
      return ShoppingBag;
    case "school":
    case "university":
      return School;
    case "hospital":
    case "clinic":
      return Hospital;
    case "security":
      return ShieldCheck;
    case "restaurant":
    case "food":
      return Utensils;
    case "internet":
    case "wifi":
      return Wifi;
    default:
      return MapPin;
  }
};

const safetyColor = (rating: number) => {
  if (rating >= 80) return "text-teal";
  if (rating >= 60) return "text-yellow-400";
  return "text-red-400";
};

const safetyBg = (rating: number) => {
  if (rating >= 80) return "bg-teal/10";
  if (rating >= 60) return "bg-yellow-400/10";
  return "bg-red-400/10";
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

const floodLabel = (risk: string) => {
  if (risk === "low") return neighborhood.low;
  if (risk === "medium") return neighborhood.medium;
  if (risk === "high") return neighborhood.high;
  return risk;
};

export default function NeighborhoodGrid({ data }: NeighborhoodGridProps) {
  if (!data) {
    return (
      <div className="rounded-xl border border-white/10 bg-deep-navy/60 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-3 text-light-gray">
          <MapPin className="h-5 w-5 text-vibrant-orange" />
          <span className="text-sm">{neighborhood.unavailable}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-deep-navy/60 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-heading text-lg font-semibold text-off-white">
            <MapPin className="h-5 w-5 text-teal" />
            {data.name}
          </h3>
          <p className="text-sm text-light-gray">{data.city}, {data.state}</p>
        </div>
        {data.safety_rating !== undefined && (
          <div className={`flex flex-col items-center rounded-lg px-3 py-2 ${safetyBg(data.safety_rating)}`}>
            <span className={`text-lg font-bold ${safetyColor(data.safety_rating)}`}>{data.safety_rating}</span>
            <span className="text-[10px] uppercase tracking-wider text-light-gray">{neighborhood.safety}</span>
          </div>
        )}
      </div>
      {data.description && <p className="mb-4 text-sm leading-relaxed text-light-gray">{data.description}</p>}
      {data.flood_risk && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <span className="text-xs text-light-gray">{neighborhood.flood}</span>
          <span className={`text-xs font-semibold uppercase ${floodColor(data.flood_risk)}`}>{floodLabel(data.flood_risk)}</span>
        </div>
      )}
      {data.amenities.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-light-gray">{neighborhood.amenities}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {data.amenities.map((a, i) => {
              const Icon = amenityIcon(a.type);
              return (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-white/5 p-2.5 transition-colors hover:bg-white/10">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-off-white">{a.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-light-gray">
                      {a.distance && <span>{a.distance}</span>}
                      {a.rating && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 text-yellow-400" />
                          {a.rating}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
