"use client";

import VerifiedListingCard from "./VerifiedListingCard";
import ScrapedListingCard from "./ScrapedListingCard";

interface SearchResultsProps {
  verified: ReturnType<typeof mapVerified>[];
  scraped: ReturnType<typeof mapScraped>[];
  query: string;
  loading: boolean;
}

// These mirror the shape returned by /api/search formatListing
function mapVerified(l: Record<string, unknown>) {
  return l as {
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

function mapScraped(l: Record<string, unknown>) {
  return l as {
    id: number;
    title: string;
    price: number;
    address?: string | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    propertyType?: string | null;
    sourceName?: string | null;
    sourceUrl?: string | null;
    feeBreakdown: {
      rent: number;
      agentFee: number;
      agreementFee: number;
      inspectionFee: number;
      total: number;
      lodgistSaving: number;
    } | null;
  };
}

export default function SearchResults({
  verified,
  scraped,
  query,
  loading,
}: SearchResultsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!query) return null;

  if (verified.length === 0 && scraped.length === 0) {
    return (
      <div className="mt-12 text-center max-w-md mx-auto">
        <div className="text-5xl mb-3">🔍</div>
        <h3 className="font-bold text-[#0B1B2B] mb-2">No listings match yet</h3>
        <p className="text-sm text-gray-500">
          We didn&apos;t find anything matching &ldquo;{query}&rdquo;. Try
          adjusting your budget, location, or property type. Lodgist is growing
          — new verified lodges are added regularly.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-10">
      {verified.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-[#1ABC9C] rounded-full" />
            <h2 className="text-lg font-bold text-[#0B1B2B]">
              Verified Lodges{" "}
              <span className="text-[#1ABC9C]">({verified.length})</span>
            </h2>
            <span className="text-xs text-gray-500 ml-2">
              Direct contact · No agent fees
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {verified.map((l) => (
              <VerifiedListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      {scraped.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-gray-300 rounded-full" />
            <h2 className="text-lg font-bold text-gray-600">
              Public Listings{" "}
              <span className="text-gray-400">({scraped.length})</span>
            </h2>
            <span className="text-xs text-gray-500 ml-2">
              Sourced from other sites · Agent fees apply
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scraped.map((l) => (
              <ScrapedListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
