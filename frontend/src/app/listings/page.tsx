'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { listingsApi } from '@/lib/api';
import { isAbortError } from '@/lib/requestTimeout';
import { TruthScore } from '@/components/ui/TruthScore';
import { formatYearlyRent, listingCard, listings as copy, supportWhatsAppLink } from '@/lib/copy';
import { photoAlt, storedPhotos } from '@/lib/listingPhotos';
import { hasTrustScore, isEvidenceVerified, isExampleListing, isLodgistReviewed, publicListings, reviewLabel, sourceLabel, verificationLabel } from '@/lib/listingHonesty';
import LeadCapture from '@/components/LeadCapture';
import type { Listing } from '@/lib/types';

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [maxRent, setMaxRent] = useState('');
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const firstLoad = useRef(true);

  // Typing waits 300 ms before fetching, and each new fetch aborts the previous
  // one, so an older, slower response can never overwrite a newer result.
  useEffect(() => {
    const controller = new AbortController();
    const delay = firstLoad.current ? 0 : 300;
    firstLoad.current = false;
    const maxPrice = maxRent.trim() === '' ? undefined : Number(maxRent);
    const timer = setTimeout(() => {
      setLoading(true);
      setFailed(false);
      listingsApi.list({
        search,
        page: 1,
        limit: 12,
        maxPrice: maxPrice != null && !Number.isNaN(maxPrice) ? maxPrice : undefined,
      }, { signal: controller.signal })
        .then(res => { if (!controller.signal.aborted) setListings(publicListings(res.data ?? [])); })
        .catch((err) => {
          if (isAbortError(err) || controller.signal.aborted) return;
          setFailed(true);
          setListings([]);
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    let cancelled = false;
    const maxPrice = maxRent.trim() === '' ? undefined : Number(maxRent);
    listingsApi.list({
      search,
      page: 1,
      limit: 12,
      maxPrice: maxPrice != null && !Number.isNaN(maxPrice) ? maxPrice : undefined,
    })
      .then(res => { if (!cancelled) setListings(publicListings(res.data ?? [])); })
      .catch(() => { if (!cancelled) { setFailed(true); setListings([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search, maxRent, reloadKey]);

  const area = search.trim();
  const askHref = supportWhatsAppLink(area ? `I need a home. Area: ${area}` : "I need a home.");

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-navy)' }}>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="font-poppins font-bold text-2xl text-white mb-2">{copy.title}</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{copy.subtitle}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="w-full max-w-sm">
            <label className="label" htmlFor="area-search">{copy.searchLabel}</label>
            <input id="area-search" className="input" placeholder={copy.searchPlaceholder} value={search} onChange={e => { setSearch(e.target.value); setLoading(true); setFailed(false); }} />
          </div>
          <div className="w-full max-w-[12rem]">
            <label className="label" htmlFor="max-rent">{copy.maxRent}</label>
            <input id="max-rent" className="input" inputMode="numeric" value={maxRent} onChange={e => { setMaxRent(e.target.value); setLoading(true); setFailed(false); }} />
          </div>
        </div>
        <p className="text-xs mb-3 max-w-2xl" style={{ color: 'rgba(255,255,255,0.65)' }}>{copy.labelsLegend}</p>
        <p role="status" aria-live="polite" className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.65)' }}>
          {loading ? copy.loading : failed ? '' : copy.count(listings.length)}
        </p>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2].map(i => (
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
              <button type="button" className="btn btn-primary" onClick={() => { setReloadKey(k => k + 1); setLoading(true); setFailed(false); }}>{copy.retry}</button>
              {askHref && <a href={askHref} className="btn btn-secondary" target="_blank" rel="noopener noreferrer">{copy.emptyCta}</a>}
            </div>
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16">
            <h2 className="font-poppins font-semibold text-white text-lg mb-2">{search || maxRent ? copy.searchEmptyTitle : copy.emptyTitle}</h2>
            <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{search || maxRent ? copy.searchEmptyBody : copy.emptyBody}</p>
            {!search && !maxRent && <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>{copy.elsewhere}</p>}
            <LeadCapture initialLocation={search} initialBudget={maxRent} />
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {askHref ? <a href={askHref} className="btn btn-primary" target="_blank" rel="noopener noreferrer">{copy.emptyCta}</a> : <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{copy.whatsAppMissing}</p>}
              <Link href="/advertise" className="btn btn-secondary">{copy.listCta}</Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map(listing => {
              const score = listing.truthIndex ?? listing.owner?.truthIndex;
              const photos = storedPhotos(listing.images);
              const primary = photos[0];
              return (
              <Link key={listing.id} href={`/listings/${listing.id}`} className="card card-elevated block hover:border-orange/30 transition-all no-underline">
                <div className="h-48 rounded-xl mb-4 flex items-center justify-center relative overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
                  {primary ? (
                    <img src={primary.url} alt={photoAlt(primary, listing.title)} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <span style={{ fontSize: '2.5rem', opacity: 0.3 }}>Home</span>
                  )}
                  {photos.length > 1 && (
                    <span className="absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(11,27,43,0.82)', color: '#fff' }}>
                      {listingCard.photoCount(photos.length)}
                    </span>
                  )}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-poppins font-semibold text-white text-sm mb-1">{listing.title}</h2>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {listing.property?.city ?? listing.property?.state ?? ''}
                    </p>
                    {listing.price != null && (
                      <p className="font-poppins font-bold text-sm mt-2" style={{ color: 'var(--color-orange)' }}>
                        {formatYearlyRent(listing.price)}
                      </p>
                    )}
                    <p className="text-xs mt-2" style={{ color: isLodgistReviewed(listing) ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)' }}>
                      {reviewLabel(listing)}
                    </p>
                    <p className="text-xs mt-1" style={{ color: isEvidenceVerified(listing) ? 'var(--color-teal)' : 'var(--color-orange)' }}>
                      {verificationLabel(listing)}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{sourceLabel(listing)}</p>
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
