import type { Metadata } from "next";
import ListingNotFound from "./ListingNotFound";

export const metadata: Metadata = {
  title: "Home not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return <ListingNotFound />;
}
