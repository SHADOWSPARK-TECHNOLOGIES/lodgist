'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { listingsApi } from '@/lib/api';
import { TruthScore } from '@/components/ui/TruthScore';
import { formatYearlyRent, listings as copy, supportWhatsAppAsk } from '@/lib/copy';
import { hasTrustScore, isExampleListing } from '@/lib/listingHonesty';
import type { Listing } from '@/lib/types';

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [maxRent, setMaxRent] = useState('');
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setFailed(false);
    const maxPrice = maxRent.trim() === '' ? undefined : Number(maxRent);
    listingsApi.list({
      search,
      page: 1,
      limit: 12,
      maxPrice: maxPrice != null && !Number.isNaN(maxPrice) ? maxPrice : undefined,
    })
      .then(res => setListings(res.data ?? []))
      .catch(() => { setFailed(true); setListings([]); })
      .finally(() => setLoading(false));
  }, [search, maxRent, reloadKey]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-navy)' }}>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="font-poppins font-bold text-2xl text-white mb-2">{copy.title}</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{copy.subtitle}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <label className="sr-only" htmlFor="area-search">{copy.searchPlaceholder}</label>
          <input id="area-search" className="input max-w-sm" placeholder={copy.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} />
          <label className="sr-only" htmlFor="max-rent">{copy.maxRent}</label>
          <input id="max-rent" className="input max-w-[12rem]" inputMode="numeric" placeholder={copy.maxRent} value={maxRent} onChange={e => setMaxRent(e.target.value)} />
        </div>
        {!loading && !failed && <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>{copy.count(listings.length)}</p>}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="card">
                <div className="skeleton h-48 w-full mb-4" />
                <div className="skeleton h-4 w-3/4 mb-2" />
                <div className="skeleton h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : failed ? (
          <div className="text-center py-16">
            <h2 className="font-poppins font-semibold text-white text-lg mb-2">{copy.loadErrorTitle}</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>{copy.loadErrorBody}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button type="button" className="btn btn-primary" onClick={() => setReloadKey(k => k + 1)}>{copy.retry}</button>
              <a href={supportWhatsAppAsk} className="btn btn-secondary" target="_blank" rel="noopener noreferrer">{copy.emptyCta}</a>
            </div>
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16">
            <h2 className="font-poppins font-semibold text-white text-lg mb-2">{search || maxRent ? copy.searchEmptyTitle : copy.emptyTitle}</h2>
            <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{search || maxRent ? copy.searchEmptyBody : copy.emptyBody}</p>
            {!search && !maxRent && <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>{copy.elsewhere}</p>}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href={supportWhatsAppAsk} className="btn btn-primary" target="_blank" rel="noopener noreferrer">{copy.emptyCta}</a>
              <Link href="/register" className="btn btn-secondary">{copy.listCta}</Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map(listing => {
              const score = listing.owner?.truthIndex;
              return (
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
                    <h3 className="font-poppins font-semibold text-white text-sm mb-1">{listing.title}</h3>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {listing.property?.city ?? listing.property?.state ?? ''}
                    </p>
                    {listing.price != null && (
                      <p className="font-poppins font-bold text-sm mt-2" style={{ color: 'var(--color-orange)' }}>
                        {formatYearlyRent(listing.price)}
                      </p>
                    )}
                    {isExampleListing(listing) && (
                      <p className="text-xs mt-2" style={{ color: 'var(--color-teal)' }}>{copy.sampleBadge}</p>
                    )}
                  </div>
                  {typeof score === "number" && hasTrustScore(score) ? (
                    <TruthScore score={score} size="sm" />
                  ) : (
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{copy.noScore}</span>
                  )}
                </div>
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
