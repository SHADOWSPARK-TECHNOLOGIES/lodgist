"use client";

// ─── ListingCard ───────────────────────────────────────────────────────────
// Reusable listing card component with instant UI updates using React 19's
// useOptimistic for status changes.

import { useState, useOptimistic, useCallback } from "react";
import { listingsApi } from "@/lib/api";
import type { Listing } from "@/lib/types";

interface ListingCardProps {
  listing: Listing;
  onStatusChange?: (id: number, newStatus: string) => void;
  showActions?: boolean;
}

type OptimisticStatus = {
  status: string;
  pending: boolean;
};

export default function ListingCard({
  listing,
  onStatusChange,
  showActions = true,
}: ListingCardProps) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic<
    OptimisticStatus,
    string
  >(
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
        // Revert on error — reset optimistic state
        setOptimisticStatus(listing.status);
      } finally {
        setUpdating(false);
      }
    },
    [listing.id, listing.status, onStatusChange, setOptimisticStatus]
  );

  const primaryImage =
    listing.images?.find((img) => img.isPrimary)?.url ||
    listing.images?.[0]?.url;

  const statusColors: Record<string, string> = {
    available: "bg-green-100 text-green-800",
    rented: "bg-blue-100 text-blue-800",
    sold: "bg-gray-100 text-gray-800",
    withdrawn: "bg-red-100 text-red-800",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="aspect-video bg-gray-100 relative">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={listing.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <span className="text-4xl">🏠</span>
          </div>
        )}
        {/* Status Badge */}
        <span
          className={`absolute top-2 right-2 px-2 py-0.5 text-xs font-medium rounded-full ${
            statusColors[optimisticStatus.status] || "bg-gray-100 text-gray-800"
          } ${optimisticStatus.pending ? "animate-pulse" : ""}`}
        >
          {optimisticStatus.status}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-gray-900 truncate">{listing.title}</h3>

        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-blue-600">
            {listing.currency === "NGN" ? "₦" : "$"}
            {listing.price.toLocaleString()}
          </span>
          {listing.reviews && (
            <span className="text-sm text-gray-500">
              ⭐ {listing.reviews.averageRating.toFixed(1)} ({listing.reviews.totalReviews})
            </span>
          )}
        </div>

        {/* Specs */}
        <div className="flex gap-4 text-sm text-gray-500">
          {listing.beds && <span>{listing.beds} 🛏️</span>}
          {listing.baths && <span>{listing.baths} 🚿</span>}
          {listing.sqft && <span>{listing.sqft.toLocaleString()} sqft</span>}
        </div>

        {/* Owner */}
        {listing.owner && (
          <p className="text-xs text-gray-400">
            Listed by {listing.owner.name || listing.owner.email}
            {listing.owner.truthIndex != null &&
              ` · TI: ${listing.owner.truthIndex}`}
          </p>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <a
              href={`/listings/${listing.id}`}
              className="flex-1 text-center px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition"
            >
              View
            </a>
            {listing.status === "available" && (
              <button
                onClick={() => handleStatusChange("rented")}
                disabled={updating}
                className="flex-1 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-md transition disabled:opacity-50"
              >
                Mark Rented
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
