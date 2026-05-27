import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

type ReviewAction = "APPROVE" | "REJECT" | "NEEDS_MORE_INFO" | "IN_REVIEW";

const ACTION_STATUS: Record<ReviewAction, "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO" | "IN_REVIEW"> = {
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  NEEDS_MORE_INFO: "NEEDS_MORE_INFO",
  IN_REVIEW: "IN_REVIEW",
};

// riskState transition after a review decision
const RISK_AFTER_ACTION: Record<ReviewAction, "VERIFIED" | "UNVERIFIED" | "UNDER_REVIEW" | null> = {
  APPROVE: "VERIFIED",
  REJECT: "UNVERIFIED",
  NEEDS_MORE_INFO: "UNDER_REVIEW",
  IN_REVIEW: "UNDER_REVIEW",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const adminId = parseInt(String(session.user.id), 10);
  const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { role: true } });
  if (!admin || admin.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const request = await prisma.verificationRequest.findUnique({
    where: { id },
    include: {
      listing: {
        select: {
          id: true, title: true, riskState: true, truthIndex: true,
          trustComponents: { select: { componentKey: true, label: true, weight: true, passed: true } },
        },
      },
      submittedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  });

  if (!request) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  return NextResponse.json(request);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const adminId = parseInt(String(session.user.id), 10);
  const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { role: true } });
  if (!admin || admin.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action: ReviewAction = body.action;
  const reviewNote: string | undefined = typeof body.reviewNote === "string"
    ? body.reviewNote.slice(0, 1000)
    : undefined;

  if (!ACTION_STATUS[action]) {
    return NextResponse.json(
      { message: "Invalid action. Use APPROVE, REJECT, NEEDS_MORE_INFO, or IN_REVIEW." },
      { status: 400 },
    );
  }

  const existing = await prisma.verificationRequest.findUnique({
    where: { id },
    select: { id: true, listingId: true, status: true },
  });
  if (!existing) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  const newStatus = ACTION_STATUS[action];
  const newRiskState = RISK_AFTER_ACTION[action];
  const isTerminal = action === "APPROVE" || action === "REJECT";

  const [updated] = await prisma.$transaction([
    prisma.verificationRequest.update({
      where: { id },
      data: {
        status: newStatus,
        reviewNote: reviewNote ?? null,
        reviewedById: adminId,
        reviewedAt: isTerminal ? new Date() : null,
      },
      select: { id: true, status: true, reviewNote: true, reviewedAt: true },
    }),
    prisma.listing.update({
      where: { id: existing.listingId },
      data: {
        riskState: newRiskState ?? undefined,
        // On approval, set a baseline truthIndex boost if not already high
        ...(action === "APPROVE" ? { truthIndex: { increment: 0 } } : {}),
      },
    }),
  ]);

  console.info(`[admin/verify] ${action} on request ${id} by admin ${adminId}`);

  return NextResponse.json({ success: true, request: updated });
}
