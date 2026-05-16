import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// ─── GET /api/admin/stats — Aggregate platform statistics ───────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  // Only STUDIO_ADMIN can access this endpoint
  const user = await prisma.user.findUnique({
    where: { id: parseInt(session.user.id) },
  });

  if (!user || user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ message: "Forbidden. Admin access required." }, { status: 403 });
  }

  try {
    // Run all queries in parallel for efficiency
    const [
      totalListings,
      flaggedListings,
      pendingVerifications,
      totalBookings,
      totalUsers,
      listingsPerState,
      recentBookings,
    ] = await Promise.all([
      // Total listings
      prisma.listing.count(),

      // Flagged listings
      prisma.listing.count({
        where: { isFlaggedForFraud: true },
      }),

      // Pending verifications (listings with no verified status)
      prisma.listing.count({
        where: {
          status: "PENDING",
        },
      }),

      // Total bookings
      prisma.booking.count(),

      // Total users
      prisma.user.count(),

      // Listings per state (group by property.state)
      prisma.property.groupBy({
        by: ["state"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),

      // Recent 10 bookings with relations
      prisma.booking.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          listing: {
            select: {
              id: true,
              price: true,
              property: {
                select: { address: true, city: true, state: true },
              },
            },
          },
          tenant: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      totalListings,
      flaggedListings,
      pendingVerifications,
      totalBookings,
      totalUsers,
      listingsPerState: listingsPerState.map((entry) => ({
        state: entry.state,
        count: entry._count.id,
      })),
      recentBookings,
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { message: "Failed to fetch admin statistics." },
      { status: 500 }
    );
  }
}
