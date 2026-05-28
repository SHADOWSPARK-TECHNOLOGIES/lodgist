import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Maps Prisma property type strings to PropertyCard's union
function mapPropertyType(
  category: string,
  propType: string | null | undefined,
): "apartment" | "house" | "land" | "commercial" {
  if (propType) {
    const t = propType.toLowerCase();
    if (t.includes("land")) return "land";
    if (t.includes("shop") || t.includes("office") || t.includes("commercial")) return "commercial";
    if (t.includes("house") || t.includes("duplex") || t.includes("bungalow") || t.includes("mansion")) return "house";
    if (t.includes("apartment") || t.includes("flat") || t.includes("studio")) return "apartment";
  }
  if (category === "COMMERCIAL") return "commercial";
  return "apartment";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const state = searchParams.get("state")?.trim();
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const category = searchParams.get("category"); // RESIDENTIAL | COMMERCIAL | SHORT_LET
  const verifiedOnly = searchParams.get("verified") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10)));
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Record<string, unknown> = {};

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { property: { address: { contains: q, mode: "insensitive" } } },
      { property: { city: { contains: q, mode: "insensitive" } } },
    ];
  }

  if (state) {
    where.property = { state: { contains: state, mode: "insensitive" } };
  }

  if (minPrice || maxPrice) {
    const priceFilter: Record<string, number> = {};
    if (minPrice) priceFilter.gte = parseFloat(minPrice);
    if (maxPrice) priceFilter.lte = parseFloat(maxPrice);
    where.price = priceFilter;
  }

  if (category) {
    where.category = category;
  }

  if (verifiedOnly) {
    where.riskState = "VERIFIED";
  }

  const sortBy = searchParams.get("sortBy") ?? "default";
  const orderBy: Record<string, string> | Record<string, string>[] =
    sortBy === "price-asc"   ? { price: "asc" } :
    sortBy === "price-desc"  ? { price: "desc" } :
    sortBy === "trust-desc"  ? [{ truthIndex: "desc" }, { isFeatured: "desc" }] :
    sortBy === "trust-asc"   ? [{ truthIndex: "asc" },  { isFeatured: "desc" }] :
    [{ isFeatured: "desc" }, { truthIndex: "desc" }, { createdAt: "desc" }];

  try {
    const [total, rows] = await Promise.all([
      prisma.listing.count({ where: where as never }),
      prisma.listing.findMany({
        where: where as never,
        skip,
        take: limit,
        orderBy: orderBy as never,
        select: {
          id: true,
          title: true,
          price: true,
          category: true,
          riskState: true,
          truthIndex: true,
          property: {
            select: {
              address: true,
              city: true,
              state: true,
              lga: true,
              propertyType: true,
              bedrooms: true,
              bathrooms: true,
            },
          },
          owner: {
            select: { name: true },
          },
          images: {
            select: { url: true, altText: true },
            orderBy: [{ isPrimary: "desc" }, { order: "asc" }],
            take: 3,
          },
        },
      }),
    ]);

    const listings = rows.map((r) => ({
      id: String(r.id),
      title: r.title,
      price: r.price,
      location: {
        address: r.property?.address ?? "",
        lga: r.property?.lga ?? r.property?.city ?? "",
        state: r.property?.state ?? "",
      },
      propertyType: mapPropertyType(r.category, r.property?.propertyType),
      bedrooms: r.property?.bedrooms ?? undefined,
      bathrooms: r.property?.bathrooms ?? undefined,
      images: r.images.map((img) => ({ url: img.url, alt: img.altText ?? undefined })),
      truthIndex: r.truthIndex ?? 0,
      owner: {
        name: r.owner?.name ?? undefined,
        verified: r.riskState === "VERIFIED",
      },
    }));

    return NextResponse.json({ listings, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[api/listings] GET failed:", err);
    return NextResponse.json({ message: "Failed to load listings." }, { status: 500 });
  }
}
