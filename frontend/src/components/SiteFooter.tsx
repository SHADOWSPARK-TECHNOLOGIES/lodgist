import Link from "next/link";
import { brand } from "@/lib/copy";

const product = [
  [brand.browse, "/listings"],
  [brand.list, "/advertise"],
  [brand.trust, "/trust"],
] as const;

const company = [
  [brand.about, "/about"],
  [brand.aim, "/mission"],
  [brand.privacy, "/trust"],
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t py-10" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="container grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-poppins font-bold text-white text-lg">Lodgist</p>
          <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{brand.tagline}</p>
          <p className="mt-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{brand.endorsement}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-white mb-3">{brand.productLabel}</p>
          <ul className="space-y-2">
            {product.map(([label, href]) => (
              <li key={href + label}>
                <Link href={href} className="nav-link" style={{ fontSize: "0.8rem" }}>{label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-white mb-3">{brand.companyLabel}</p>
          <ul className="space-y-2">
            {company.map(([label, href]) => (
              <li key={label}>
                <Link href={href} className="nav-link" style={{ fontSize: "0.8rem" }}>{label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
