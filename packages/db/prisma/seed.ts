import 'dotenv/config'
import { PrismaClient, Role, ListingCategory, ListingStatus, BookingStatus, Currency, EscrowStatus, NotificationType } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { hash } from 'bcryptjs'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding Lodgist database...')

  // ── Clean existing data in dependency order ───────────────────────────────
  await prisma.whatsAppMessage.deleteMany()
  await prisma.whatsAppSession.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.fraudReport.deleteMany()
  await prisma.aIFraudSignal.deleteMany()
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

  console.log('   Cleaned existing data.')

  // ── Create Users ──────────────────────────────────────────────────────────

  const adminPass = await hash('Admin2026!', 12)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@lodgist.ng',
      name: 'Lodgist Admin',
      passwordHash: adminPass,
      role: Role.STUDIO_ADMIN,
      phone: '+2348000000001',
      isVerified: true,
      isHNW: false,
    },
  })
  console.log(`   ✓ Admin: ${admin.email}`)

  const landlordPass = await hash('Landlord2026!', 12)
  const landlord1 = await prisma.user.create({
    data: {
      email: 'emeka@lodgist.ng',
      name: 'Emeka Okafor',
      passwordHash: landlordPass,
      role: Role.LANDLORD,
      phone: '+2348012345678',
      isVerified: true,
      isHNW: true,
      hnwVerifiedAt: new Date('2026-01-15'),
    },
  })
  console.log(`   ✓ Landlord: ${landlord1.email}`)

  const landlord2 = await prisma.user.create({
    data: {
      email: 'fatima@lodgist.ng',
      name: 'Fatima Abdullahi',
      passwordHash: landlordPass,
      role: Role.LANDLORD,
      phone: '+2348023456789',
      isVerified: true,
      isHNW: false,
    },
  })
  console.log(`   ✓ Landlord: ${landlord2.email}`)

  const tenantPass = await hash('Tenant2026!', 12)
  const tenant1 = await prisma.user.create({
    data: {
      email: 'chioma@lodgist.ng',
      name: 'Chioma Eze',
      passwordHash: tenantPass,
      role: Role.USER,
      phone: '+2348098765432',
      isVerified: true,
    },
  })
  console.log(`   ✓ Tenant: ${tenant1.email}`)

  const tenant2 = await prisma.user.create({
    data: {
      email: 'amina@lodgist.ng',
      name: 'Amina Yusuf',
      passwordHash: tenantPass,
      role: Role.USER,
      phone: '+2348076543210',
      isVerified: true,
    },
  })
  console.log(`   ✓ Tenant: ${tenant2.email}`)

  // ── Create Properties & Listings (12+ across Nigeria) ─────────────────────

  interface PropertySeed {
    address: string
    city: string
    state: string
    lga: string
    propertyType: string
    bedrooms: number
    bathrooms: number
    size: number
    landlordId: number
  }

  const properties: PropertySeed[] = [
    // Lagos (4 properties)
    { address: '12 Admiralty Way, Lekki Phase 1', city: 'Lekki', state: 'Lagos', lga: 'Eti-Osa', propertyType: 'Apartment', bedrooms: 3, bathrooms: 2, size: 120, landlordId: landlord1.id },
    { address: 'Plot 7, Bishop Oluwole Street', city: 'Victoria Island', state: 'Lagos', lga: 'Eti-Osa', propertyType: 'Apartment', bedrooms: 2, bathrooms: 1, size: 85, landlordId: landlord1.id },
    { address: '22 Bourdillon Road, Ikoyi', city: 'Ikoyi', state: 'Lagos', lga: 'Eti-Osa', propertyType: 'Duplex', bedrooms: 5, bathrooms: 4, size: 350, landlordId: landlord2.id },
    { address: '15 Opebi Road, Ikeja', city: 'Ikeja', state: 'Lagos', lga: 'Ikeja', propertyType: 'Apartment', bedrooms: 2, bathrooms: 2, size: 100, landlordId: landlord2.id },
    // FCT / Abuja (2 properties)
    { address: '45 Aminu Kano Crescent, Wuse 2', city: 'Wuse', state: 'FCT', lga: 'Abuja Municipal', propertyType: 'Apartment', bedrooms: 4, bathrooms: 3, size: 200, landlordId: landlord1.id },
    { address: '10 Ganges Street, Maitama', city: 'Maitama', state: 'FCT', lga: 'Abuja Municipal', propertyType: 'Duplex', bedrooms: 4, bathrooms: 3, size: 280, landlordId: landlord2.id },
    // Rivers (1 property)
    { address: '8 Woji Road, GRA Phase 2', city: 'Port Harcourt', state: 'Rivers', lga: 'Obio-Akpor', propertyType: 'Apartment', bedrooms: 3, bathrooms: 2, size: 140, landlordId: landlord1.id },
    // Imo (1 property)
    { address: '30 Ikenegbu Layout', city: 'Owerri', state: 'Imo', lga: 'Owerri Municipal', propertyType: 'Apartment', bedrooms: 3, bathrooms: 2, size: 110, landlordId: landlord1.id },
    // Enugu (1 property)
    { address: '7 Garden Avenue, GRA', city: 'Enugu', state: 'Enugu', lga: 'Enugu East', propertyType: 'Apartment', bedrooms: 3, bathrooms: 2, size: 130, landlordId: landlord2.id },
    // Edo (1 property)
    { address: '25 Airport Road', city: 'Benin City', state: 'Edo', lga: 'Egor', propertyType: 'Apartment', bedrooms: 2, bathrooms: 1, size: 90, landlordId: landlord1.id },
    // Oyo (1 property)
    { address: '42 Awolowo Avenue, Bodija', city: 'Ibadan', state: 'Oyo', lga: 'Ibadan North', propertyType: 'House', bedrooms: 4, bathrooms: 3, size: 200, landlordId: landlord2.id },
    // Delta (1 property)
    { address: '19 Ekpan Road, Uvwie', city: 'Warri', state: 'Delta', lga: 'Uvwie', propertyType: 'Apartment', bedrooms: 2, bathrooms: 1, size: 85, landlordId: landlord1.id },
    // Kaduna (1 property)
    { address: '3 Ali Akilu Road', city: 'Kaduna', state: 'Kaduna', lga: 'Kaduna North', propertyType: 'House', bedrooms: 3, bathrooms: 2, size: 150, landlordId: landlord2.id },
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface ListingSeed {
    title: string
    description: string
    price: number
    furnished: boolean
    serviceCharge: number
    totalMoveInCost: any
    status: ListingStatus
    isFeatured: boolean
  }

  const listingData: Record<string, ListingSeed> = {
    Lekki: {
      title: '3-Bedroom Apartment with Ocean View — Lekki Phase 1',
      description: 'Premium 3-bedroom apartment in the heart of Lekki Phase 1. Features include en-suite master bedroom, spacious living room with modern kitchen, 24/7 electricity with inverter backup, dedicated parking space, and 24-hour security. Walking distance to Palms Mall and Filmhouse Cinemas. Ideal for young professionals and small families.',
      price: 1_800_000, furnished: true, serviceCharge: 120_000,
      totalMoveInCost: { base_rent: 1800000, agency_fee: 180000, legal_fee: 25000, caution_fee: 90000, inspection_fee: 10000, currency: 'NGN', total: 2105000 },
      status: ListingStatus.VERIFIED, isFeatured: true,
    },
    'Victoria Island': {
      title: '2-Bedroom Flat — Bishop Oluwole, VI',
      description: 'Modern 2-bedroom flat in the prestigious Victoria Island. Open-plan living/dining area, fitted kitchen with built-in cabinets, air conditioning in all rooms, and a balcony overlooking the city. Close to Eko Hotel, Kuramo Beach, and the financial district. Perfect for expats and business professionals.',
      price: 2_400_000, furnished: true, serviceCharge: 150_000,
      totalMoveInCost: { base_rent: 2400000, agency_fee: 240000, legal_fee: 25000, caution_fee: 120000, inspection_fee: 15000, currency: 'NGN', total: 2800000 },
      status: ListingStatus.VERIFIED, isFeatured: true,
    },
    Ikoyi: {
      title: '5-Bedroom Luxury Duplex — Bourdillon Road, Ikoyi',
      description: 'Exquisite 5-bedroom luxury duplex on the prestigious Bourdillon Road, Ikoyi. Features a grand entrance foyer, state-of-the-art gourmet kitchen, private swimming pool, rooftop terrace with panoramic Lagos skyline views, smart home automation, staff quarters, and a 3-car garage. HNWI preferred.',
      price: 8_500_000, furnished: true, serviceCharge: 500_000,
      totalMoveInCost: { base_rent: 8500000, agency_fee: 850000, legal_fee: 50000, caution_fee: 425000, currency: 'NGN', total: 9825000 },
      status: ListingStatus.VERIFIED, isFeatured: true,
    },
    Ikeja: {
      title: '2-Bedroom Flat — Opebi Road, Ikeja',
      description: 'Well-maintained 2-bedroom flat along Opebi Road, Ikeja. With a combined living and dining area, air-conditioned bedrooms, and a functional kitchen. Walking distance to Shoprite, Allen Junction, and the Lagos State Secretariat. Good access to public transportation. Ideal for singles and couples.',
      price: 900_000, furnished: false, serviceCharge: 60_000,
      totalMoveInCost: { base_rent: 900000, agency_fee: 90000, legal_fee: 15000, caution_fee: 45000, inspection_fee: 5000, currency: 'NGN', total: 1055000 },
      status: ListingStatus.VERIFIED, isFeatured: false,
    },
    Wuse: {
      title: '4-Bedroom Apartment — Aminu Kano Crescent, Wuse 2',
      description: 'Spacious 4-bedroom apartment in the diplomatic district of Wuse 2, Abuja. Features include a large living room, modern kitchen with granite countertops, en-suite master bedroom, fitted wardrobes, 24-hour electricity with generator backup, and covered parking. Close to the US Embassy, World Bank, and Wuse Market.',
      price: 3_200_000, furnished: true, serviceCharge: 180_000,
      totalMoveInCost: { base_rent: 3200000, agency_fee: 320000, legal_fee: 25000, caution_fee: 160000, inspection_fee: 10000, currency: 'NGN', total: 3715000 },
      status: ListingStatus.VERIFIED, isFeatured: true,
    },
    Maitama: {
      title: '4-Bedroom Executive Duplex — Ganges Street, Maitama',
      description: 'Executive 4-bedroom duplex in the prestigious Maitama district. Features include a marble-floored living room, modern kitchen with island, en-suite bedrooms, study/office room, a well-maintained garden, and a swimming pool. Located near the Transcorp Hilton, International Conference Centre, and major diplomatic missions.',
      price: 5_500_000, furnished: true, serviceCharge: 350_000,
      totalMoveInCost: { base_rent: 5500000, agency_fee: 550000, legal_fee: 35000, caution_fee: 275000, currency: 'NGN', total: 6360000 },
      status: ListingStatus.VERIFIED, isFeatured: true,
    },
    'Port Harcourt': {
      title: '3-Bedroom Flat — GRA Phase 2, Port Harcourt',
      description: 'Modern 3-bedroom flat in the pristine GRA Phase 2, Port Harcourt. Open-plan living, en-suite master bedroom, air conditioning throughout, dedicated parking, and 24/7 security. Close to shopping malls, restaurants, and the golf course. The oil & gas capital\'s finest residential address.',
      price: 2_100_000, furnished: true, serviceCharge: 130_000,
      totalMoveInCost: { base_rent: 2100000, agency_fee: 210000, legal_fee: 20000, caution_fee: 105000, inspection_fee: 10000, currency: 'NGN', total: 2445000 },
      status: ListingStatus.VERIFIED, isFeatured: false,
    },
    Owerri: {
      title: '3-Bedroom Flat — Ikenegbu Layout, Owerri',
      description: 'Neat 3-bedroom flat in the serene Ikenegbu Layout, Owerri. Features include a spacious parlour, dining area, well-ventilated bedrooms with built-in wardrobes, functional kitchen, and a boys\' quarters. Calm environment with good road network. Close to Federal Medical Centre, Concorde Hotel, and Owerri main market.',
      price: 500_000, furnished: false, serviceCharge: 30_000,
      totalMoveInCost: { base_rent: 500000, agency_fee: 50000, legal_fee: 10000, caution_fee: 25000, inspection_fee: 5000, currency: 'NGN', total: 590000 },
      status: ListingStatus.VERIFIED, isFeatured: false,
    },
    Enugu: {
      title: '3-Bedroom Flat — Garden Avenue, GRA, Enugu',
      description: 'Beautifully finished 3-bedroom apartment on Garden Avenue, Enugu\'s most prestigious address. Large living room, dining area, modern kitchen, en-suite master bedroom, and a balcony with relaxing views. Landscaped compound, 24-hour electricity, ample parking. Walking distance to Enugu State Government House and shops.',
      price: 1_500_000, furnished: true, serviceCharge: 100_000,
      totalMoveInCost: { base_rent: 1500000, agency_fee: 150000, legal_fee: 15000, caution_fee: 75000, inspection_fee: 8000, currency: 'NGN', total: 1748000 },
      status: ListingStatus.VERIFIED, isFeatured: false,
    },
    'Benin City': {
      title: '2-Bedroom Flat — Airport Road, Benin City',
      description: 'Clean and well-maintained 2-bedroom flat along Airport Road, Benin City. Combined living and dining room, fitted kitchen with cabinets, bathroom with overhead shower, and a visitor\'s toilet. Good road network, close to the airport, university, and major banks. Affordable living in Edo\'s capital.',
      price: 350_000, furnished: false, serviceCharge: 20_000,
      totalMoveInCost: { base_rent: 350000, agency_fee: 35000, legal_fee: 10000, caution_fee: 17500, inspection_fee: 5000, currency: 'NGN', total: 417500 },
      status: ListingStatus.PENDING, isFeatured: false,
    },
    Ibadan: {
      title: '4-Bedroom Detached House — Awolowo Avenue, Bodija',
      description: 'Spacious 4-bedroom detached house on Awolowo Avenue, one of Ibadan\'s most desirable streets. Large compound with garden, car port for 3 vehicles, generator house with 15KVA plant, borehole with overhead tank, BQ with toilet. Both classic and modern — ideal for a growing family. Close to University of Ibadan and Bodija Market.',
      price: 1_200_000, furnished: false, serviceCharge: 80_000,
      totalMoveInCost: { base_rent: 1200000, agency_fee: 120000, legal_fee: 15000, caution_fee: 60000, inspection_fee: 5000, currency: 'NGN', total: 1400000 },
      status: ListingStatus.VERIFIED, isFeatured: false,
    },
    Warri: {
      title: '2-Bedroom Flat — Ekpan Road, Warri',
      description: 'Self-contained 2-bedroom flat on Ekpan Road, Warri. Sitting room with adjoining dining area, two well-sized bedrooms with wardrobes, functional kitchen, and a bathroom. Secure compound, stand-by generator, and borehole water. Close to NNPC depot, shopping plazas, and the refinery. Ideal for oil sector workers.',
      price: 400_000, furnished: false, serviceCharge: 25_000,
      totalMoveInCost: { base_rent: 400000, agency_fee: 40000, legal_fee: 10000, caution_fee: 20000, inspection_fee: 5000, currency: 'NGN', total: 475000 },
      status: ListingStatus.VERIFIED, isFeatured: false,
    },
    Kaduna: {
      title: '3-Bedroom House — Ali Akilu Road, Kaduna',
      description: 'Well-built 3-bedroom house on Ali Akilu Road, Kaduna North. Spacious living and dining room, modern kitchen, en-suite master bedroom, and large windows that let in plenty of natural light. Generous compound with garden space. Located near the Kaduna State Government House, shopping centres, and good schools.',
      price: 650_000, furnished: false, serviceCharge: 40_000,
      totalMoveInCost: { base_rent: 650000, agency_fee: 65000, legal_fee: 12000, caution_fee: 32500, inspection_fee: 5000, currency: 'NGN', total: 764500 },
      status: ListingStatus.VERIFIED, isFeatured: false,
    },
  }

  const createdListings: Array<{ id: number; city: string; ownerId: number }> = []

  for (const prop of properties) {
    const property = await prisma.property.create({
      data: {
        address: prop.address,
        city: prop.city,
        state: prop.state,
        lga: prop.lga,
        propertyType: prop.propertyType,
        bedrooms: prop.bedrooms,
        bathrooms: prop.bathrooms,
        size: prop.size,
        ownerId: prop.landlordId,
      },
    })

    const data = listingData[prop.city]
    if (!data) {
      console.warn(`   ⚠ No listing data for ${prop.city}, skipping listing creation`)
      continue
    }

    const listing = await prisma.listing.create({
      data: {
        title: data.title,
        description: data.description,
        price: data.price,
        currency: Currency.NGN,
        category: ListingCategory.RESIDENTIAL,
        status: data.status,
        isFeatured: data.isFeatured,
        furnished: data.furnished,
        serviceCharge: data.serviceCharge,
        propertyId: property.id,
        ownerId: prop.landlordId,
        totalMoveInCost: data.totalMoveInCost,
        views: Math.floor(Math.random() * 500) + 50,
      },
    })

    createdListings.push({ id: listing.id, city: prop.city, ownerId: prop.landlordId })
    console.log(`   ✓ Listing: ${data.title} (₦${data.price.toLocaleString()})`)
  }

  console.log(`   ✓ Created ${createdListings.length} listings`)

  // ── Create Listing Images ─────────────────────────────────────────────────
  const placeholderImages = [
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688',
    'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858',
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb',
    'https://images.unsplash.com/photo-1560185007-cde436f6a4d0',
    'https://images.unsplash.com/photo-1484101403633-562f891dc89a',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750',
    'https://images.unsplash.com/photo-1560448075-bb485b0673f5',
    'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e',
    'https://images.unsplash.com/photo-1560185127-6ed189bf02f4',
  ]

  for (const listing of createdListings) {
    const imgCount = Math.floor(Math.random() * 3) + 2 // 2-4 images per listing
    for (let i = 0; i < imgCount; i++) {
      const idx = (listing.id * 7 + i * 11) % placeholderImages.length
      await prisma.listingImage.create({
        data: {
          listingId: listing.id,
          url: `${placeholderImages[idx]}?w=800&q=80`,
          altText: `${listing.city} property image ${i + 1}`,
          isPrimary: i === 0,
          order: i,
        },
      })
    }
  }
  console.log('   ✓ Created listing images')

  // ── Create Reviews ────────────────────────────────────────────────────────
  const reviewTemplates = [
    { rating: 5, comment: 'Excellent property! The landlord was very responsive and the apartment was exactly as described. Highly recommend for anyone looking in this area.' },
    { rating: 4, comment: 'Very good experience overall. The location is convenient and the property is well-maintained. Would give 5 stars but the water pressure could be better.' },
    { rating: 5, comment: 'Absolutely love this place! Secure compound, great neighborhood, and all amenities work perfectly. Best decision I made moving here.' },
    { rating: 3, comment: 'Decent property for the price. The description was accurate but some appliances need maintenance. Landlord was responsive to complaints though.' },
    { rating: 4, comment: 'Good value for money. The apartment is spacious and well-lit. The neighborhood is quiet and secure. Minor issues with power but the estate generator helps.' },
    { rating: 5, comment: 'Top-notch property! Modern finishes, great security, and the location is perfect — close to everything I need. Definitely worth every naira.' },
    { rating: 4, comment: 'Nice apartment in a developing area. The compound is clean and well-managed. Access road could be better but otherwise a great find.' },
    { rating: 2, comment: 'Mixed experience. The property itself is okay but the moving-in process was frustrating with delays. Would have appreciated better communication from the agent.' },
  ]

  for (const listing of createdListings) {
    // Tenant 1 reviews
    const r1 = reviewTemplates[listing.id % reviewTemplates.length]
    const r2 = reviewTemplates[(listing.id * 3 + 5) % reviewTemplates.length]

    await prisma.review.create({
      data: {
        listingId: listing.id,
        userId: tenant1.id,
        rating: r1.rating,
        comment: r1.comment,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000),
      },
    })
    await prisma.review.create({
      data: {
        listingId: listing.id,
        userId: tenant2.id,
        rating: r2.rating,
        comment: r2.comment,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 14) * 86400000),
      },
    })
  }
  console.log(`   ✓ Created ${createdListings.length * 2} reviews`)

  // ── Create Bookings (variety of statuses) ─────────────────────────────────
  const bookingData = [
    { listingIdx: 0, tenantId: tenant1.id, start: '2026-06-01', end: '2027-05-31', status: BookingStatus.PENDING, amount: 1800000 },
    { listingIdx: 4, tenantId: tenant2.id, start: '2026-07-01', end: '2027-06-30', status: BookingStatus.CONFIRMED, amount: 3200000 },
    { listingIdx: 2, tenantId: tenant1.id, start: '2026-05-01', end: '2027-04-30', status: BookingStatus.CANCELLED, amount: 8500000 },
    { listingIdx: 6, tenantId: tenant2.id, start: '2026-08-01', end: '2027-07-31', status: BookingStatus.COMPLETED, amount: 2100000 },
    { listingIdx: 1, tenantId: tenant1.id, start: '2026-09-01', end: '2027-08-31', status: BookingStatus.CONFIRMED, amount: 2400000 },
  ]

  for (const b of bookingData) {
    const listing = createdListings[b.listingIdx]
    await prisma.booking.create({
      data: {
        listingId: listing.id,
        tenantId: b.tenantId,
        startDate: new Date(b.start),
        endDate: new Date(b.end),
        status: b.status,
        totalAmount: b.amount,
        currency: Currency.NGN,
        notes: b.status === BookingStatus.CANCELLED ? 'Tenant found alternative accommodation' : undefined,
      },
    })
  }
  console.log(`   ✓ Created ${bookingData.length} bookings`)

  // ── Create Truth Index Scores ─────────────────────────────────────────────
  for (const listing of createdListings) {
    const listingOwnerId = listing.ownerId
    const ownerIsLandlord1 = listingOwnerId === landlord1.id

    const score = {
      score: ownerIsLandlord1 ? 82 : 76,
      activityScore: ownerIsLandlord1 ? 18 : 15,
      verificationScore: ownerIsLandlord1 ? 25 : 22,
      ratingScore: ownerIsLandlord1 ? 12 : 11,
      metadata: {
        listingId: listing.id,
        imagesScore: ownerIsLandlord1 ? 18 : 16,
        descriptionScore: ownerIsLandlord1 ? 12 : 10,
        verifiedOwnerScore: ownerIsLandlord1 ? 25 : 20,
        priceFairnessScore: ownerIsLandlord1 ? 15 : 13,
        reviewsScore: ownerIsLandlord1 ? 12 : 10,
      },
    }

    await prisma.truthIndexScore.create({
      data: {
        userId: tenant1.id, // truth index is on the tenant/scorer
        score: score.score,
        activityScore: score.activityScore,
        verificationScore: score.verificationScore,
        ratingScore: score.ratingScore,
        metadata: score.metadata,
      },
    })
  }
  console.log('   ✓ Created truth index scores')

  // ── Create an Escrow Transaction ───────────────────────────────────────────
  const escrowListing = createdListings[4] // Wuse listing
  const escrow = await prisma.escrowTransaction.create({
    data: {
      reference: `ESC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      tenantId: tenant2.id,
      landlordId: escrowListing.ownerId,
      listingId: escrowListing.id,
      amount: 3200000,
      currency: Currency.NGN,
      status: EscrowStatus.HELD,
      description: 'Security deposit for Wuse 2 4-bedroom apartment',
      paystackReference: 'PS_ref_simulated_test',
      releaseDate: new Date('2026-07-31'),
    },
  })
  console.log(`   ✓ Escrow: ${escrow.reference}`)

  // ── Create WhatsApp Sessions & Messages ───────────────────────────────────
  const chatListing = createdListings[0] // Lekki listing
  const session = await prisma.whatsAppSession.create({
    data: {
      userId: tenant1.id,
      contactId: landlord1.id,
      listingId: chatListing.id,
      isActive: true,
      messages: {
        create: [
          {
            senderId: tenant1.id,
            content: 'Hello, is the Lekki 3-bedroom still available?',
            messageType: 'TEXT',
            sentAt: new Date(Date.now() - 86400000 * 2),
            deliveredAt: new Date(Date.now() - 86400000 * 2 + 60000),
          },
          {
            senderId: landlord1.id,
            content: 'Yes, it is! When would you like to schedule a viewing?',
            messageType: 'TEXT',
            sentAt: new Date(Date.now() - 86400000 * 2 + 300000),
            deliveredAt: new Date(Date.now() - 86400000 * 2 + 360000),
            readAt: new Date(Date.now() - 86400000 * 2 + 600000),
          },
          {
            senderId: tenant1.id,
            content: 'This weekend works for me. Saturday morning?',
            messageType: 'TEXT',
            sentAt: new Date(Date.now() - 86400000),
            deliveredAt: new Date(Date.now() - 86400000 + 45000),
          },
          {
            senderId: landlord1.id,
            content: 'Saturday at 10 AM works perfectly. See you at 12 Admiralty Way!',
            messageType: 'TEXT',
            sentAt: new Date(Date.now() - 86400000 + 60000),
            deliveredAt: new Date(Date.now() - 86400000 + 120000),
            readAt: new Date(Date.now() - 86400000 + 180000),
          },
        ],
      },
    },
  })
  console.log(`   ✓ WhatsApp session created with 4 messages`)

  // ── Create Notifications ───────────────────────────────────────────────────
  const notifications = [
    { userId: tenant1.id, type: NotificationType.BOOKING_CONFIRMATION, title: 'Booking Confirmed', body: 'Your booking for the Lekki 3-bedroom apartment has been confirmed.' },
    { userId: tenant1.id, type: NotificationType.VIEWING_REMINDER, title: 'Viewing Tomorrow', body: 'Reminder: You have a property viewing scheduled for 10 AM at 12 Admiralty Way, Lekki.' },
    { userId: tenant2.id, type: NotificationType.PAYMENT_RECEIPT, title: 'Payment Received', body: 'Your payment of ₦3,200,000 for the Wuse apartment has been received and is held in escrow.' },
    { userId: landlord1.id, type: NotificationType.TRUTH_SCORE_UPDATE, title: 'Truth Index Updated', body: 'Your Truth Index score has been updated to 82. Great job maintaining trust!' },
    { userId: landlord2.id, type: NotificationType.ESCROW_UPDATE, title: 'New Escrow Deposit', body: 'A tenant has deposited ₦3,200,000 into escrow for your Maitama duplex listing.' },
  ]

  for (const n of notifications) {
    await prisma.notification.create({
      data: {
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        data: {},
        isRead: false,
      },
    })
  }
  console.log(`   ✓ Created ${notifications.length} notifications`)

  // ── Create a Fraud Signal (demonstration) ─────────────────────────────────
  const fraudListing = createdListings[9] // Benin City (status PENDING)
  await prisma.aIFraudSignal.create({
    data: {
      listingId: fraudListing.id,
      score: 0.35,
      reasoning: 'Price seems low for area average. Limited listing history. Manual review recommended.',
      metadata: { source: 'automated_seed', flags: ['price_anomaly', 'new_listing'] },
    },
  })
  console.log('   ✓ Created fraud signal (demonstration)')

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════')
  console.log('  ✅ Seed complete!')
  console.log('═══════════════════════════════════════════════')
  console.log('')
  console.log('  Users:')
  console.log('  ──────────────────────────────────')
  console.log('  STUDIO_ADMIN: admin@lodgist.ng / Admin2026!')
  console.log('  LANDLORD:     emeka@lodgist.ng / Landlord2026!')
  console.log('  LANDLORD:     fatima@lodgist.ng / Landlord2026!')
  console.log('  USER:         chioma@lodgist.ng / Tenant2026!')
  console.log('  USER:         amina@lodgist.ng / Tenant2026!')
  console.log('')
  console.log(`  Properties:  ${properties.length}`)
  console.log(`  Listings:    ${createdListings.length}`)
  console.log(`  Reviews:     ${createdListings.length * 2}`)
  console.log(`  Bookings:    ${bookingData.length}`)
  console.log(`  Escrows:     1`)
  console.log(`  WhatsApp:    1 session, 4 messages`)
  console.log(`  Notifications: ${notifications.length}`)
  console.log(`  Fraud Signals: 1`)
  console.log('═══════════════════════════════════════════════')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
