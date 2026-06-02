"use client";

import { useRouter } from "next/navigation";

interface Props {
  listing: {
    id: number;
    title: string;
    price: number;
    address?: string | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    propertyType?: string | null;
    amenities?: string[];
    nearbySchool?: string | null;
    distanceToSchool?: string | null;
  };
}

export default function VerifiedListingCard({ listing }: Props) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/listings/${listing.id}`)}
      className="bg-white rounded-2xl border-2 border-[#1ABC9C]/30
                 overflow-hidden shadow-sm hover:shadow-md hover:border-[#1ABC9C]
                 transition-all cursor-pointer"
    >
      {/* Verified strip */}
      <div className="bg-[#1ABC9C] text-white px-3 py-1.5 flex items-center gap-1.5">
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
        <span className="text-xs font-bold uppercase tracking-wide">
          Identity Verified Landlord
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-[#0B1B2B] leading-tight">
            {listing.title}
          </h3>
          {listing.address && (
            <p className="text-xs text-gray-500 mt-0.5">{listing.address}</p>
          )}
        </div>

        {listing.nearbySchool && (
          <div className="inline-flex items-center gap-1 text-xs bg-[#0B1B2B]/5 text-[#0B1B2B] px-2 py-1 rounded-full">
            📍 {listing.distanceToSchool || "Near"} {listing.nearbySchool}
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-gray-600">
          {listing.bedrooms != null && <span>{listing.bedrooms} bed</span>}
          {listing.bedrooms != null && listing.bathrooms != null && (
            <span>•</span>
          )}
          {listing.bathrooms != null && <span>{listing.bathrooms} bath</span>}
          {listing.propertyType && (
            <>
              <span>•</span>
              <span className="capitalize">{listing.propertyType}</span>
            </>
          )}
        </div>

        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-gray-500">Rent per year</div>
              <div className="text-xl font-bold text-[#0B1B2B]">
                ₦{listing.price.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#1ABC9C] font-semibold">
                No agent fees
              </div>
              <div className="text-xs text-gray-500">Direct to landlord</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
