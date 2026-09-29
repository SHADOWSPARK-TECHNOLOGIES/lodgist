'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { listingsApi } from '@/lib/api';
import { TruthScore } from '@/components/ui/TruthScore';
import FeeLedger from '@/components/ListingDetail/FeeLedger';
import { detail, formatYearlyRent, trustCenter } from '@/lib/copy';
import { hasTrustScore, isExampleListing } from '@/lib/listingHonesty';
import type { Listing } from '@/lib/types';

type MoveIn = {
  base_rent?: number;
  agency_fee?: number;
  legal_fee?: number;
  caution_fee?: number;
  inspection_fee?: number;
  service_charge?: number;
  total?: number;
  currency?: string;
  sample?: boolean;
};

function asMoveIn(value: unknown): MoveIn | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as MoveIn;
}

function feeCategory(category?: string | null): 'residential' | 'commercial' | 'short-let' {
  const value = (category || '').toLowerCase();
  if (value.includes('commercial')) return 'commercial';
  if (value.includes('short')) return 'short-let';
  return 'residential';
}

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [missing, setMissing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setMissing(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    setMissing(false);
    listingsApi.get(id)
      .then((res) => {
        if (!res.data) setMissing(true);
        else setListing(res.data);
      })
      .catch((err: { status?: number }) => {
        if (err?.status === 404) setMissing(true);
        else setFailed(true);
      })
      .finally(() => setLoading(false));
  }, [id, reloadKey]);

  if (loading) {
    return (
      <div className="container py-10">
        <div className="skeleton h-8 w-48 mb-4" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  if (missing || !listing) {
    return (
      <div className="container py-16 text-center">
        <h1 className="font-poppins font-semibold text-white text-xl mb-4">{failed ? detail.loadError : detail.missing}</h1>
        {failed && <button type="button" className="btn btn-primary" onClick={() => setReloadKey((n) => n + 1)}>{detail.retry}</button>}
        <div className="mt-4"><Link href="/listings" className="nav-link">{detail.back}</Link></div>
      </div>
    );
  }

  const place = [listing.property?.lga, listing.property?.city, listing.property?.state].filter(Boolean).join(', ');
  const moveIn = asMoveIn((listing as Listing & { totalMoveInCost?: unknown }).totalMoveInCost);
  const example = isExampleListing(listing);
  const score = listing.owner?.truthIndex;
  const waText = encodeURIComponent(`Home: ${listing.title}${place ? ` (${place})` : ''}`);
  const wa = `https://wa.me/2349136094315?text=${waText}`;

  return (
    <div className="container py-8 max-w-3xl">
      <Link href="/listings" className="nav-link text-sm">{detail.back}</Link>
      <h1 className="font-poppins font-bold text-white text-2xl mt-4 mb-1">{listing.title}</h1>
      {place && <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>{place}</p>}

      <div className="h-56 rounded-xl mb-6 flex items-center justify-center overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
        {listing.images?.[0]?.url ? (
          <img src={listing.images[0].url} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No photo yet</span>
        )}
      </div>

      <section className="card mb-4">
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{detail.rent}</p>
        <p className="font-poppins font-bold text-xl mt-1" style={{ color: 'var(--color-orange)' }}>{formatYearlyRent(listing.price) || 'Rent not listed'}</p>
        <div className="mt-4">
          {hasTrustScore(score) ? <TruthScore score={score as number} /> : <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{detail.noScore}</p>}
        </div>
        {listing.updatedAt && (
          <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.4)' }}>{detail.updated} {new Date(listing.updatedAt).toLocaleDateString('en-NG')}</p>
        )}
      </section>

      <section className="mb-4">
        <h2 className="font-poppins font-semibold text-white mb-2">{example ? detail.sampleTitle : detail.moveIn}</h2>
        {example && <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.65)' }}>{detail.sampleBody}</p>}
        {moveIn && !example ? <FeeLedger metadata={moveIn} category={feeCategory(listing.property && 'propertyType' in listing.property ? String((listing.property as { propertyType?: string }).propertyType) : '')} /> : moveIn && example ? (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {formatYearlyRent(listing.price)} rent in this example. Move-in example {moveIn.total != null ? `₦${Number(moveIn.total).toLocaleString('en-NG')}` : 'not listed'}.
          </p>
        ) : (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{detail.noMoveIn}</p>
        )}
      </section>

      {!example && (
      <section className="card mb-4">
        <h2 className="font-poppins font-semibold text-white mb-2">{detail.checked}</h2>
        <ul className="space-y-1 mb-4">
          {trustCenter.checked.map((item) => (
            <li key={item} className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{item}</li>
          ))}
        </ul>
        <h3 className="font-poppins font-semibold text-white text-sm mb-1">{detail.unchecked}</h3>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{detail.uncheckedBody}</p>
      </section>
      )}

      {listing.description && (
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>{listing.description}</p>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Link href={`/decision?id=${listing.id}`} className="btn btn-secondary">Decide</Link>
        <a className="btn btn-primary" href={wa} target="_blank" rel="noopener noreferrer">{detail.whatsApp}</a>
        <a className="btn btn-secondary" href={`${wa}%0AReport:%20this%20listing%20needs%20a%20second%20look`} target="_blank" rel="noopener noreferrer">{detail.report}</a>
      </div>
    </div>
  );
}
