"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { listingsApi } from "@/lib/api";
import { detail } from "@/lib/copy";
import { isValidListingId } from "@/lib/requestTimeout";
import ListingDetailClient from "./ListingDetailClient";

/**
 * Shown with a 404 status when the public API has no such listing. A signed-in
 * owner or STUDIO_ADMIN can still open a non-public listing: the browser asks
 * the API again with their token and, if allowed, renders the normal page.
 */
export default function ListingNotFound() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { user, isLoaded } = useAuth();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user || !isValidListingId(id)) return;
    let active = true;
    listingsApi.get(Number(id))
      .then((res) => { if (active && res.data) setAllowed(true); })
      .catch(() => {});
    return () => { active = false; };
  }, [id, isLoaded, user]);

  if (allowed) return <ListingDetailClient />;

  const loginHref = isValidListingId(id)
    ? `/login?next=${encodeURIComponent(`/listings/${id}`)}`
    : "/login";

  return (
    <div className="container py-16 max-w-xl text-center">
      <h1 className="font-poppins font-semibold text-white text-2xl mb-3">{detail.missing}</h1>
      <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.75)" }}>{detail.notFoundBody}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/listings" className="btn btn-primary">{detail.notFoundBrowse}</Link>
        <Link href="/search" className="btn btn-secondary">{detail.notFoundSearch}</Link>
      </div>
      {isLoaded && !user && (
        <p className="text-sm mt-6" style={{ color: "rgba(255,255,255,0.7)" }}>
          {detail.notFoundOwner}{" "}
          <Link href={loginHref} className="underline" style={{ color: "var(--color-teal)" }}>{detail.notFoundSignIn}</Link>
        </p>
      )}
    </div>
  );
}
