import { PrismaClient, Role, ListingCategory, ListingStatus, BookingStatus, Currency } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Lodgist database...')

  // Clean existing data in dependency order
  await prisma.whatsAppMessage.deleteMany()
  await prisma.whatsAppSession.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.fraudReport.deleteMany()
  await prisma.aiFraudSignal.deleteMany()
  await prisma.truthIndexScore.deleteMany()
  await prisma.escrowTransaction.deleteMany()
  await prisma.viewingRequest.deleteMany()
  await prisma.review.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.listingImage.deleteMany()
  await prisma.listing.deleteMany()
  await prisma.property.deleteMany()
  await prisma.profile.deleteMany()
  await prisma.user.deleteMany()

  const adminPass = await hash('Admin2026!', 12)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@lodgist.ng',
      name: 'Lodgist Admin',
      passwordHash: adminPass,
      role: Role.STUDIO_ADMIN,
      phone: '+2348000000001',
      isVerified: true,
    },
  })

  const landlordPass = await hash('Landlord2026!', 12)
  const landlord = await prisma.user.create({
    data: {
      email: 'emeka@lodgist.ng',
      name: 'Emeka Okafor',
      passwordHash: landlordPass,
      role: Role.LANDLORD,
      phone: '+2348012345678',
      isVerified: true,
    },
  })

  const tenantPass = await hash('Tenant2026!', 12)
  const tenant = await prisma.user.create({
    data: {
      email: 'chioma@lodgist.ng',
      name: 'Chioma Eze',
      passwordHash: tenantPass,
      role: Role.USER,
      phone: '+2348098765432',
      isVerified: true,
    },
  })

  const props = [
    { address: '12 Admiralty Way, Lekki Phase 1', city: 'Lekki', state: 'Lagos', bedrooms: 3, bathrooms: 2 },
    { address: '45 Aminu Kano Crescent, Wuse 2', city: 'Wuse', state: 'FCT', bedrooms: 4, bathrooms: 3 },
    { address: 'Plot 7, Bishop Oluwole Street', city: 'Victoria Island', state: 'Lagos', bedrooms: 2, bathrooms: 1 },
    { address: '8 Woji Road, GRA Phase 2', city: 'Port Harcourt', state: 'Rivers', bedrooms: 3, bathrooms: 2 },
    { address: '22 Bourdillon Road, Ikoyi', city: 'Ikoyi', state: 'Lagos', bedrooms: 5, bathrooms: 4 },
    { address: '30 Ikenegbu Layout, Owerri Municipal', city: 'Owerri', state: 'Imo', bedrooms: 3, bathrooms: 2 },
  ]

  for (const prop of props) {
    const property = await prisma.property.create({
      data: {
        address: prop.address,
        city: prop.city,
        state: prop.state,
        bedrooms: prop.bedrooms,
        bathrooms: prop.bathrooms,
        ownerId: landlord.id,
      },
    })

    const listing = await prisma.listing.create({
      data: {
        title: `${prop.city} 3-Bedroom Flat`,
        description: `Beautiful property in ${prop.city}, ${prop.state}. Secure environment with 24/7 power and running water.`,
        price: 800000,
        currency: Currency.NGN,
        category: ListingCategory.RESIDENTIAL,
        status: ListingStatus.VERIFIED,
        propertyId: property.id,
        ownerId: landlord.id,
        totalMoveInCost: {
          base_rent: 800000,
          agency_fee: 80000,
          legal_fee: 15000,
          caution_fee: 40000,
          inspection_fee: 5000,
          currency: 'NGN',
          total: 940000,
        },
      },
    })

    await prisma.truthIndexScore.create({
      data: {
        userId: landlord.id,
        score: 82,
        activityScore: 18,
        verificationScore: 25,
        ratingScore: 12,
        metadata: {
          listingId: listing.id,
          imagesScore: 18,
          descriptionScore: 12,
          verifiedOwnerScore: 25,
          priceFairnessScore: 15,
          reviewsScore: 12,
        },
      },
    })

    await prisma.review.createMany({
      data: [
        {
          listingId: listing.id,
          userId: tenant.id,
          rating: 5,
          comment: 'Great property, very responsive landlord. Highly recommend!',
        },
        {
          listingId: listing.id,
          userId: tenant.id,
          rating: 4,
          comment: 'Good location, clean environment. Water supply could be better.',
        },
      ],
    })
  }

  console.log('Seed complete!')
  console.log('Admin: admin@lodgist.ng / Admin2026!')
  console.log('Landlord: emeka@lodgist.ng / Landlord2026!')
  console.log('Tenant: chioma@lodgist.ng / Tenant2026!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
