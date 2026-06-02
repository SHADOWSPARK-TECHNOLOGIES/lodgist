"use client";

import { useState } from "react";

interface FeeBreakdown {
  rent: number;
  agentFee: number;
  agreementFee: number;
  inspectionFee: number;
  total: number;
  lodgistSaving: number;
}

interface Props {
  listing: {
    id: number;
    title: string;
    price: number;
    address?: string | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    propertyType?: string | null;
    sourceName?: string | null;
    sourceUrl?: string | null;
    feeBreakdown: FeeBreakdown | null;
  };
}

export default function ScrapedListingCard({ listing }: Props) {
  const [showFees, setShowFees] = useState(false);
  const fees = listing.feeBreakdown;

  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
      {/* Unverified strip */}
      <div className="bg-gray-200 text-gray-600 px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wide">
            Unverified
          </span>
        </div>
        {listing.sourceName && (
          <span className="text-xs">via {listing.sourceName}</span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-gray-700 leading-tight">
            {listing.title}
          </h3>
          {listing.address && (
            <p className="text-xs text-gray-500 mt-0.5">{listing.address}</p>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500">
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

        {fees && (
          <>
            <button
              onClick={() => setShowFees(!showFees)}
              className="w-full text-left bg-amber-50 border border-amber-200 rounded-lg p-3 hover:bg-amber-100 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-amber-700 font-semibold">
                    ⚠️ Agent fees attached
                  </div>
                  <div className="text-sm text-amber-900 font-bold mt-0.5">
                    Total cost: ₦{fees.total.toLocaleString()}
                  </div>
                </div>
                <svg
                  className={`w-4 h-4 text-amber-700 transition-transform ${showFees ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m19.5 8.25-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </div>
            </button>

            {showFees && (
              <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Rent</span>
                  <span className="text-gray-900">
                    ₦{fees.rent.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>+ Agent fee (10%)</span>
                  <span>₦{fees.agentFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>+ Agreement fee (10%)</span>
                  <span>₦{fees.agreementFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>+ Inspection fee</span>
                  <span>₦{fees.inspectionFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold pt-1.5 border-t border-gray-200">
                  <span className="text-gray-900">You actually pay</span>
                  <span className="text-gray-900">
                    ₦{fees.total.toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-dashed border-[#1ABC9C]/40 bg-[#1ABC9C]/5 -mx-3 -mb-3 px-3 py-2 rounded-b-lg">
                  <div className="text-[#0F9D7E] font-bold text-xs">
                    💡 A verified Lodgist listing nearby would save you ₦
                    {fees.lodgistSaving.toLocaleString()}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {listing.sourceUrl && (
          <a
            href={listing.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-gray-500 hover:text-[#FF6F3C] truncate underline"
          >
            View original on {listing.sourceName} →
          </a>
        )}
      </div>
    </div>
  );
}
