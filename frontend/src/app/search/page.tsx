"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { listingsApi } from "@/lib/api";
import { TruthScore } from "@/components/ui/TruthScore";
import type { Listing } from "@/lib/types";

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") ?? "");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listingsApi.list({ search: searchTerm || undefined, page: 1, limit: 12 })
      .then(res => { if (!cancelled) setListings(res.data); })
      .catch(e => { if (!cancelled) setError(e.message ?? "Failed to fetch listings"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [searchTerm]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const newSearchParams = new URLSearchParams(searchParams.toString());
    if (searchTerm) {
      newSearchParams.set("q", searchTerm);
    } else {
      newSearchParams.delete("q");
    }
    router.push(`/search?${newSearchParams.toString()}`);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-navy)' }}>
      <div className="container py-8">
        <h1 className="font-poppins font-bold text-2xl text-white mb-2">Find Your Next Home</h1>

        <form onSubmit={handleSearch} className="mb-8 flex gap-2 max-w-xl">
          <input
            type="text"
            className="input flex-1"
            placeholder="Search by location, keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </form>

        {error && (
          <div className="banner-error mb-6">{error}</div>
        )}

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card">
                <div className="skeleton h-48 w-full mb-4" />
                <div className="skeleton h-4 w-3/4 mb-2" />
                <div className="skeleton h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : listings.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map(listing => (
              <Link key={listing.id} href={`/listings/${listing.id}`}
                className="card card-elevated block hover:border-orange/30 transition-all no-underline">
                <div className="h-48 rounded-xl mb-4 flex items-center justify-center"
                     style={{ background: 'var(--color-surface-2)' }}>
                  {listing.images?.[0]?.url ? (
                    <img src={listing.images[0].url} alt={listing.title}
                      className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <span style={{ fontSize: '2.5rem', opacity: 0.3 }}>🏠</span>
                  )}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-poppins font-semibold text-white text-sm">{listing.title}</h3>
                    <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {listing.property?.city ?? listing.property?.state ?? ''}
                    </p>
                    <p className="font-poppins font-bold text-sm mt-2" style={{ color: 'var(--color-orange)' }}>
                      ₦{listing.price?.toLocaleString()}
                    </p>
                  </div>
                  {listing.owner && <TruthScore score={listing.owner.truthIndex ?? 75} size="sm" />}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
            <h2 className="font-poppins font-semibold text-white text-lg mb-2">
              {searchTerm ? `No results for "${searchTerm}"` : 'Start your search'}
            </h2>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {searchTerm
                ? 'Try a different search term or browse all listings.'
                : 'Enter a search term above to find properties.'}
            </p>
            <Link href="/listings" className="btn btn-primary mt-6">Browse all listings</Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-navy)' }}>
        <div className="spinner" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
