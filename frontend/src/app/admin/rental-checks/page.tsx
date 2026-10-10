import type { Metadata } from "next";
import ReviewWorkspace from "@/components/rental/ReviewWorkspace";

export const metadata: Metadata = {
  title: "Rental checks",
  robots: { index: false, follow: false },
};

export default function AdminRentalChecksPage() {
  return <ReviewWorkspace />;
}
