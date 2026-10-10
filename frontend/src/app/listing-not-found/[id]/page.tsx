import type { Metadata } from "next";
import ListingNotFound from "../../listings/[id]/ListingNotFound";

// Rendered by src/proxy.ts (status 404) for /listings/<missing id>.
export const metadata: Metadata = {
  title: "Home not found",
  robots: { index: false, follow: true },
};

export default function MissingListingPage() {
  return <ListingNotFound />;
}
