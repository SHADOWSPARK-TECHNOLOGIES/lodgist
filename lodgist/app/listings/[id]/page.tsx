import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Star,
  MapPin,
  Bed,
  Bath,
  BadgeCheck,
  Shield,
  Flag,
  Calendar,
  MessageSquare,
  ArrowRight,
  Clock,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PropertyCard from "@/components/PropertyCard";
import { ImageGallery } from "./ImageGallery";
import { TruthIndexCard } from "./TruthIndexCard";
import { BookingForm } from "./BookingForm";
import { ReviewsSection } from "./ReviewsSection";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNgn(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function propertyTypeLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// ─── Server Component ─────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const listingId = parseInt(id);

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      property: {
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              truthIndex: true,
              createdAt: true,
            },
          },
        },
      },
      images: {
        orderBy: { createdAt: "asc" },
      },
      reviews: {
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!listing) {
    notFound();
  }

  const { property, images, reviews } = listing;
  const owner = property?.owner;

  // ─── Related listings (same state, exclude current) ─────────────────────
  const relatedListings = await prisma.listing.findMany({
    where: {
      id: { not: listingId },
      property: property ? { state: property.state } : undefined,
      status: "VERIFIED",
    },
    include: {
      property: {
        select: {
          address: true,
          city: true,
          state: true,
        },
      },
      images: {
        take: 1,
        select: { url: true, altText: true },
      },
    },
    take: 3,
    orderBy: { createdAt: "desc" },
  });

  // Map related listings to the PropertyCard Listing interface
  const relatedCards = relatedListings.map((rl) => ({
    id: String(rl.id),
    title: rl.property?.address ?? rl.title,
    price: rl.price,
    location: {
      address: rl.property?.address ?? "",
      lga: rl.property?.city ?? "",
      state: rl.property?.state ?? "",
    },
    propertyType: "apartment" as const,
    bedrooms: 0,
    bathrooms: 0,
    images: rl.images.map((img) => ({ url: img.url, alt: img.altText ?? "" })),
    truthIndex: 0,
    owner: { name: "Property Owner", verified: false },
  }));

  // ─── Truth Index breakdown ──────────────────────────────────────────────
  // TruthIndexScore is per-user (userId), not per-property.
  // Use the owner's truthIndex from the User model.
  const truthIndex = owner?.truthIndex ?? 0;

  const truthBars = [
    { label: "Images", key: "images", max: 20 },
    { label: "Description", key: "description", max: 15 },
    { label: "Verified Owner", key: "verifiedOwner", max: 25 },
    { label: "Price Fairness", key: "priceFairness", max: 20 },
    { label: "Reviews", key: "reviews", max: 20 },
  ];

  const truthColor =
    truthIndex >= 80
      ? "text-[#1ABC9C]"
      : truthIndex >= 50
        ? "text-[#FF6F3C]"
        : "text-red-500";

  const truthBgColor =
    truthIndex >= 80
      ? "bg-[#1ABC9C]"
      : truthIndex >= 50
        ? "bg-[#FF6F3C]"
        : "bg-red-500";

  // ─── Landlord stats ─────────────────────────────────────────────────────
  const ownerListingsCount = owner
    ? await prisma.listing.count({ where: { ownerId: owner.id } })
    : 0;

  const ownerBookingsCount = owner
    ? await prisma.booking.count({
        where: { listing: { ownerId: owner.id } },
      })
    : 0;

  const memberSince = owner ? formatDate(owner.createdAt) : "N/A";
  const responseRate = ownerBookingsCount > 0 ? "95%" : "N/A";

  // ─── Average rating ─────────────────────────────────────────────────────
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-2 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-[#FF6F3C] transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link href="/" className="hover:text-[#FF6F3C] transition-colors">
            Properties
          </Link>
          <span>/</span>
          <span className="text-[#0B1B2B] font-medium truncate max-w-[200px]">
            {property?.address ?? listing.title}
          </span>
        </nav>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
          <div className="space-y-8">
            {/* ── 1. Image Gallery ─────────────────────────────────────── */}
            <ImageGallery
              images={images.map((img) => ({
                url: img.url,
                alt: img.altText ?? "Property image",
              }))}
            />

            {/* ── 2. Property Info ──────────────────────────────────────── */}
            <Card>
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-[#0B1B2B] sm:text-3xl">
                      {listing.description?.split(".")[0] ?? listing.title}
                    </h1>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 text-[#1ABC9C]" />
                      <span>
                        {property?.address ?? ""}, {property?.city ?? ""}, {property?.state ?? ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="rounded-full bg-[#1ABC9C]/10 px-3 py-1 text-xs font-medium text-[#1ABC9C]">
                        {propertyTypeLabel(listing.category.toLowerCase()) || "Property"}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        Listed {timeAgo(listing.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-[#FF6F3C]">
                      {formatNgn(listing.price)}
                    </p>
                    <p className="text-sm text-muted-foreground">per year</p>
                  </div>
                </div>

                {/* Amenities / features row */}
                <div className="mt-6 flex flex-wrap gap-6 border-t pt-6">
                  <div className="flex items-center gap-2">
                    <Bed className="h-5 w-5 text-[#1ABC9C]" />
                    <div>
                      <p className="text-sm font-medium text-[#0B1B2B]">Bedrooms</p>
                      <p className="text-sm text-muted-foreground">{property?.bedrooms ?? "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bath className="h-5 w-5 text-[#1ABC9C]" />
                    <div>
                      <p className="text-sm font-medium text-[#0B1B2B]">Bathrooms</p>
                      <p className="text-sm text-muted-foreground">{property?.bathrooms ?? "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-[#1ABC9C]" />
                    <div>
                      <p className="text-sm font-medium text-[#0B1B2B]">Status</p>
                      <p className="text-sm text-[#1ABC9C] font-medium capitalize">
                        {listing.status.toLowerCase()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {listing.description && (
                  <div className="mt-6 border-t pt-6">
                    <h2 className="text-lg font-semibold text-[#0B1B2B]">Description</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {listing.description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── 3. Truth Index Score Card ─────────────────────────────── */}
            <TruthIndexCard
              score={truthIndex}
              breakdown={null}
              bars={truthBars}
              color={truthColor}
              bgColor={truthBgColor}
            />

            {/* ── 4. Why This Score ────────────────────────────────────── */}
            <Card>
              <CardContent className="p-6 sm:p-8">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-[#0B1B2B]">
                  <Shield className="h-5 w-5 text-[#1ABC9C]" />
                  Why This Score?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  The Truth Index is Lodgist&apos;s proprietary AI-powered scoring system. It evaluates
                  each listing across five dimensions to give you a single trustworthy score out of 100.
                  A score of <span className="font-semibold text-[#1ABC9C]">80+ means low risk</span> —
                  the listing has passed all verification checks.
                </p>
                <ul className="mt-4 space-y-2">
                  {[
                    { label: "Images (20%)", desc: "Are the photos real, high-quality, and consistent?" },
                    { label: "Description (15%)", desc: "Does the listing text match the actual property?" },
                    { label: "Owner Verification (25%)", desc: "Has the landlord's identity been confirmed?" },
                    { label: "Price Fairness (20%)", desc: "Is the rent realistic for the area and property type?" },
                    { label: "Reviews & History (20%)", desc: "What do previous tenants say? Any fraud flags?" },
                  ].map((item) => (
                    <li key={item.label} className="flex items-start gap-2 text-sm">
                      <Star className="mt-0.5 h-4 w-4 shrink-0 text-[#1ABC9C]" />
                      <div>
                        <span className="font-medium text-[#0B1B2B]">{item.label}</span>
                        <span className="text-muted-foreground"> — {item.desc}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* ── 5. What to Check Before Paying ─────────────────────────── */}
            <Card>
              <CardContent className="p-6 sm:p-8">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-[#0B1B2B]">
                  <Shield className="h-5 w-5 text-[#1ABC9C]" />
                  What to Check Before Paying
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Protect yourself from property fraud. Follow these steps before making any payment.
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    { icon: "📸", title: "Request a live video tour", desc: "Ask the landlord to show the property on a WhatsApp video call. Compare with listing photos." },
                    { icon: "📋", title: "Confirm the owner's identity", desc: "Ask for a government-issued ID and verify the name matches the property documents." },
                    { icon: "🤝", title: "Insist on escrow payment", desc: "Never pay rent directly. Use Lodgist Escrow — funds are released only after you inspect and confirm." },
                    { icon: "🏛️", title: "Verify land documents", desc: "For landed properties, confirm the Certificate of Occupancy (C of O) or survey plan with the state land registry." },
                    { icon: "🔍", title: "Search for past fraud reports", desc: "Check if this listing or landlord has been reported for fraud on our platform." },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-3 rounded-lg bg-amber-50 p-3">
                      <span className="text-lg">{item.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-[#0B1B2B]">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-[#1ABC9C]/20 bg-[#1ABC9C]/5 p-3">
                  <p className="text-xs leading-relaxed text-[#1ABC9C]">
                    <strong>Pro tip:</strong> Only make payments through Lodgist&apos;s escrow system.
                    If a landlord asks for payment outside the platform, report them immediately.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ── 6. Reviews Section ────────────────────────────────────── */}
            <ReviewsSection
              reviews={reviews.map((r) => ({
                id: String(r.id),
                rating: r.rating,
                comment: r.comment,
                createdAt: r.createdAt,
                user: {
                  name: r.user.name ?? "Anonymous",
                  image: r.user.avatarUrl,
                },
              }))}
              averageRating={avgRating}
              totalReviews={reviews.length}
            />
          </div>

          {/* ── RIGHT COLUMN (Sidebar) ────────────────────────────────────── */}
          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            {/* ── 4. Landlord Card ──────────────────────────────────────── */}
            {owner && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1ABC9C]/10 text-[#1ABC9C]">
                      <User className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[#0B1B2B] truncate">
                          {owner.name ?? "Property Owner"}
                        </p>
                        <BadgeCheck className="h-4 w-4 shrink-0 text-[#1ABC9C]" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Verified Landlord
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 text-center text-sm">
                    <div>
                      <p className="font-semibold text-[#0B1B2B]">{memberSince}</p>
                      <p className="text-xs text-muted-foreground">Member Since</p>
                    </div>
                    <div>
                      <p className="font-semibold text-[#0B1B2B]">{ownerListingsCount}</p>
                      <p className="text-xs text-muted-foreground">Properties</p>
                    </div>
                    <div>
                      <p className="font-semibold text-[#0B1B2B]">{responseRate}</p>
                      <p className="text-xs text-muted-foreground">Response Rate</p>
                    </div>
                    <div>
                      <p className="font-semibold text-[#0B1B2B]">{ownerBookingsCount}</p>
                      <p className="text-xs text-muted-foreground">Bookings</p>
                    </div>
                  </div>

                  <Button className="mt-4 w-full bg-[#1ABC9C] text-white hover:bg-[#15a082]">
                    <MessageSquare className="h-4 w-4" />
                    Contact Landlord
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* ── 5. Booking Form ────────────────────────────────────────── */}
            <BookingForm listingId={String(listing.id)} price={listing.price} />

            {/* ── Escrow / Payment Protection ────────────────────────── */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1ABC9C]/10">
                    <Shield className="h-6 w-6 text-[#1ABC9C]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#0B1B2B]">Payment Protection</p>
                    <p className="text-xs text-[#1ABC9C] font-medium">
                      Escrow Ready ✓
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  This listing supports Lodgist Escrow. Your payment is held securely
                  and released only after you confirm the property matches the listing.
                  <Link href="/verify" className="ml-1 font-medium text-[#1ABC9C] hover:underline">
                    Learn more
                  </Link>
                </p>
              </CardContent>
            </Card>

            {/* ── Request Verification CTA ──────────────────────────────── */}
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm font-semibold text-[#0B1B2B]">Not sure about this listing?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Request a manual verification check by our team.
                </p>
                <Link href="/verify">
                  <Button className="mt-4 w-full bg-[#FF6F3C] text-white hover:bg-[#e85d2c]">
                    <Shield className="h-4 w-4" />
                    Request Verification
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* ── Report Fraud Button ──────────────────────────────────── */}
            <Card>
              <CardContent className="p-6">
                <form action="/api/fraud-reports" method="POST">
                  <input type="hidden" name="listingId" value={listing.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Flag className="h-4 w-4" />
                    Report Fraud
                  </Button>
                </form>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Suspect this listing is fraudulent? Let us know.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── 8. Related Listings ─────────────────────────────────────────── */}
        {relatedCards.length > 0 && (
          <section className="mt-12">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#0B1B2B]">
                  Similar Properties in {property?.state ?? "this area"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  More verified listings near this area
                </p>
              </div>
              <Link
                href="/"
                className="flex items-center gap-1.5 text-sm font-semibold text-[#1ABC9C] hover:text-[#15a082] transition-colors"
              >
                View All
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedCards.map((card) => (
                <PropertyCard key={card.id} listing={card} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
