import { dimensionRows } from "@/lib/listingHonesty";
import type { Listing } from "@/lib/types";

export function ListingStateLabels({ listing }: { listing: Listing }) {
  const rows = dimensionRows(listing);
  return (
    <dl className="mt-2 space-y-1">
      {rows.map((row) => (
        <div key={row.key}>
          <dt className="text-xs inline" style={{ color: "rgba(255,255,255,0.45)" }}>{row.title}: </dt>
          <dd className="text-xs inline" style={{ color: "rgba(255,255,255,0.75)" }}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
