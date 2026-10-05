import { Suspense } from "react";
import type { Metadata } from "next";
import CheckStatus from "@/components/rental/CheckStatus";

export const metadata: Metadata = {
  title: "Rental check status",
};

export default function RentalCheckStatusPage() {
  return (
    <Suspense fallback={<p className="container py-10 text-white">Loading case</p>}>
      <CheckStatus />
    </Suspense>
  );
}
