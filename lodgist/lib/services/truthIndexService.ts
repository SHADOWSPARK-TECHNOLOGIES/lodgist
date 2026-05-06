import { Property, User, RoleName } from '@prisma/client';

// This is a simplified version. In a real app, you'd fetch more data
// like images, reviews, and average prices for the area.
interface PropertyWithRelations extends Property {
  owner: User & { role: { name: RoleName } };
  // images: Image[]; // Assuming an Image model with relation
  // reviews: Review[]; // Assuming a Review model with relation
}

export const calculateTruthIndex = (property: PropertyWithRelations): number => {
  let score = 0;

  // 1. Verified Landlord (up to 30 points)
  if (property.owner.role.name === RoleName.LANDLORD) {
    score += 30;
  }

  // 2. Images placeholder (up to 25 points)
  score += 15;

  // 3. Price placeholder (up to 15 points)
  score += 10;

  // 4. Review placeholder (up to 10 points)
  score += 5;

  // 5. Address completeness (up to 20 points)
  if (property.address && property.address.length > 20) {
    score += 20;
  } else if (property.address && property.address.length > 5) {
    score += 10;
  }

  // Ensure score is within 0-100
  return Math.min(Math.max(score, 0), 100);
};

// Function to update the truth index for a property
export const updatePropertyTruthIndex = async (propertyId: string): Promise<Property | null> => {
  // This part requires a working Prisma client and fetching related data
  // For now, returning a mock or just updating the existing property
  // with a hardcoded score.

  // In a real scenario, you'd fetch:
  // const property = await prisma.property.findUnique({
  //   where: { id: propertyId },
  //   include: {
  //     owner: { include: { role: true } },
  //     // images: true,
  //     // reviews: true,
  //   },
  // });

  // if (!property) {
  //   return null;
  // }

  // const newTruthIndex = calculateTruthIndex(property as PropertyWithRelations);

  // return await prisma.property.update({
  //   where: { id: propertyId },
  //   data: {
  //     truthIndex: newTruthIndex,
  //   },
  // });
  console.log(`Simulating truth index update for property ${propertyId}`);
  return null; // Returning null for now as database is not set up
};