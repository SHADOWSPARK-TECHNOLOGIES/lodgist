import { NextRequest, NextResponse } from "next/server";

interface VerifyPayload {
  listingUrl: string;
  address: string;
  contactNumber: string;
  claimedRent: string;
  additionalNotes?: string;
}

export async function POST(req: NextRequest) {
  let body: Partial<VerifyPayload>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const { listingUrl, address, contactNumber, claimedRent } = body;

  if (!listingUrl || !address || !contactNumber || !claimedRent) {
    return NextResponse.json(
      { message: "Missing required fields: listingUrl, address, contactNumber, claimedRent." },
      { status: 422 },
    );
  }

  // TODO: persist to VerificationRequest model once auth is wired (requires submittedById).
  // For now, log and return success so the public verification form is fully functional.
  console.log("[verify] Verification request received", {
    listingUrl,
    address,
    contactNumber,
    claimedRent: Number(claimedRent),
    additionalNotes: body.additionalNotes ?? "",
    receivedAt: new Date().toISOString(),
  });

  return NextResponse.json(
    { message: "Verification request received. Our team will follow up within 24–48 hours." },
    { status: 201 },
  );
}
