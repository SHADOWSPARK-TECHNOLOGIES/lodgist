import type { Metadata } from "next";
import PreviewClient from "./PreviewClient";

export const metadata: Metadata = {
  title: "Spatial Lab preview — DEV fixture, not a home",
  description: "A labelled development fixture near Nekede. Not a listing and not for rent.",
  robots: { index: false, follow: false },
};

export default function SpatialLabPreviewPage() {
  return <PreviewClient />;
}
