'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { listingsApi } from '@/lib/api';
import { formatYearlyRent } from '@/lib/copy';
import { buildDecision, whatsAppLink } from '@/lib/listingDecision';
import type { Listing } from '@/lib/types';

function naira(value: number | null) {
  if (value == null) return 'Not listed';
  return `\u20a6${Number(value).toLocaleString('en-NG')}`;
}

function DecisionContent() {
  const searchParams = useSearchParams();
  const rawId = searchParams.get('id');
  const id = rawId == null ? NaN : Number(rawId);
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(Boolean(rawId));
  const [failed, setFailed] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!rawId) {
      setLoading(false);
      return;
    }
    if (!Number.isFinite(id)) {
      setMissing(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setMissing(false);
    listingsApi.get(id)
      .then((res) => {
        if (cancelled) return;
        if (!res.data) setMissing(true);
        else setListing(res.data);
      })
      .catch((err: { status?: number }) => {
        if (cancelled) return;
        if (err?.status === 404) setMissing(true);
        else setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, rawId]);

  if (!rawId) {
    return (
      <div className="container py-16 max-w-xl">
        <h1 className="font-poppins font-bold text-white text-2xl mb-3">Decide on a home</h1>
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Open a listing first. This page needs a listing id.
        </p>
        <Link href="/listings" className="btn btn-primary">Browse homes</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container py-10 max-w-xl">
        <div className="skeleton h-8 w-48 mb-4" />
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }

  if (failed || missing || !listing) {
    return (
      <div className="container py-16 max-w-xl text-center">
        <h1 className="font-poppins font-semibold text-white text-xl mb-4">
          {failed ? 'We could not load this home.' : 'This home is not on Lodgist.'}
        </h1>
        <Link href="/listings" className="nav-link">All homes</Link>
      </div>
    );
  }

  const view = buildDecision(listing);
  const place = [listing.property?.lga, listing.property?.city, listing.property?.state].filter(Boolean).join(', ');
  const label = `${listing.title}${place ? ` (${place})` : ''}`;
  const inspect = whatsAppLink(
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP,
    `I want to inspect: ${label}`,
  );
  const ask = whatsAppLink(
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP,
    `Question about: ${label}`,
  );

  return (
    <div className="container py-8 max-w-xl">
      <Link href={`/listings/${listing.id}`} className="nav-link text-sm">Back to the home</Link>
      <h1 className="font-poppins font-bold text-white text-2xl mt-4 mb-1">Decide</h1>
      <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>{listing.title}{place ? ` · ${place}` : ''}</p>
      {view.sample && (
        <p className="inline-flex mb-4 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'var(--color-orange)', color: 'var(--color-navy)' }}>
          Sample or unchecked. Not a live listing.
        </p>
      )}

      <section className="card mb-4">
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{view.sample ? 'Example annual rent' : 'Annual rent'}</p>
        <p className="font-poppins font-bold text-xl mt-1" style={{ color: 'var(--color-orange)' }}>
          {view.annualRent == null ? 'Not listed' : formatYearlyRent(view.annualRent)}
        </p>
        <p className="text-xs mt-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {view.moveInIsExample ? 'Example move-in total' : 'Move-in total'}
        </p>
        <p className="font-poppins font-semibold text-white mt-1">{naira(view.moveInTotal)}</p>
        {view.moveInIsExample && (
          <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Not a bill.</p>
        )}
      </section>

      <section className="card mb-4">
        <h2 className="font-poppins font-semibold text-white text-sm mb-2">Last verification</h2>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{view.lastVerificationText}</p>
        <h2 className="font-poppins font-semibold text-white text-sm mt-4 mb-2">Checks done</h2>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{view.checksDoneText}</p>
        <h2 className="font-poppins font-semibold text-white text-sm mt-4 mb-2">Still outstanding</h2>
        <ul className="space-y-1">
          {view.checksOutstanding.map((item) => (
            <li key={item} className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{item}</li>
          ))}
        </ul>
      </section>

      {view.sample && (
        <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
          These buttons do not book a viewing. This listing is not verified.
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        {inspect ? (
          <a className="btn btn-primary" href={inspect} target="_blank" rel="noopener noreferrer">Ask for an inspection</a>
        ) : (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>Inspection is not booked in the app. WhatsApp support is not configured.</p>
        )}
        {ask && (
          <a className="btn btn-secondary" href={ask} target="_blank" rel="noopener noreferrer">Ask on WhatsApp</a>
        )}
      </div>
    </div>
  );
}

export default function DecisionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-navy)' }}>
        <div className="spinner" />
      </div>
    }>
      <DecisionContent />
    </Suspense>
  );
}
