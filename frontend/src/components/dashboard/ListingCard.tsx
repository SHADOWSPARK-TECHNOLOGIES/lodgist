"use client";

import { useState, useOptimistic, useCallback } from "react";
import { listingsApi } from "@/lib/api";
import { formatYearlyRent, listingCard } from "@/lib/copy";
import type { Listing } from "@/lib/types";

interface ListingCardProps {
  listing: Listing;
  onStatusChange?: (id: number, newStatus: string) => void;
  showActions?: boolean;
}

type OptimisticStatus = { status: string; pending: boolean };

export default function ListingCard({
  listing,
  onStatusChange,
  showActions = true,
}: ListingCardProps) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic<OptimisticStatus, string>(
    { status: listing.status, pending: false },
    (_state, newStatus) => ({ status: newStatus, pending: true })
  );
  const [updating, setUpdating] = useState(false);

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      setUpdating(true);
      setOptimisticStatus(newStatus);
      try {
        await listingsApi.update(listing.id, { status: newStatus });
        onStatusChange?.(listing.id, newStatus);
      } catch {
        setOptimisticStatus(listing.status);
      } finally {
        setUpdating(false);
      }
    },
    [listing.id, listing.status, onStatusChange, setOptimisticStatus]
  );

  const primaryImage = listing.images?.find((img) => img.isPrimary)?.url || listing.images?.[0]?.url;
  const statusColors: Record<string, string> = {
    available: "bg-green-100 text-green-800",
    rented: "bg-blue-100 text-blue-800",
    sold: "bg-gray-100 text-gray-800",
    withdrawn: "bg-red-100 text-red-800",
  };
  const priceLabel = listing.currency === "NGN" || !listing.currency
    ? formatYearlyRent(listing.price)
    : `${listing.currency} ${listing.price.toLocaleString()}`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-video bg-gray-100 relative">
        {primaryImage ? (
          <img src={primaryImage} alt={listing.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">{listingCard.noPhoto}</div>
        )}
        <span className={`absolute top-2 right-2 px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[optimisticStatus.status] || "bg-gray-100 text-gray-800"} ${optimisticStatus.pending ? "animate-pulse" : ""}`}>
          {listingCard.status[optimisticStatus.status] ?? optimisticStatus.status}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-gray-900 truncate">{listing.title}</h3>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-blue-600">{priceLabel}</span>
          {listing.reviews && (
            <span className="text-sm text-gray-500">
              {listing.reviews.averageRating.toFixed(1)} ({listing.reviews.totalReviews})
            </span>
          )}
        </div>
        <div className="flex gap-4 text-sm text-gray-500">
          {listing.beds ? <span>{listing.beds} {listingCard.beds}</span> : null}
          {listing.baths ? <span>{listing.baths} {listingCard.baths}</span> : null}
          {listing.sqft ? <span>{listing.sqft.toLocaleString()} sqft</span> : null}
        </div>
        {listing.owner && (
          <p className="text-xs text-gray-400">
            {listingCard.listedBy} {listing.owner.name || listing.owner.email}
            {listing.owner.truthIndex != null ? ` \u00b7 ${listingCard.trust} ${listing.owner.truthIndex}` : ""}
          </p>
        )}
        {showActions && (
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <a href={`/listings/${listing.id}`} className="flex-1 text-center px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition">
              {listingCard.view}
            </a>
            {listing.status === "available" && (
              <button onClick={() => handleStatusChange("rented")} disabled={updating} className="flex-1 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-md transition disabled:opacity-50">
                {listingCard.markRented}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
