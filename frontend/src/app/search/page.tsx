"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { listingsApi } from "@/lib/api";
import { TruthScore } from "@/components/ui/TruthScore";
import { formatYearlyRent, listings as browse, search as copy } from "@/lib/copy";
import { hasTrustScore, isExampleListing, publicListings } from "@/lib/listingHonesty";
import LeadCapture from "@/components/LeadCapture";
import type { Listing } from "@/lib/types";

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") ?? "");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listingsApi.list({ search: searchTerm || undefined, status: "VERIFIED", page: 1, limit: 12 })
      .then(res => { if (!cancelled) setListings(publicListings(res.data)); })
      .catch(() => { if (!cancelled) setError(copy.fetchError); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [searchTerm]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    if (searchTerm) next.set("q", searchTerm);
    else next.delete("q");
    router.push(`/search?${next.toString()}`);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-navy)' }}>
      <div className="container py-8">
        <h1 className="font-poppins font-bold text-2xl text-white mb-2">{copy.title}</h1>
        <form onSubmit={handleSearch} className="mb-8 flex gap-2 max-w-xl">
          <input type="text" className="input flex-1" placeholder={copy.placeholder} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <button type="submit" className="btn btn-primary">{copy.button}</button>
        </form>
        {error && <div className="banner-error mb-6">{error}</div>}
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
              <Link key={listing.id} href={`/listings/${listing.id}`} className="card card-elevated block hover:border-orange/30 transition-all no-underline">
                <div className="h-48 rounded-xl mb-4 flex items-center justify-center" style={{ background: 'var(--color-surface-2)' }}>
                  {listing.images?.[0]?.url ? (
                    <img src={listing.images[0].url} alt={listing.title} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <span style={{ fontSize: '2.5rem', opacity: 0.3 }}>Home</span>
                  )}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-poppins font-semibold text-white text-sm">{listing.title}</h3>
                    <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {listing.property?.city ?? listing.property?.state ?? ''}
                    </p>
                    <p className="font-poppins font-bold text-sm mt-2" style={{ color: 'var(--color-orange)' }}>
                      {formatYearlyRent(listing.price)}
                    </p>
                    {isExampleListing(listing) && (
                      <p className="text-xs mt-2" style={{ color: 'var(--color-teal)' }}>{browse.sampleBadge}</p>
                    )}
                  </div>
                  {hasTrustScore(listing.truthIndex ?? listing.owner?.truthIndex) ? (
                    <TruthScore score={(listing.truthIndex ?? listing.owner?.truthIndex) as number} size="sm" />
                  ) : (
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{browse.noScore}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <h2 className="font-poppins font-semibold text-white text-lg mb-2">
              {searchTerm ? copy.noTitle : browse.emptyTitle}
            </h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {searchTerm ? copy.noBody : browse.emptyBody}
            </p>
            <LeadCapture initialLocation={searchTerm} />
            <Link href="/listings" className="btn btn-primary mt-6">{copy.browseAll}</Link>
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
