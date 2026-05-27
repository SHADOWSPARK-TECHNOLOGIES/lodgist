import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const adminId = parseInt(String(session.user.id), 10);
  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { role: true },
  });
  if (!admin || admin.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 20;
  const skip = (page - 1) * limit;

  const where = status === "ALL"
    ? {}
    : { status: status as "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO" };

  const [total, requests] = await Promise.all([
    prisma.verificationRequest.count({ where }),
    prisma.verificationRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        documentUrls: true,
        notes: true,
        createdAt: true,
        listing: {
          select: {
            id: true,
            title: true,
            riskState: true,
            truthIndex: true,
          },
        },
        submittedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
  ]);

  return NextResponse.json({ requests, total, page, pages: Math.ceil(total / limit) });
}
