'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { bookingsApi, listingsApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { TruthScore } from '@/components/ui/TruthScore';
import FeeLedger from '@/components/ListingDetail/FeeLedger';
import RequestViewing from '@/components/ListingDetail/RequestViewing';
import { detail, formatYearlyRent, supportWhatsAppLink } from '@/lib/copy';
import { decisionFacts, hasTrustScore } from '@/lib/listingHonesty';
import { invoiceRequestMessage } from '@/lib/invoiceRequest';
import { safeNextPath } from '@/lib/returnPath';
import type { Listing, TenantBooking } from '@/lib/types';

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
  const { user } = useAuth();
  const [invoiceBooking, setInvoiceBooking] = useState<TenantBooking | null>(null);

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

  useEffect(() => {
    if (!user || !listing) {
      setInvoiceBooking(null);
      return;
    }
    let cancelled = false;
    bookingsApi.mine()
      .then((res) => {
        if (cancelled) return;
        const match = (res.data ?? []).find((row) => row.listingId === listing.id && row.status !== "CANCELLED");
        setInvoiceBooking(match ?? null);
      })
      .catch(() => { if (!cancelled) setInvoiceBooking(null); });
    return () => { cancelled = true; };
  }, [user, listing]);

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
  const moveIn = asMoveIn(listing.totalMoveInCost);
  const facts = decisionFacts(listing);
  const score = listing.truthIndex ?? listing.owner?.truthIndex;
  const homeLabel = `${listing.title}${place ? ` (${place})` : ''}`;
  const askHref = supportWhatsAppLink(`Home: ${homeLabel}`);
  const inspectHref = supportWhatsAppLink(`I want to inspect this home before I pay: ${homeLabel}`);
  const reportHref = supportWhatsAppLink(`Home: ${homeLabel}. Report: this listing needs a second look.`);
  const canRequest = facts.verified && listing.isFlaggedForFraud !== true;
  const returnTo = safeNextPath(`/listings/${listing.id}`) || '/listings';
  const loginHref = `/login?next=${encodeURIComponent(returnTo)}`;
  const invoiceHref = invoiceBooking
    ? supportWhatsAppLink(invoiceRequestMessage({
        bookingId: invoiceBooking.id,
        listing: homeLabel,
        amount: typeof invoiceBooking.totalAmount === "number" ? invoiceBooking.totalAmount : listing.price,
      }))
    : null;

  return (
    <div className="container py-8 max-w-3xl">
      <Link href="/listings" className="nav-link text-sm">{detail.back}</Link>
      <h1 className="font-poppins font-bold text-white text-2xl mt-4 mb-1">{listing.title}</h1>
      {place && <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>{place}</p>}
      {(facts.example || !facts.verified) && (
        <p className="text-sm mt-3" style={{ color: 'var(--color-orange)' }}>
          {facts.example ? detail.sampleTitle : detail.unverified}
        </p>
      )}

      <div className="h-56 rounded-xl mt-6 mb-6 flex items-center justify-center overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
        {listing.images?.[0]?.url ? (
          <img src={listing.images[0].url} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No photo yet</span>
        )}
      </div>

      <section className="card mb-4" aria-labelledby="decision-heading">
        <h2 id="decision-heading" className="font-poppins font-semibold text-white mb-4">{detail.decisionTitle}</h2>
        {facts.example && <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>{detail.sampleBody}</p>}
        <dl className="space-y-3 mb-4">
          <div>
            <dt className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{detail.rent}</dt>
            <dd className="font-poppins font-bold text-xl mt-1" style={{ color: 'var(--color-orange)' }}>{formatYearlyRent(facts.annualRent) || detail.rentMissing}</dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{detail.moveIn}</dt>
            <dd className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {facts.example
                ? `${detail.sampleMoveIn}${facts.moveInTotal != null ? ` · ₦${facts.moveInTotal.toLocaleString('en-NG')}` : ''}`
                : facts.moveInTotal != null
                  ? `₦${facts.moveInTotal.toLocaleString('en-NG')}`
                  : detail.noMoveIn}
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{detail.lastVerified}</dt>
            <dd className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>{facts.lastVerification}</dd>
          </div>
        </dl>
        <h3 className="font-poppins font-semibold text-white text-sm mb-1">{detail.completed}</h3>
        {facts.completed.length === 0 ? (
          <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.65)' }}>{detail.noneCompleted}</p>
        ) : (
          <ul className="space-y-1 mb-3">
            {facts.completed.map((item) => <li key={item} className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>{item}</li>)}
          </ul>
        )}
        <h3 className="font-poppins font-semibold text-white text-sm mb-1">{detail.outstanding}</h3>
        <ul className="space-y-1 mb-3">
          {facts.outstanding.map((item) => <li key={item} className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>{item}</li>)}
        </ul>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{detail.inspectionBody}</p>
        <div className="mt-4">
          {hasTrustScore(score) ? <TruthScore score={score as number} /> : <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{detail.noScore}</p>}
        </div>
        {!facts.example && moveIn && (
          <div className="mt-4">
            <FeeLedger metadata={moveIn} category={feeCategory(listing.property && 'propertyType' in listing.property ? String((listing.property as { propertyType?: string }).propertyType) : '')} />
          </div>
        )}
      </section>

      {listing.description && (
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>{listing.description}</p>
      )}

      {canRequest ? (
        <RequestViewing listingId={listing.id} loginHref={loginHref} askHref={askHref} />
      ) : (
        <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>{detail.viewingClosed}</p>
      )}

      {invoiceHref && (
        <div className="mb-4">
          <a className="btn btn-secondary" href={invoiceHref} target="_blank" rel="noopener noreferrer">{detail.askInvoice}</a>
          <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.55)' }}>{detail.askInvoiceNote}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        {inspectHref ? (
          <a className={canRequest ? 'btn btn-secondary' : 'btn btn-primary'} href={inspectHref} target="_blank" rel="noopener noreferrer">{detail.inspection}</a>
        ) : !canRequest ? (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{detail.whatsAppMissing}</p>
        ) : null}
        {askHref && <a className="btn btn-secondary" href={askHref} target="_blank" rel="noopener noreferrer">{detail.whatsApp}</a>}
        {reportHref && <a className="btn btn-secondary" href={reportHref} target="_blank" rel="noopener noreferrer">{detail.report}</a>}
      </div>
    </div>
  );
}
