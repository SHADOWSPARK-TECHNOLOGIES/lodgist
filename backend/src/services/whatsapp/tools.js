const { logWhatsApp } = require("./redact");
const { listingsReply, welcomeReply } = require("./menu");

const LISTING_PROPERTY_SELECT = {
  city: true,
  state: true,
  lga: true,
  bedrooms: true,
  bathrooms: true,
  propertyType: true,
};

function publicListing(listing) {
  return {
    id: listing.id,
    title: listing.title,
    price: listing.price,
    currency: listing.currency || "NGN",
    status: listing.status,
    riskState: listing.riskState || null,
    truthIndex: listing.truthIndex ?? null,
    category: listing.category || null,
    city: listing.property?.city ?? null,
    state: listing.property?.state ?? null,
    lga: listing.property?.lga ?? null,
    bedrooms: listing.property?.bedrooms ?? null,
  };
}

function isShareable(listing) {
  return Boolean(listing) && listing.status === "VERIFIED" && listing.isFlaggedForFraud !== true;
}

function isExampleListing(listing) {
  const cost = listing && listing.totalMoveInCost;
  return Boolean(cost && typeof cost === "object" && !Array.isArray(cost) && cost.sample === true);
}

function parsePreferredDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

async function searchListings(prisma, args) {
  const where = {
    status: "VERIFIED",
    reviewStatus: "APPROVED",
    isFlaggedForFraud: false,
  };
  const propertyWhere = {};
  if (args.state) {
    propertyWhere.state = { equals: args.state, mode: "insensitive" };
  }
  if (args.area) {
    propertyWhere.OR = [
      { city: { contains: args.area, mode: "insensitive" } },
      { lga: { contains: args.area, mode: "insensitive" } },
      { address: { contains: args.area, mode: "insensitive" } },
    ];
  }
  if (Object.keys(propertyWhere).length) where.property = { is: propertyWhere };
  if (args.query) {
    where.OR = [
      { title: { contains: args.query, mode: "insensitive" } },
      { description: { contains: args.query, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.listing.findMany({
    where,
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { property: { select: LISTING_PROPERTY_SELECT } },
  });
  const listings = (rows || [])
    .filter((listing) => isShareable(listing) && listing.reviewStatus === "APPROVED" && !isExampleListing(listing))
    .map(publicListing);
  return { ok: true, listings };
}

async function getListingDetails(prisma, args) {
  if (!args.listingId) {
    return { ok: false, code: "invalid_id", listing: null };
  }
  const listing = await prisma.listing.findUnique({
    where: { id: args.listingId },
    include: { property: { select: LISTING_PROPERTY_SELECT } },
  });
  if (!isShareable(listing)) {
    return { ok: false, code: "not_found", listing: null };
  }
  return { ok: true, listing: publicListing(listing) };
}

async function getBookingStatus(prisma, user, args) {
  if (!user) return { ok: false, code: "needs_account", bookings: [] };
  const select = {
    id: true,
    status: true,
    listingId: true,
    totalAmount: true,
    currency: true,
  };
  if (args.bookingId) {
    const booking = await prisma.booking.findFirst({
      where: { id: args.bookingId, tenantId: user.id },
      select,
    });
    if (!booking) return { ok: false, code: "not_found", bookings: [] };
    return { ok: true, bookings: [booking] };
  }
  const bookings = await prisma.booking.findMany({
    where: { tenantId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select,
  });
  return { ok: true, bookings: bookings || [] };
}

async function requestViewing(prisma, user, args) {
  const listingResult = await getListingDetails(prisma, args);
  if (!listingResult.ok) return { ok: false, code: "listing_not_found" };
  if (!user) {
    return { ok: false, code: "needs_account", listingId: listingResult.listing.id };
  }
  const preferredDate = parsePreferredDate(args.preferredDate);
  if (!preferredDate) {
    return { ok: false, code: "needs_date", listingId: listingResult.listing.id };
  }
  if (!prisma.viewingRequest || typeof prisma.viewingRequest.create !== "function") {
    return { ok: false, code: "unavailable", listingId: listingResult.listing.id };
  }
  const created = await prisma.viewingRequest.create({
    data: {
      listingId: listingResult.listing.id,
      requesterId: user.id,
      preferredDate,
      preferredTime: args.preferredTime || null,
      notes: "Requested via WhatsApp",
      status: "REQUESTED",
    },
  });
  return {
    ok: true,
    viewingRequest: {
      id: created.id,
      status: created.status,
      listingId: created.listingId,
      preferredDate: args.preferredDate,
    },
  };
}

async function talkToAgent(prisma, session) {
  if (session?.id && prisma.whatsAppSession && typeof prisma.whatsAppSession.update === "function") {
    try {
      await prisma.whatsAppSession.update({
        where: { id: session.id },
        data: { handoffRequested: true },
      });
    } catch (err) {
      logWhatsApp("error", "WhatsApp handoff update failed", err instanceof Error ? err.message : "");
    }
  }
  return { ok: true, reference: session?.id || "N/A" };
}

async function runTool(prisma, intent, args, { user, session }) {
  switch (intent) {
    case "SEARCH_LISTINGS":
      return searchListings(prisma, args);
    case "GET_LISTING_DETAILS":
      return getListingDetails(prisma, args);
    case "GET_BOOKING_STATUS":
      return getBookingStatus(prisma, user, args);
    case "REQUEST_VIEWING":
      return requestViewing(prisma, user, args);
    case "TALK_TO_AGENT":
      return talkToAgent(prisma, session);
    case "GENERAL_HELP":
      return { ok: true };
    default:
      return { ok: false, code: "unknown_intent" };
  }
}

function formatAmount(currency, amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "amount not on file";
  return `${currency || "NGN"} ${amount}`;
}

function formatListingFacts(listing) {
  const place = [listing.city, listing.state].filter(Boolean).join(", ");
  const truth = listing.truthIndex == null ? "not scored" : String(listing.truthIndex);
  return [
    listing.title,
    formatAmount(listing.currency, listing.price),
    place,
    `Status: ${listing.status}. Risk: ${listing.riskState || "not scored"}. Truth index: ${truth}.`,
    `Listing ${listing.id}`,
  ].filter((line) => line && String(line).trim()).join("\n");
}

function renderReply(intent, toolResult, sessionId) {
  if (intent === "SEARCH_LISTINGS") {
    const listings = toolResult?.listings || [];
    if (!listings.length) return listingsReply();
    return (
      `${listings.map(formatListingFacts).join("\n\n")}\n\n` +
      "Those prices and statuses are from Lodgist records."
    );
  }
  if (intent === "GET_LISTING_DETAILS") {
    if (!toolResult?.ok || !toolResult.listing) {
      return "That listing is not a verified Lodgist home. I can only share homes that are on file and checked. Reply with an area, or say Talk to Agent.";
    }
    return formatListingFacts(toolResult.listing);
  }
  if (intent === "GET_BOOKING_STATUS") {
    if (toolResult?.code === "needs_account") {
      return "I can't see bookings for this WhatsApp number yet. Use the phone number on your Lodgist account, or say Talk to Agent.";
    }
    if (!toolResult?.bookings?.length) {
      return "No booking with that reference is on file for this account.";
    }
    return toolResult.bookings
      .map((booking) =>
        `Booking ${booking.id}: ${booking.status}. ${formatAmount(booking.currency, booking.totalAmount)}. Listing ${booking.listingId}.`
      )
      .join("\n");
  }
  if (intent === "REQUEST_VIEWING") {
    if (toolResult?.code === "listing_not_found") {
      return "I can't request a viewing for a listing that is not a verified Lodgist home.";
    }
    if (toolResult?.code === "needs_account") {
      return `Listing ${toolResult.listingId} is on file. Viewings are tied to a Lodgist account, and this WhatsApp number is not linked yet. Say Talk to Agent and we will help.`;
    }
    if (toolResult?.code === "needs_date") {
      return `Listing ${toolResult.listingId} is on file. Reply with the day you want to view it, as YYYY-MM-DD.`;
    }
    if (!toolResult?.ok || !toolResult.viewingRequest) {
      return "I could not save a viewing request. Say Talk to Agent and a person will take it from here.";
    }
    const viewing = toolResult.viewingRequest;
    return `Viewing request ${viewing.id} is ${viewing.status} for listing ${viewing.listingId} on ${viewing.preferredDate}.`;
  }
  if (intent === "TALK_TO_AGENT") {
    return (
      "A Lodgist agent will follow up. Your reference is " +
      (toolResult?.reference || sessionId || "N/A") +
      ". Do not share passwords, card numbers, or OTPs."
    );
  }
  return welcomeReply();
}

module.exports = {
  runTool,
  renderReply,
  searchListings,
  getListingDetails,
  getBookingStatus,
  requestViewing,
  isShareable,
  parsePreferredDate,
};
