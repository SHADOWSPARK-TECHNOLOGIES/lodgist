import Link from "next/link";
import { Bed, Bath, MapPin, BadgeCheck, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ListingImage {
  url: string;
  alt?: string;
}

interface ListingOwner {
  name?: string;
  verified: boolean;
}

interface ListingLocation {
  address: string;
  lga: string;
  state: string;
}

export interface Listing {
  id: string;
  title: string;
  price: number;
  location: ListingLocation;
  propertyType: "apartment" | "house" | "land" | "commercial";
  bedrooms?: number;
  bathrooms?: number;
  amenities?: string[];
  images?: ListingImage[];
  truthIndex: number;
  owner: ListingOwner;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a number as Nigerian Naira (e.g. ₦1,500,000/yr). */
function formatNgn(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Return the correct badge colour classes based on the truth-index value. */
function truthIndexColor(index: number): string {
  if (index >= 80) return "bg-[#1ABC9C] text-white";
  if (index >= 50) return "bg-[#FF6F3C] text-white";
  return "bg-red-500 text-white";
}

/** Determine whether bedroom/bathroom counts should be shown. */
function showRoomCounts(propertyType: string): boolean {
  return propertyType === "apartment" || propertyType === "house";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PropertyCard({ listing }: { listing: Listing }) {
  const {
    id,
    title,
    price,
    location,
    propertyType,
    bedrooms,
    bathrooms,
    images,
    truthIndex,
    owner,
  } = listing;

  const mainImage =
    images && images.length > 0
      ? images[0].url
      : "/placeholder-property.svg";

  const showRooms = showRoomCounts(propertyType);

  return (
    <Link href={`/listings/${id}`} className="block">
      <Card className="group h-full overflow-hidden transition-shadow duration-200 hover:shadow-lg">
        {/* ---- Image ---- */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img
            src={mainImage}
            alt={images?.[0]?.alt ?? title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />

          {/* Truth Index badge */}
          <span
            className={cn(
              "absolute right-2 top-2 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm",
              truthIndexColor(truthIndex),
            )}
          >
            <Star className="h-3 w-3 fill-current" />
            {truthIndex}
          </span>
        </div>

        {/* ---- Content ---- */}
        <CardContent className="flex flex-col gap-2 pt-4">
          {/* Title */}
          <h3 className="line-clamp-1 text-base font-semibold text-[#0B1B2B]">
            {title}
          </h3>

          {/* Price */}
          <p className="text-lg font-bold text-[#FF6F3C]">
            {formatNgn(price)}
            <span className="text-sm font-normal text-muted-foreground">
              /yr
            </span>
          </p>

          {/* Location */}
          <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#1ABC9C]" />
            <span className="line-clamp-1">
              {location.address}, {location.lga}, {location.state}
            </span>
          </div>

          {/* Bedroom / Bathroom (apartment & house only) */}
          {showRooms && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {bedrooms != null && (
                <span className="flex items-center gap-1">
                  <Bed className="h-4 w-4 text-[#1ABC9C]" />
                  {bedrooms} {bedrooms === 1 ? "Bed" : "Beds"}
                </span>
              )}
              {bathrooms != null && (
                <span className="flex items-center gap-1">
                  <Bath className="h-4 w-4 text-[#1ABC9C]" />
                  {bathrooms} {bathrooms === 1 ? "Bath" : "Baths"}
                </span>
              )}
            </div>
          )}
        </CardContent>

        {/* ---- Footer / Owner ---- */}
        <CardFooter className="border-t pt-3">
          <div className="flex w-full items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {owner.name ?? "Property Owner"}
            </span>

            {owner.verified && (
              <span className="flex items-center gap-1 text-xs font-medium text-[#1ABC9C]">
                <BadgeCheck className="h-4 w-4" />
                Verified Landlord
              </span>
            )}
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
