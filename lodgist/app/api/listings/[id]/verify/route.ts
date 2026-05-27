import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/jpg"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  const listingId = parseInt(id, 10);
  if (isNaN(listingId)) {
    return NextResponse.json({ message: "Invalid listing ID." }, { status: 400 });
  }

  const submittedById = parseInt(String(session.user.id), 10);

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, title: true, riskState: true },
  });
  if (!listing) {
    return NextResponse.json({ message: "Listing not found." }, { status: 404 });
  }

  // Duplicate open request check
  const existing = await prisma.verificationRequest.findFirst({
    where: {
      listingId,
      status: { in: ["PENDING", "IN_REVIEW"] },
    },
    select: { id: true, status: true },
  });
  if (existing) {
    return NextResponse.json(
      { message: "A verification request is already in progress for this listing." },
      { status: 409 },
    );
  }

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ message: "Invalid form data." }, { status: 400 });
  }

  const notes = (formData.get("notes") as string | null) ?? null;

  // Collect files from all file fields
  const fileFields = ["titleDoc", "ownerId", "additional1", "additional2", "additional3"];
  const files: File[] = [];
  for (const field of fileFields) {
    const entry = formData.get(field);
    if (entry instanceof File && entry.size > 0) {
      files.push(entry);
    }
  }

  if (files.length === 0) {
    return NextResponse.json({ message: "At least one title document is required." }, { status: 400 });
  }

  // Validate files
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { message: `File "${file.name}": only PDF, JPG, and PNG files are accepted.` },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { message: `File "${file.name}" exceeds the 5 MB limit.` },
        { status: 400 },
      );
    }
  }

  // Upload to Vercel Blob (skip gracefully if token not configured)
  const documentUrls: string[] = [];
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (blobToken) {
    try {
      for (const file of files) {
        const blob = await put(
          `verifications/${listingId}/${Date.now()}-${file.name}`,
          file,
          { access: "public", token: blobToken },
        );
        documentUrls.push(blob.url);
      }
    } catch (err) {
      console.error("[verify] Blob upload failed:", err);
      return NextResponse.json({ message: "Document upload failed. Please try again." }, { status: 500 });
    }
  } else {
    // No blob token — log and continue without URLs (admin reviews manually)
    console.warn("[verify] BLOB_READ_WRITE_TOKEN not set — skipping file upload. Listing:", listingId);
  }

  // Create VerificationRequest + update listing riskState atomically
  const [request] = await prisma.$transaction([
    prisma.verificationRequest.create({
      data: {
        listingId,
        submittedById,
        status: "PENDING",
        documentUrls,
        notes: notes?.slice(0, 500) || null,
      },
      select: { id: true, status: true },
    }),
    prisma.listing.update({
      where: { id: listingId },
      data: { riskState: "UNDER_REVIEW" },
    }),
  ]);

  console.info(`[verify] New request ${request.id} for listing ${listingId} by user ${submittedById}`);

  return NextResponse.json(
    { success: true, requestId: request.id, status: "PENDING" },
    { status: 201 },
  );
}
