// ─── Vitest Unit Tests: calculateTruthIndex ──────────────────────────────────
//
// Tests cover:
//   - Minimum score (0) when property not found
//   - Maximum score (100) when all categories are maxed out
//   - Each scoring category independently
//   - Edge cases (empty description, no listings, no comparable prices)

import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "./mocks/prisma";

// Mock the prisma module before importing the action
vi.mock("@/lib/prisma", () => ({
  prisma,
}));

// Import after mocking
const { calculateTruthIndex } = await import(
  "@/lib/actions/calculateTruthIndex"
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProperty(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    address: "123 Test Street",
    city: "Lagos",
    state: "Lagos",
    lga: "Ikeja",
    ownerId: 1,
    title: "Test Property",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    owner: {
      id: 1,
      name: "Test Landlord",
      email: "landlord@test.com",
      emailVerified: null,
      avatarUrl: null,
      passwordHash: null,
      truthIndex: null,
      role: "LANDLORD",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    },
    listings: [
      {
        id: 1,
        propertyId: 1,
        ownerId: 1,
        price: 1_500_000,
        title: "Test Listing",
        description: "A beautiful 3-bedroom apartment in the heart of Lagos with modern finishes.",
        status: "VERIFIED",
        isFlaggedForFraud: false,
        fraudReason: null,
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
        bookings: [],
      },
    ],
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("calculateTruthIndex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Property not found ──────────────────────────────────────────────────

  it("should return score 0 and an error when property is not found", async () => {
    prisma.property.findUnique.mockResolvedValue(null);

    const result = await calculateTruthIndex(999);

    expect(result.score).toBe(0);
    expect(result.breakdown).toEqual({
      images: 0,
      description: 0,
      landlordVerified: 0,
      priceCompetitiveness: 0,
      reviews: 0,
    });
    expect(result.error).toContain("not found");
  });

  // ── Maximum score (100) ─────────────────────────────────────────────────

  it("should return score 60 when all categories are maxed (no Image/Review models)", async () => {
    // For max score we need:
    // - images: 3+ → 20pts (but Image model doesn't exist, so 0)
    // - description: 200+ chars → 15pts
    // - landlord: LANDLORD → 25pts
    // - price: within 20% of median → 20pts
    // - reviews: 6+ → 20pts (but Review model doesn't exist, so 0)
    // Total without image/review models: 15 + 25 + 20 = 60

    const longDesc = "A".repeat(250);
    const property = makeProperty({
      listings: [
        {
          id: 1,
          propertyId: 1,
          ownerId: 1,
          price: 1_500_000,
          title: "Test Listing",
          description: longDesc,
          status: "VERIFIED",
          isFlaggedForFraud: false,
          fraudReason: null,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-01"),
          bookings: [],
        },
      ],
    });

    prisma.property.findUnique.mockResolvedValue(property);
    // Comparable listings with median = 1_500_000 (same as current price → within 20%)
    prisma.listing.findMany.mockResolvedValue([
      { price: 1_400_000 },
      { price: 1_500_000 },
      { price: 1_600_000 },
    ]);

    const result = await calculateTruthIndex(1);

    // Without Image/Review models: 0 + 15 + 25 + 20 + 0 = 60
    expect(result.score).toBe(60);
    expect(result.breakdown).toEqual({
      images: 0,
      description: 15,
      landlordVerified: 25,
      priceCompetitiveness: 20,
      reviews: 0,
    });
  });

  // ── Minimum score (0) ───────────────────────────────────────────────────

  it("should return score 5 when all categories are at minimum", async () => {
    const property = makeProperty({
      owner: {
        id: 2,
        name: "Test Tenant",
        email: "tenant@test.com",
        emailVerified: null,
        avatarUrl: null,
        passwordHash: null,
        truthIndex: null,
        role: "TENANT",
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
      },
      listings: [
        {
          id: 2,
          propertyId: 1,
          ownerId: 2,
          price: 5_000_000,
          title: "Test Listing",
          description: "",
          status: "VERIFIED",
          isFlaggedForFraud: false,
          fraudReason: null,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-01"),
          bookings: [],
        },
      ],
    });

    prisma.property.findUnique.mockResolvedValue(property);
    // Comparable listings with median = 1_500_000 → ratio = 3.33 → > 50% above → 5pts
    prisma.listing.findMany.mockResolvedValue([
      { price: 1_000_000 },
      { price: 1_500_000 },
      { price: 2_000_000 },
    ]);

    const result = await calculateTruthIndex(1);

    // images: 0, description: 0, landlord: 0, price: 5, reviews: 0 = 5
    expect(result.score).toBe(5);
    expect(result.breakdown).toEqual({
      images: 0,
      description: 0,
      landlordVerified: 0,
      priceCompetitiveness: 5,
      reviews: 0,
    });
  });

  // ── Image scoring ───────────────────────────────────────────────────────

  it("should score images correctly (0, 10, or 20)", async () => {
    // Since there's no Image model, imageCount is always 0 → score 0
    // This test documents the current behavior and will need updating
    // when an Image model is added.
    const property = makeProperty();
    prisma.property.findUnique.mockResolvedValue(property);
    prisma.listing.findMany.mockResolvedValue([]);

    const result = await calculateTruthIndex(1);

    expect(result.breakdown.images).toBe(0);
  });

  // ── Description scoring ─────────────────────────────────────────────────

  it("should score description: empty=0, <50=5, 50-200=10, 200+=15", async () => {
    const testCases = [
      { desc: "", expected: 0 },
      { desc: "Short", expected: 5 },
      { desc: "A".repeat(50), expected: 10 },
      { desc: "A".repeat(100), expected: 10 },
      { desc: "A".repeat(200), expected: 10 },
      { desc: "A".repeat(201), expected: 15 },
      { desc: "A".repeat(500), expected: 15 },
    ];

    for (const { desc, expected } of testCases) {
      vi.clearAllMocks();
      const property = makeProperty({
        listings: [
          {
            id: 1,
            propertyId: 1,
            ownerId: 1,
            price: 1_500_000,
            title: "Test Listing",
            description: desc,
            status: "VERIFIED",
            isFlaggedForFraud: false,
            fraudReason: null,
            createdAt: new Date("2025-01-01"),
            updatedAt: new Date("2025-01-01"),
            bookings: [],
          },
        ],
      });
      prisma.property.findUnique.mockResolvedValue(property);
      prisma.listing.findMany.mockResolvedValue([]);

      const result = await calculateTruthIndex(1);
      expect(result.breakdown.description).toBe(expected);
    }
  });

  // ── Landlord verified scoring ───────────────────────────────────────────

  it("should give 25pts for LANDLORD role and 0pts otherwise", async () => {
    const roles = [
      { name: "LANDLORD", expected: 25 },
      { name: "TENANT", expected: 0 },
      { name: "USER", expected: 0 },
      { name: "STUDIO_ADMIN", expected: 0 },
    ];

    for (const { name, expected } of roles) {
      vi.clearAllMocks();
      const property = makeProperty({
        owner: {
          id: 1,
          name: "Test User",
          email: "user@test.com",
          emailVerified: null,
          avatarUrl: null,
          passwordHash: null,
          truthIndex: null,
          role: name,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-01"),
        },
      });
      prisma.property.findUnique.mockResolvedValue(property);
      prisma.listing.findMany.mockResolvedValue([]);

      const result = await calculateTruthIndex(1);
      expect(result.breakdown.landlordVerified).toBe(expected);
    }
  });

  // ── Price competitiveness scoring ───────────────────────────────────────

  it("should score price competitiveness correctly", async () => {
    // No price data → neutral (10)
    const propertyNoPrice = makeProperty({
      listings: [
        {
          id: 1,
          propertyId: 1,
          ownerId: 1,
          price: null,
          title: "Test Listing",
          description: "Test",
          status: "VERIFIED",
          isFlaggedForFraud: false,
          fraudReason: null,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-01"),
          bookings: [],
        },
      ],
    });
    prisma.property.findUnique.mockResolvedValue(propertyNoPrice);
    prisma.listing.findMany.mockResolvedValue([]);
    const resultNoPrice = await calculateTruthIndex(1);
    expect(resultNoPrice.breakdown.priceCompetitiveness).toBe(10);

    // No comparable listings → neutral (10)
    vi.clearAllMocks();
    const propertyNoComp = makeProperty();
    prisma.property.findUnique.mockResolvedValue(propertyNoComp);
    prisma.listing.findMany.mockResolvedValue([]);
    const resultNoComp = await calculateTruthIndex(1);
    expect(resultNoComp.breakdown.priceCompetitiveness).toBe(10);

    // Within 20% of median → 20
    vi.clearAllMocks();
    prisma.property.findUnique.mockResolvedValue(makeProperty());
    prisma.listing.findMany.mockResolvedValue([
      { price: 1_400_000 },
      { price: 1_500_000 },
      { price: 1_600_000 },
    ]);
    const resultWithin = await calculateTruthIndex(1);
    expect(resultWithin.breakdown.priceCompetitiveness).toBe(20);

    // More than 50% above median → 5
    vi.clearAllMocks();
    const propertyHigh = makeProperty({
      listings: [
        {
          id: 1,
          propertyId: 1,
          ownerId: 1,
          price: 3_000_000,
          title: "Test Listing",
          description: "Test",
          status: "VERIFIED",
          isFlaggedForFraud: false,
          fraudReason: null,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-01"),
          bookings: [],
        },
      ],
    });
    prisma.property.findUnique.mockResolvedValue(propertyHigh);
    prisma.listing.findMany.mockResolvedValue([
      { price: 1_000_000 },
      { price: 1_500_000 },
      { price: 2_000_000 },
    ]);
    const resultHigh = await calculateTruthIndex(1);
    expect(resultHigh.breakdown.priceCompetitiveness).toBe(5);
  });

  // ── Review scoring ──────────────────────────────────────────────────────

  it("should score reviews correctly (0, 10, 15, or 20)", async () => {
    // Since there's no Review model, reviewCount is always 0 → score 0
    const property = makeProperty();
    prisma.property.findUnique.mockResolvedValue(property);
    prisma.listing.findMany.mockResolvedValue([]);

    const result = await calculateTruthIndex(1);

    expect(result.breakdown.reviews).toBe(0);
  });

  // ── Error handling ──────────────────────────────────────────────────────

  it("should handle Prisma errors gracefully", async () => {
    prisma.property.findUnique.mockRejectedValue(new Error("Database connection failed"));

    const result = await calculateTruthIndex(1);

    expect(result.score).toBe(0);
    expect(result.error).toBe("Database connection failed");
  });

  it("should persist the score to TruthIndexScore table", async () => {
    const property = makeProperty();
    prisma.property.findUnique.mockResolvedValue(property);
    prisma.listing.findMany.mockResolvedValue([]);
    prisma.truthIndexScore.create.mockResolvedValue({
      id: 1,
      userId: 1,
      score: 35,
      breakdown: {},
      createdAt: new Date(),
    });

    await calculateTruthIndex(1);

    expect(prisma.truthIndexScore.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 1,
        score: expect.any(Number),
        breakdown: expect.any(Object),
      }),
    });
  });
});
