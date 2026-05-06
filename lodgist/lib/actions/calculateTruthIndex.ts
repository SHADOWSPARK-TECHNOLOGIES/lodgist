"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export interface TruthIndexBreakdown {
  images: number;
  description: number;
  landlordVerified: number;
  priceCompetitiveness: number;
  reviews: number;
}

export interface TruthIndexResult {
  score: number;
  breakdown: TruthIndexBreakdown;
  error?: string;
}

/**
 * Calculates the Lodgist Truth Index for a given property.
 *
 * Scoring categories (0-100 total):
 *   - Image count        (0-20pts)
 *   - Description length (0-15pts)
 *   - Landlord verified  (0-25pts)
 *   - Price vs median    (0-20pts)
 *   - Review count       (0-20pts)
 */
export async function calculateTruthIndex(
  propertyId: string
): Promise<TruthIndexResult> {
  try {
    // 1. Fetch the property with related data
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owner: {
          include: { role: true },
        },
        listings: {
          include: {
            bookings: true,
          },
        },
      },
    });

    if (!property) {
      return {
        score: 0,
        breakdown: {
          images: 0,
          description: 0,
          landlordVerified: 0,
          priceCompetitiveness: 0,
          reviews: 0,
        },
        error: `Property with id "${propertyId}" not found`,
      };
    }

    // --- Scoring ---

    // 2a. Image count (0-20pts)
    // Since there's no Image model in the schema yet, we infer from the
    // property's existence. If a dedicated Image model is added later,
    // replace this with `property.images.length`.
    // For now, assume 0 images since no Image relation exists.
    const imageCount = 0;
    let imageScore: number;
    if (imageCount === 0) {
      imageScore = 0;
    } else if (imageCount <= 2) {
      imageScore = 10;
    } else {
      imageScore = 20;
    }

    // 2b. Description length (0-15pts)
    // Use the first listing's description as the property description proxy.
    const description = property.listings[0]?.description ?? "";
    const descLen = description.length;
    let descriptionScore: number;
    if (descLen === 0) {
      descriptionScore = 0;
    } else if (descLen < 50) {
      descriptionScore = 5;
    } else if (descLen <= 200) {
      descriptionScore = 10;
    } else {
      descriptionScore = 15;
    }

    // 2c. Landlord verified status (0-25pts)
    const isLandlord = property.owner.role.name === "LANDLORD";
    const landlordVerifiedScore = isLandlord ? 25 : 0;

    // 2d. Price vs area median (0-20pts)
    // Use the first listing's price. For median, query all listings in the
    // same city (excluding the current one) to compute a rough median.
    let priceCompetitivenessScore: number;
    const currentPrice = property.listings[0]?.price;

    if (currentPrice == null) {
      // No price data — neutral
      priceCompetitivenessScore = 10;
    } else {
      try {
        // Gather comparable listings in the same city
        const comparableListings = await prisma.listing.findMany({
          where: {
            property: { city: property.city },
            id: { notIn: property.listings.map((l) => l.id) },
            price: { not: undefined },
          },
          select: { price: true },
        });

        if (comparableListings.length === 0) {
          // No comparable data — neutral
          priceCompetitivenessScore = 10;
        } else {
          const prices = comparableListings.map((l) => l.price!).sort((a, b) => a - b);
          const mid = Math.floor(prices.length / 2);
          const median =
            prices.length % 2 === 0
              ? (prices[mid - 1] + prices[mid]) / 2
              : prices[mid];

          const ratio = currentPrice / median;

          if (ratio >= 0.8 && ratio <= 1.2) {
            // Within 20 % of median
            priceCompetitivenessScore = 20;
          } else if (ratio > 1.5) {
            // More than 50 % above median
            priceCompetitivenessScore = 5;
          } else {
            // Somewhere in between — neutral
            priceCompetitivenessScore = 10;
          }
        }
      } catch {
        // Fallback on median calculation failure
        priceCompetitivenessScore = 10;
      }
    }

    // 2e. Review count (0-20pts)
    // Since there's no Review model yet, default to 0.
    // When a Review model is added, replace with `property.reviews.length`.
    const reviewCount = 0;
    let reviewScore: number;
    if (reviewCount === 0) {
      reviewScore = 0;
    } else if (reviewCount <= 2) {
      reviewScore = 10;
    } else if (reviewCount <= 5) {
      reviewScore = 15;
    } else {
      reviewScore = 20;
    }

    // 3. Aggregate score
    const totalScore = Math.min(
      Math.max(
        imageScore +
          descriptionScore +
          landlordVerifiedScore +
          priceCompetitivenessScore +
          reviewScore,
        0
      ),
      100
    );

    const breakdown: TruthIndexBreakdown = {
      images: imageScore,
      description: descriptionScore,
      landlordVerified: landlordVerifiedScore,
      priceCompetitiveness: priceCompetitivenessScore,
      reviews: reviewScore,
    };

    // 4. Persist the score
    await prisma.truthIndexScore.create({
      data: {
        propertyId,
        score: totalScore,
        breakdown: breakdown as unknown as Prisma.InputJsonValue,
      },
    });

    return { score: totalScore, breakdown };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error calculating truth index";

    return {
      score: 0,
      breakdown: {
        images: 0,
        description: 0,
        landlordVerified: 0,
        priceCompetitiveness: 0,
        reviews: 0,
      },
      error: message,
    };
  }
}
