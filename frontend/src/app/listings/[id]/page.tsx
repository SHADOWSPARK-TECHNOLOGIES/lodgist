import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidListingId } from "@/lib/requestTimeout";
import ListingDetailClient from "./ListingDetailClient";

// Resolved per request so a missing listing returns a real 404 status.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Home",
};

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidListingId(id)) notFound();
  // Missing listings are rewritten to a server-rendered 404 in src/proxy.ts.
  return <ListingDetailClient />;
}
