"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma, Role } from "@prisma/client";

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
 *
 * TruthIndexScore is per-user in packages/db schema (userId, not propertyId).
 * The final score is persisted against the property owner.
 */
export async function calculateTruthIndex(
  propertyId: number
): Promise<TruthIndexResult> {
  try {
    // 1. Fetch the property with related data
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owner: true,
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
    // Since there's no Image model on Property in packages/db, infer from listings
    // For now, assume 0 images since no direct Image relation on Property.
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
    // Role is an enum — compare directly
    const isLandlord = property.owner.role === "LANDLORD";
    const landlordVerifiedScore = isLandlord ? 25 : 0;

    // 2d. Price vs area median (0-20pts)
    let priceCompetitivenessScore: number;
    const currentPrice = property.listings[0]?.price;

    if (currentPrice == null) {
      priceCompetitivenessScore = 10;
    } else {
      try {
        const comparableListings = await prisma.listing.findMany({
          where: {
            property: { city: property.city },
            id: { notIn: property.listings.map((l) => l.id) },
            price: { not: undefined },
          },
          select: { price: true },
        });

        if (comparableListings.length === 0) {
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
            priceCompetitivenessScore = 20;
          } else if (ratio > 1.5) {
            priceCompetitivenessScore = 5;
          } else {
            priceCompetitivenessScore = 10;
          }
        }
      } catch {
        priceCompetitivenessScore = 10;
      }
    }

    // 2e. Review count (0-20pts)
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

    // 4. Persist the score — TruthIndexScore uses userId (property owner)
    await prisma.truthIndexScore.create({
      data: {
        userId: property.ownerId,
        score: totalScore,
        activityScore: null,
        verificationScore: null,
        ratingScore: null,
        metadata: breakdown as unknown as Prisma.InputJsonValue,
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
