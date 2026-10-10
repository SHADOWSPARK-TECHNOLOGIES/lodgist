'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ArrangeWhatsAppPayment from '@/components/ArrangeWhatsAppPayment';
import { ApiError, bookingsApi, listingsApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { TruthScore } from '@/components/ui/TruthScore';
import FeeLedger from '@/components/ListingDetail/FeeLedger';
import RequestViewing from '@/components/ListingDetail/RequestViewing';
import { detail, formatYearlyRent, supportWhatsAppLink } from '@/lib/copy';
import { canRequestViewing, decisionFacts, hasTrustScore, isLodgistReviewed, isPublicListing, reviewLabel, sourceLabel, verificationLabel } from '@/lib/listingHonesty';
import ExploreNeighborhood from '@/components/spatial/ExploreNeighborhood';
import { invoiceRequestMessage } from '@/lib/invoiceRequest';
import { campusDirections } from '@/lib/campusDirections';
import { safeNextPath } from '@/lib/returnPath';
import { paymentWhatsAppText, whatsappArrangementRef } from '@/lib/whatsappPayment';
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
  return <ListingDetail key={params.id} id={Number(params.id)} />;
}

function ListingDetail({ id }: { id: number }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(Number.isFinite(id));
  const [failed, setFailed] = useState(false);
  const [missing, setMissing] = useState(!Number.isFinite(id));
  const [reloadKey, setReloadKey] = useState(0);
  const { user } = useAuth();
  const [invoiceResult, setInvoiceResult] = useState<{
    userId: number;
    listingId: number;
    booking: TenantBooking | null;
  } | null>(null);
  const invoiceBooking = user && listing && invoiceResult?.userId === user.id
    && invoiceResult.listingId === listing.id ? invoiceResult.booking : null;

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    let cancelled = false;
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
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, reloadKey]);

  useEffect(() => {
    if (!user || !listing) return;
    let cancelled = false;
    bookingsApi.mine()
      .then((res) => {
        if (cancelled) return;
        const match = (res.data ?? []).find((row) => row.listingId === listing.id && row.status !== "CANCELLED");
        setInvoiceResult({ userId: user.id, listingId: listing.id, booking: match ?? null });
      })
      .catch(() => { if (!cancelled) setInvoiceResult(null); });
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
        {failed && <button type="button" className="btn btn-primary" onClick={() => { setReloadKey((n) => n + 1); setLoading(true); setFailed(false); setMissing(false); }}>{detail.retry}</button>}
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
  const canRequest = canRequestViewing(listing);
  const returnTo = safeNextPath(`/listings/${listing.id}`) || '/listings';
  const loginHref = `/login?next=${encodeURIComponent(returnTo)}`;
  const invoiceHref = invoiceBooking
    ? supportWhatsAppLink(invoiceRequestMessage({
        bookingId: invoiceBooking.id,
        listing: homeLabel,
        amount: typeof invoiceBooking.totalAmount === "number" ? invoiceBooking.totalAmount : listing.price,
      }))
    : null;
  const bookingAmount = invoiceBooking && typeof invoiceBooking.totalAmount === "number" ? invoiceBooking.totalAmount : listing.price;
  const bookingCanPay = Boolean(
    invoiceBooking && (invoiceBooking.status === "PENDING" || invoiceBooking.status === "PENDING_VERIFICATION"),
  );
  const bookingPayHref = bookingCanPay && invoiceBooking
    ? supportWhatsAppLink(paymentWhatsAppText({
        what: "Booking",
        amountNgn: bookingAmount,
        currency: invoiceBooking.currency || "NGN",
        reference: invoiceBooking.id,
        listing: homeLabel,
        name: user?.name || undefined,
      }))
    : null;
  const directions = campusDirections({
    place,
    approx: listing.approxLocation ?? null,
  });

  return (
    <div className="container py-8 max-w-3xl">
      <Link href="/listings" className="nav-link text-sm">{detail.back}</Link>
      <h1 className="font-poppins font-bold text-white text-2xl mt-4 mb-1">{listing.title}</h1>
      {place && <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>{place}</p>}
      <p className="text-sm mt-3" style={{ color: isLodgistReviewed(listing) ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.55)' }}>
        {reviewLabel(listing)}
      </p>
      <p className="text-sm mt-1" style={{ color: isEvidenceVerified(listing) ? 'var(--color-teal)' : 'var(--color-orange)' }}>
        {verificationLabel(listing)}
      </p>
      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{detail.source}: {sourceLabel(listing)}</p>
      <p className="text-xs mt-2 max-w-xl" style={{ color: 'rgba(255,255,255,0.6)' }}>{detail.labelsExplain}</p>
      {facts.example && (
        <p className="text-sm mt-2" style={{ color: 'var(--color-orange)' }}>{detail.sampleTitle}</p>
      )}

      <ListingPhotos
        listingId={listing.id}
        title={listing.title}
        images={listing.images}
        canManage={Boolean(user && (user.role === "STUDIO_ADMIN" || user.id === listing.ownerId))}
        onImages={(images) => setListing({ ...listing, images })}
      />

      <section className="card mb-4" aria-labelledby="campus-heading">
        <h2 id="campus-heading" className="font-poppins font-semibold text-white mb-2">Area and campus</h2>
        <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.75)' }}>{directions.placeText}</p>
        <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.75)' }}>{directions.distanceText}</p>
        <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>{directions.pinNote}</p>
        {directions.mapUrl && (
          <a className="btn btn-secondary" href={directions.mapUrl} target="_blank" rel="noopener noreferrer">
            {directions.mapUrl.includes('/directions?') ? 'Open the area-to-campus map' : 'Open the area map'}
          </a>
        )}
      </section>

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

      {isPublicListing(listing) && (
        <ExploreNeighborhood
          listingId={listing.id}
          title={listing.title}
          place={place}
          approxLocation={listing.approxLocation ?? null}
        />
      )}

      <div id="listing-actions">
      {canRequest ? (
        <RequestViewing listingId={listing.id} loginHref={loginHref} askHref={askHref} />
      ) : (
        <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>{detail.viewingClosed}</p>
      )}

      {bookingCanPay && invoiceBooking && (
        <div className="mb-4">
          <ArrangeWhatsAppPayment
            href={bookingPayHref}
            label={arrangePayment.bookingCta}
            busyLabel={arrangePayment.opening}
            note={arrangePayment.bookingNote}
            missingLabel={arrangePayment.missing}
            prepare={async () => {
              if (invoiceBooking.status !== "PENDING") return;
              try {
                await bookingsApi.submitManualPayment(invoiceBooking.id, whatsappArrangementRef(invoiceBooking.id));
              } catch (err) {
                if (err instanceof ApiError && err.status === 409) return;
                throw err;
              }
            }}
          />
        </div>
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
    </div>
  );
}
