import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { IMO_STATE_SCHOOLS } from "@/lib/data/imoStateSchools";

interface SearchFilters {
  maxPrice?: number;
  minPrice?: number;
  propertyType?: string;
  bedrooms?: number;
  school?: string;
  amenities?: string[];
  state?: string;
  lga?: string;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({ query: "" }));
  const query: string = typeof body?.query === "string" ? body.query : "";

  if (!query) {
    return Response.json({ error: "Query is required" }, { status: 400 });
  }

  const filters = await parseQueryToFilters(query);

  const baseWhere: Prisma.ListingWhereInput = {
    publishedAt: { not: null },
  };

  if (filters.maxPrice)
    baseWhere.price = { ...(typeof baseWhere.price === "object" && baseWhere.price !== null ? baseWhere.price : {}), lte: filters.maxPrice };
  if (filters.minPrice)
    baseWhere.price = { ...(typeof baseWhere.price === "object" && baseWhere.price !== null ? baseWhere.price : {}), gte: filters.minPrice };
  if (filters.propertyType)
    baseWhere.propertyType = { contains: filters.propertyType, mode: "insensitive" };
  if (filters.bedrooms) baseWhere.bedrooms = filters.bedrooms;
  if (filters.school) {
    const school = IMO_STATE_SCHOOLS.find((s) => s.id === filters.school);
    if (school)
      baseWhere.nearbySchool = { contains: school.shortName, mode: "insensitive" };
  }

  const [verified, scraped] = await Promise.all([
    prisma.listing.findMany({
      where: {
        ...baseWhere,
        OR: [{ source: "USER_CREATED" }, { source: "CLAIMED_FROM_SCRAPE" }],
      },
      orderBy: { publishedAt: "desc" },
      take: 12,
      select: listingSelect(),
    }),
    prisma.listing.findMany({
      where: {
        ...baseWhere,
        source: "SCRAPED_EXTERNAL",
      },
      orderBy: { publishedAt: "desc" },
      take: 8,
      select: listingSelect(),
    }),
  ]);

  return Response.json({
    query,
    filters,
    verified: verified.map(formatListing),
    scraped: scraped.map(formatListing),
    counts: { verified: verified.length, scraped: scraped.length },
  });
}

function listingSelect() {
  return {
    id: true,
    title: true,
    price: true,
    address: true,
    propertyType: true,
    bedrooms: true,
    bathrooms: true,
    studentAmenities: true,
    isStudentLodge: true,
    nearbySchool: true,
    distanceToSchool: true,
    source: true,
    sourceName: true,
    sourceUrl: true,
    estimatedAgentFee: true,
  } as const;
}

type ListingRow = Awaited<ReturnType<typeof prisma.listing.findMany<{ select: ReturnType<typeof listingSelect> }>>>[number];

function formatListing(l: ListingRow) {
  const rent = Number(l.price ?? 0);
  const agentFee = l.estimatedAgentFee ? Number(l.estimatedAgentFee) : rent * 0.1;
  const agreementFee = rent * 0.1;
  const totalWithAgent = rent + agentFee + agreementFee + 5000;

  return {
    ...l,
    price: rent,
    amenities: l.studentAmenities ?? [],
    isVerified: l.source === "USER_CREATED" || l.source === "CLAIMED_FROM_SCRAPE",
    feeBreakdown:
      l.source === "SCRAPED_EXTERNAL"
        ? {
            rent,
            agentFee,
            agreementFee,
            inspectionFee: 5000,
            total: totalWithAgent,
            lodgistSaving: agentFee + agreementFee,
          }
        : null,
  };
}

async function parseQueryToFilters(query: string): Promise<SearchFilters> {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const GEMINI_KEY =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;

  if (!ANTHROPIC_KEY && !GEMINI_KEY) {
    return parseWithRegex(query);
  }

  const systemPrompt = `You are a property search query parser for a Nigerian student housing platform.
Parse the user's natural language query into structured filters.

Available schools (use the id):
- futo (FUTO, Federal University of Technology Owerri)
- imsu (IMSU, Imo State University)
- nekede (Federal Polytechnic Nekede)
- alvan (Alvan Ikoku)
- imopoly (Imo State Polytechnic)
- hope (Hope University)

Property types: self-contain, single-room, flat, apartment, duplex, bungalow

Return ONLY valid JSON in this exact shape:
{
  "maxPrice": number or null,
  "minPrice": number or null,
  "propertyType": string or null,
  "bedrooms": number or null,
  "school": string id or null,
  "amenities": array of strings or null
}

Prices are annual in naira: "100k" = 100000, "1m" = 1000000.
"under"/"max"/"below" → maxPrice. "at least"/"min" → minPrice.
Return ONLY the JSON object. No prose, no markdown.`;

  try {
    if (ANTHROPIC_KEY) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: "user", content: query }],
        }),
      });
      const data = (await res.json()) as { content?: { text?: string }[] };
      const text = data.content?.[0]?.text ?? "{}";
      return JSON.parse(text.replace(/```json|```/g, "").trim()) as SearchFilters;
    }

    if (GEMINI_KEY) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: systemPrompt + "\n\nUser query: " + query }],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
            },
          }),
        }
      );
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      return JSON.parse(
        text.replace(/```json|```/g, "").trim()
      ) as SearchFilters;
    }
  } catch (e) {
    console.warn(
      "[search] AI parse failed, falling back to regex:",
      (e as Error).message
    );
  }

  return parseWithRegex(query);
}

function parseWithRegex(query: string): SearchFilters {
  const q = query.toLowerCase();
  const filters: SearchFilters = {};

  const priceMatch = q.match(
    /(?:under|max|below|less than|<\s*)\s*(?:₦|n)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(k|m)?/i
  );
  if (priceMatch) {
    let amount = parseFloat(priceMatch[1].replace(/,/g, ""));
    if (priceMatch[2]?.toLowerCase() === "k") amount *= 1000;
    if (priceMatch[2]?.toLowerCase() === "m") amount *= 1000000;
    filters.maxPrice = amount;
  }

  if (q.includes("futo")) filters.school = "futo";
  else if (q.includes("imsu")) filters.school = "imsu";
  else if (q.includes("nekede") || q.includes("poly")) filters.school = "nekede";
  else if (q.includes("alvan")) filters.school = "alvan";
  else if (q.includes("imopoly") || q.includes("imo poly")) filters.school = "imopoly";
  else if (q.includes("hope")) filters.school = "hope";

  if (q.includes("self-contain") || q.includes("self contain"))
    filters.propertyType = "self-contain";
  else if (q.includes("single room") || q.includes("one room"))
    filters.propertyType = "single-room";
  else if (q.includes("flat")) filters.propertyType = "flat";
  else if (q.includes("apartment")) filters.propertyType = "apartment";
  else if (q.includes("duplex")) filters.propertyType = "duplex";

  const bedMatch = q.match(/(\d+)\s*(?:bed|bedroom)/);
  if (bedMatch) filters.bedrooms = parseInt(bedMatch[1]);

  return filters;
}
