import prisma from '../../../db/src/client.js';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Initialize Google Cloud Vision client
export const visionClient = new ImageAnnotatorClient();

export async function checkDuplicateLandlordPhone(listing) {
  let score = 0;
  let reason = null;

  if (!listing.owner.phone) {
    return { score, reason };
  }

  // Find other users with the same phone number but different user IDs
  const otherUsersWithSamePhone = await prisma.user.findMany({
    where: {
      phone: listing.owner.phone,
      id: { not: listing.owner.id },
    },
  });

  if (otherUsersWithSamePhone.length > 0) {
    score = 40; // Significant fraud signal
    reason = `Duplicate landlord phone (${listing.owner.phone}) found across ${otherUsersWithSamePhone.length} other user account(s).`;
  }

  return { score, reason };
}

export async function checkPriceAnomaly(listing) {
  let score = 0;
  let reason = null;

  const listingPrice = listing.price;
  const state = listing.property?.state;
  const lga = listing.property?.lga;

  if (!state || !lga || !listingPrice) {
    return { score, reason: "Missing location or price data for anomaly check." };
  }

  const medianPrice = await getMedianPriceForArea(state, lga, listing.category);

  if (medianPrice === 0) {
    return { score, reason: `No median price data for ${lga}, ${state}.` };
  }

  const priceDifference = Math.abs(listingPrice - medianPrice);
  const percentageDifference = (priceDifference / medianPrice) * 100;

  if (percentageDifference > 50) { // Price is more than 50% different from median
    score = 30;
    reason = `Listing price (${listingPrice}) is ${percentageDifference.toFixed(2)}% different from median price (${medianPrice}) in ${lga}, ${state}.`;
  } else if (percentageDifference > 30) {
    score = 15;
    reason = `Listing price (${listingPrice}) is ${percentageDifference.toFixed(2)}% different from median price (${medianPrice}) in ${lga}, ${state}. (Moderate anomaly)`;
  }

  return { score, reason };
}

// Helper function to simulate fetching median price data
export async function getMedianPriceForArea(state, lga, category) {
  // In a real application, this would query a database or external service.
  // For now, use hardcoded values for demonstration.
  const medianPrices = {
    "Imo": {
      "Owerri Municipal": {
        "RESIDENTIAL": 150000,
        "COMMERCIAL": 500000,
        "SHORT_LET": 30000
      },
      "Orlu": {
        "RESIDENTIAL": 80000,
        "COMMERCIAL": 200000,
        "SHORT_LET": 15000
      },
    },
    "Lagos": {
      "Ikoyi": {
        "RESIDENTIAL": 2000000,
        "COMMERCIAL": 5000000,
        "SHORT_LET": 100000
      },
      "Yaba": {
        "RESIDENTIAL": 500000,
        "COMMERCIAL": 1500000,
        "SHORT_LET": 50000
      }
    }
  };

  return medianPrices[state]?.[lga]?.[category] || 0;
}

export async function performImageReverseSearch(listing) {
  let score = 0;
  const reasons = [];

  if (!listing.images || listing.images.length === 0) {
    return { score, reason: "No images found for listing to perform reverse search." };
  }

  for (const image of listing.images) {
    try {
      const [result] = await visionClient.webDetection({
        image: { source: { imageUri: image.url } },
      });
      const webDetection = result.webDetection;

      if (webDetection.fullMatchingImages && webDetection.fullMatchingImages.length > 0) {
        // Image found elsewhere on the web
        score += 10; // Moderate signal
        reasons.push(`Image '${image.url}' found as full match on ${webDetection.fullMatchingImages.length} other sites.`);
      }

      if (webDetection.pagesWithMatchingImages && webDetection.pagesWithMatchingImages.length > 0) {
        // Page contains matching images
        score += 5; // Lower signal
        reasons.push(`Image '${image.url}' found on ${webDetection.pagesWithMatchingImages.length} pages containing matching images.`);
      }

      // Check for common stock photo indicators
      const stockPhotoSites = ["shutterstock.com", "unsplash.com", "pexels.com", "istockphoto.com"];
      const foundOnStockSite = webDetection.pagesWithMatchingImages.some(page => 
        stockPhotoSites.some(site => page.url.includes(site))
      );

      if (foundOnStockSite) {
        score += 25; // Stronger signal for stock photos
        reasons.push(`Image '${image.url}' appears to be a stock photo.`);
      }

    } catch (error) {
      console.error(`Error performing web detection for image ${image.url}:`, error);
      reasons.push(`Error during image reverse search for '${image.url}'.`);
    }
  }

  // Cap the score for this check
  if (score > 60) score = 60;

  return { score, reason: reasons.length > 0 ? reasons.join("; ") : null };
}
