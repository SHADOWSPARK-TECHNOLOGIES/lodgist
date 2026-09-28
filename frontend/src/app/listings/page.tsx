'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { listingsApi } from '@/lib/api';
import { TruthScore } from '@/components/ui/TruthScore';
import { formatYearlyRent, listings as copy, supportWhatsApp } from '@/lib/copy';
import type { Listing } from '@/lib/types';

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    listingsApi.list({ search, page: 1, limit: 12 })
      .then(res => setListings(res.data))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-navy)' }}>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="font-poppins font-bold text-2xl text-white mb-2">{copy.title}</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{copy.subtitle}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <input className="input max-w-sm" placeholder={copy.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} />
        </div>

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
        ) : listings.length === 0 ? (
          <div className="text-center py-16">
            <h2 className="font-poppins font-semibold text-white text-lg mb-2">{copy.emptyTitle}</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>{copy.emptyBody}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href={supportWhatsApp} className="btn btn-primary" target="_blank" rel="noopener noreferrer">{copy.emptyCta}</a>
              <Link href="/" className="btn btn-secondary">{copy.homeCta}</Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    <h3 className="font-poppins font-semibold text-white text-sm mb-1">{listing.title}</h3>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {listing.property?.city ?? listing.property?.state ?? ''}
                    </p>
                    {listing.price != null && (
                      <p className="font-poppins font-bold text-sm mt-2" style={{ color: 'var(--color-orange)' }}>
                        {formatYearlyRent(listing.price)}
                      </p>
                    )}
                  </div>
                  {listing.owner && (
                    <TruthScore score={listing.owner.truthIndex ?? 75} size="sm" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
