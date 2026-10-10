import type { Metadata } from "next";
import ListingReviewQueue from "@/components/admin/ListingReviewQueue";

export const metadata: Metadata = {
  title: "Listing review",
  robots: { index: false, follow: false },
};

export default function AdminListingsPage() {
  return <ListingReviewQueue />;
}
