import { NextRequest, NextResponse } from 'next/server';
import { propertyCreateSchema } from '@/lib/validation/property';
import { auth } from '@/auth'; // NextAuth.js authentication
import { prisma } from '@/lib/prisma';
import * as z from 'zod';
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const sortBy = searchParams.get("sortBy") ?? "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const state = searchParams.get("state");
    const city = searchParams.get("city");
    const propertyType = searchParams.get("propertyType");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    if (state) {
      where.state = { contains: state, mode: "insensitive" };
    }
    if (city) {
      where.city = { contains: city, mode: "insensitive" };
    }

    // Filter by listing price range via a subquery condition
    if (minPrice || maxPrice) {
      const priceFilter: Record<string, unknown> = {};
      if (minPrice) priceFilter.gte = parseFloat(minPrice);
      if (maxPrice) priceFilter.lte = parseFloat(maxPrice);
      where.listings = {
        some: {
          status: "available",
          price: priceFilter,
        },
      };
    }

    // Build orderBy — sort by truthIndex descending by default if requested
    let orderBy: Record<string, string> | Record<string, string>[];
    if (sortBy === "truthIndex") {
      orderBy = [{ truthIndex: sortOrder }, { createdAt: "desc" }];
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    // Execute a SINGLE query with includes (fixes N+1)
    const [properties, totalCount] = await Promise.all([
      prisma.property.findMany({
        where: where as Prisma.PropertyWhereInput,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              role: { select: { name: true } },
            },
          },
          listings: {
            where: { status: "available" },
            select: {
              id: true,
              price: true,
              description: true,
              status: true,
              createdAt: true,
              _count: { select: { bookings: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.property.count({ where: where as Prisma.PropertyWhereInput }),
    ]);

    return NextResponse.json({
      data: properties,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching properties:", error);
    return NextResponse.json({ message: "Failed to fetch properties." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Protect this route with NextAuth.js
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  try {
    // Handle both JSON and FormData submissions
    let parsed: Record<string, unknown>;
    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      parsed = Object.fromEntries(formData.entries());

      // Parse amenities JSON string back to array
      if (typeof parsed.amenities === 'string') {
        try {
          parsed.amenities = JSON.parse(parsed.amenities);
        } catch {
          // Leave as string, Zod will reject it
        }
      }

      // Collect uploaded files
      const images: File[] = [];
      const allEntries = Array.from(formData.entries());
      for (const [key, value] of allEntries) {
        if (key === 'images' && value instanceof File) {
          images.push(value);
        }
      }
      if (images.length > 0) {
        parsed.images = images;
      }
    } else {
      parsed = await req.json();
    }

    const validatedData = propertyCreateSchema.parse(parsed);

    // Build Prisma create payload (exclude fields not in the Property model)
    const { images, amenities, lga, bedrooms, bathrooms, propertyType, ...prismaData } = validatedData as Record<string, unknown>;

    const property = await prisma.property.create({
      data: {
        address: prismaData.address as string,
        city: prismaData.city as string,
        state: prismaData.state as string,
        zip: (prismaData.zip as string) ?? '',
        ownerId: session.user.id,
        // Store extra metadata as a JSON string in a field if needed,
        // or extend the Property model. For now, we store minimal fields.
      },
    });
    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Validation error', errors: error.issues }, { status: 400 });
    }
    console.error('Error creating property:', error);
    return NextResponse.json({ message: 'Failed to create property.' }, { status: 500 });
  }
}
