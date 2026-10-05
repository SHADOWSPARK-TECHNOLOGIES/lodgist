/**
 * Rental Safety Check domain.
 * A paid fee is not evidence that a home, agent, or account is verified.
 * Missing evidence stays labelled. It is not treated as fraud.
 */

const crypto = require("crypto");
const { sitePath } = require("./whatsapp/menu");

const PRICE_NGN = 5000;
const PRICE_KOBO = 500000;
const PAYSTACK_PREFIX = "LODG-RSC-";
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const EVIDENCE_KEYS = [
  "propertyEvidence",
  "agentIdentity",
  "phoneInconsistencies",
  "paymentRisk",
  "priceContext",
  "neighborhood",
  "suspiciousSignals",
  "missingEvidence",
];

const EVIDENCE_LABELS = {
  propertyEvidence: "Property Evidence",
  agentIdentity: "Agent Risk Signals",
  phoneInconsistencies: "Phone-number inconsistencies",
  paymentRisk: "Payment Risk",
  priceContext: "Asking-Rent / Price Context",
  neighborhood: "Neighborhood Information",
  suspiciousSignals: "Suspicious signals",
  missingEvidence: "Missing evidence",
};

const EVIDENCE_STATES = ["checked", "unavailable", "incomplete", "unconfirmed"];

const RECOMMENDATION_LABEL = {
  LOWER_RISK: "LOWER RISK — PROCEED WITH NORMAL PRECAUTIONS",
  UNCERTAIN: "UNCERTAIN — VERIFY THESE ITEMS FIRST",
  HIGH_RISK: "HIGH RISK — DO NOT PAY YET",
};

const STATUS_LABEL = {
  SUBMITTED: "Submitted",
  AWAITING_PAYMENT: "Awaiting payment",
  PAID: "Payment confirmed",
  UNDER_REVIEW: "Under review",
  REPORT_READY: "Report ready",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const FORBIDDEN_CLAIM = /\b(guaranteed|fraud-free|100%\s*verified)\b|\bsafe\b/i;
const SECRET_PAYMENT_KEYS = new Set([
  "card",
  "cardnumber",
  "cvv",
  "cvc",
  "pin",
  "otp",
  "password",
  "bvn",
  "secret",
]);

const DRAFT_STEPS = ["listing", "location", "rent", "agentName", "agentPhone", "notes"];

function clip(value, max) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, max);
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function phonesMatch(left, right) {
  const a = digits(left);
  const b = digits(right);
  if (a.length < 10 || b.length < 10) return false;
  return a.slice(-10) === b.slice(-10);
}

function containsForbiddenClaim(value) {
  return FORBIDDEN_CLAIM.test(String(value || ""));
}

function newPublicReference() {
  const bytes = crypto.randomBytes(8);
  let body = "";
  for (let i = 0; i < 8; i += 1) body += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  return `RSC-${body}`;
}

function newAccessToken() {
  return crypto.randomBytes(24).toString("hex");
}

function tokenMatches(check, token) {
  if (!check || typeof token !== "string" || !token) return false;
  const left = Buffer.from(check.accessToken);
  const right = Buffer.from(token);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function canRead(check, { token, phone, user } = {}) {
  if (!check) return false;
  if (user && user.role === "STUDIO_ADMIN") return true;
  if (user && check.userId && Number(user.id) === Number(check.userId)) return true;
  if (tokenMatches(check, token)) return true;
  if (phone && phonesMatch(phone, check.customerPhone)) return true;
  return false;
}

function validateIntake(body) {
  const source = body && typeof body === "object" ? body : {};
  const errors = [];

  if (source.screenshots != null || source.photos != null || source.images != null) {
    errors.push("screenshots");
  }

  const location = typeof source.location === "string" ? source.location.trim() : "";
  if (location.length < 2 || location.length > 160) errors.push("location");

  const rentRaw = typeof source.askingRent === "string"
    ? source.askingRent.replace(/[, ]/g, "")
    : source.askingRent;
  const askingRent = typeof rentRaw === "number" ? rentRaw : Number(rentRaw);
  if (!Number.isInteger(askingRent) || askingRent <= 0 || askingRent > 1e12) errors.push("askingRent");

  const phone = digits(source.customerPhone);
  if (phone.length < 10 || phone.length > 15) errors.push("customerPhone");

  let listingUrl = null;
  if (source.listingUrl != null && String(source.listingUrl).trim() !== "") {
    listingUrl = String(source.listingUrl).trim();
    if (listingUrl.length > 500 || !/^https?:\/\//i.test(listingUrl)) errors.push("listingUrl");
  }

  let agentPhone = null;
  if (source.agentPhone != null && String(source.agentPhone).trim() !== "") {
    agentPhone = digits(source.agentPhone);
    if (agentPhone.length < 10 || agentPhone.length > 15) errors.push("agentPhone");
  }

  let paymentDetails = null;
  if (source.paymentDetails != null && source.paymentDetails !== "") {
    const parsed = parsePaymentDetails(source.paymentDetails);
    if (!parsed.ok) errors.push("paymentDetails");
    else paymentDetails = parsed.value;
  }

  const customerName = clip(source.customerName, 120);
  const agentName = clip(source.agentName, 120);
  const customerNotes = clip(source.customerNotes, 2000);
  if (containsForbiddenClaim(customerNotes) || containsForbiddenClaim(customerName)) {
    errors.push("forbiddenClaim");
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      customerName,
      customerPhone: phone,
      listingUrl,
      location,
      askingRent,
      agentName,
      agentPhone,
      paymentDetails,
      customerNotes,
    },
  };
}

function parsePaymentDetails(source) {
  if (typeof source !== "object" || Array.isArray(source)) return { ok: false };
  const keys = Object.keys(source);
  for (const key of keys) {
    const compact = key.toLowerCase().replace(/[^a-z]/g, "");
    if (SECRET_PAYMENT_KEYS.has(compact)) return { ok: false };
    if (!["bankname", "accountname", "accountnumber", "note"].includes(compact)) return { ok: false };
  }
  const accountNumber = source.accountNumber == null || String(source.accountNumber).trim() === ""
    ? null
    : digits(source.accountNumber);
  if (accountNumber && (accountNumber.length < 10 || accountNumber.length > 12)) return { ok: false };
  const value = {
    bankName: clip(source.bankName, 80),
    accountName: clip(source.accountName, 120),
    accountNumber,
    note: clip(source.note, 240),
  };
  if (!value.bankName && !value.accountName && !value.accountNumber && !value.note) return { ok: true, value: null };
  return { ok: true, value };
}

function maskPaymentDetails(details) {
  if (!details || typeof details !== "object") return null;
  const account = details.accountNumber ? digits(details.accountNumber) : "";
  return {
    bankName: details.bankName || null,
    accountName: details.accountName || null,
    accountNumber: account.length >= 4 ? `••••${account.slice(-4)}` : null,
    note: details.note || null,
    storedAs: "evidence",
  };
}

async function createRentalCheck(prisma, body, userId) {
  const parsed = validateIntake(body);
  if (!parsed.ok) return { ok: false, status: 400, errors: parsed.errors };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const publicReference = newPublicReference();
    const accessToken = newAccessToken();
    try {
      const created = await prisma.rentalCheck.create({
        data: {
          ...parsed.data,
          publicReference,
          accessToken,
          userId: userId || null,
          amountKobo: PRICE_KOBO,
          status: "SUBMITTED",
          paymentStatus: "UNPAID",
          reviewStatus: "NOT_STARTED",
        },
      });
      return { ok: true, check: created };
    } catch (error) {
      if (error && error.code === "P2002" && attempt < 4) continue;
      throw error;
    }
  }
  return { ok: false, status: 500, errors: ["reference"] };
}

function paystackReferenceFor(check) {
  return `${PAYSTACK_PREFIX}${check.publicReference}`;
}

function publicOrigin() {
  return String(process.env.PUBLIC_APP_URL || process.env.WHATSAPP_PUBLIC_URL || "")
    .trim()
    .replace(/\/$/, "");
}

function callbackUrlFor(check) {
  const origin = publicOrigin();
  if (!origin) return null;
  return `${origin}/check/${check.publicReference}?token=${encodeURIComponent(check.accessToken)}`;
}

async function initiatePayment(prisma, { reference, token, paystack }) {
  const check = await prisma.rentalCheck.findUnique({ where: { publicReference: reference } });
  if (!check || !tokenMatches(check, token)) return { ok: false, status: 401 };
  if (check.status === "CANCELLED") return { ok: false, status: 409, error: "This case is cancelled." };
  if (check.paymentStatus === "PAID") {
    return { ok: true, status: 200, alreadyPaid: true, check };
  }
  if (check.paystackAuthorizationUrl && check.paystackReference) {
    return {
      ok: true,
      status: 200,
      authorizationUrl: check.paystackAuthorizationUrl,
      paystackReference: check.paystackReference,
      check,
    };
  }
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return { ok: false, status: 503, missing: ["PAYSTACK_SECRET_KEY"] };
  }

  const paystackReference = paystackReferenceFor(check);
  const started = await paystack.initializeRentalCheckPayment({
    email: `rental-check+${check.publicReference.toLowerCase()}@lodgist.online`,
    amountKobo: check.amountKobo,
    reference: paystackReference,
    callbackUrl: callbackUrlFor(check),
    metadata: { type: "rental_check", publicReference: check.publicReference },
  });

  const updated = await prisma.rentalCheck.update({
    where: { id: check.id },
    data: {
      paystackReference,
      paystackAuthorizationUrl: started.authorization_url,
      paymentStatus: "PENDING",
      status: check.status === "SUBMITTED" ? "AWAITING_PAYMENT" : check.status,
    },
  });
  return {
    ok: true,
    status: 200,
    authorizationUrl: started.authorization_url,
    paystackReference,
    check: updated,
  };
}

function applyVerifiedPayment(check, verified) {
  if (!check) return { ok: false, reason: "not_found" };
  if (!verified || verified.status !== "success") return { ok: false, reason: "not_successful" };
  if (verified.currency && verified.currency !== "NGN") return { ok: false, reason: "currency" };
  if (Number(verified.amountKobo) !== Number(check.amountKobo)) return { ok: false, reason: "amount_mismatch" };
  if (verified.reference !== check.paystackReference) return { ok: false, reason: "reference_mismatch" };
  if (check.status === "CANCELLED") return { ok: false, reason: "cancelled" };
  if (check.paymentStatus === "PAID") return { ok: true, already: true, data: null };
  const nextStatus = ["SUBMITTED", "AWAITING_PAYMENT", "PAID"].includes(check.status)
    ? "UNDER_REVIEW"
    : check.status;
  return {
    ok: true,
    already: false,
    data: {
      paymentStatus: "PAID",
      status: nextStatus,
      paidAt: check.paidAt || new Date(),
    },
  };
}

async function confirmPayment(prisma, { reference, token, paystack }) {
  const check = await prisma.rentalCheck.findUnique({ where: { publicReference: reference } });
  if (!check || !tokenMatches(check, token)) return { ok: false, status: 401 };
  if (check.paymentStatus === "PAID") return { ok: true, status: 200, alreadyPaid: true, check };
  if (!check.paystackReference) return { ok: false, status: 409, error: "Payment has not been started." };
  if (!process.env.PAYSTACK_SECRET_KEY) return { ok: false, status: 503, missing: ["PAYSTACK_SECRET_KEY"] };

  const verified = await paystack.verifyRentalCheckPayment(check.paystackReference);
  const decision = applyVerifiedPayment(check, verified);
  if (!decision.ok) {
    if (check.paymentStatus === "PENDING") {
      await prisma.rentalCheck.update({
        where: { id: check.id },
        data: { paymentStatus: "FAILED" },
      });
    }
    return { ok: false, status: 402, reason: decision.reason };
  }
  if (decision.already) return { ok: true, status: 200, alreadyPaid: true, check };
  const updated = await prisma.rentalCheck.update({ where: { id: check.id }, data: decision.data });
  return { ok: true, status: 200, check: updated };
}

async function applyRentalCheckCharge(prisma, data) {
  if (!prisma.rentalCheck || !data || typeof data.reference !== "string") return { applied: false };
  if (!data.reference.startsWith(PAYSTACK_PREFIX)) return { applied: false };
  const check = await prisma.rentalCheck.findUnique({ where: { paystackReference: data.reference } });
  if (!check) return { applied: false, reason: "not_found" };
  const decision = applyVerifiedPayment(check, {
    status: "success",
    reference: data.reference,
    amountKobo: data.amount,
    currency: data.currency || "NGN",
  });
  if (!decision.ok || decision.already) return { applied: false, reason: decision.reason || "already", check };
  const updated = await prisma.rentalCheck.update({ where: { id: check.id }, data: decision.data });
  return { applied: true, check: updated };
}

async function applyRentalCheckChargeFailed(prisma, data) {
  if (!prisma.rentalCheck || !data || typeof data.reference !== "string") return;
  if (!data.reference.startsWith(PAYSTACK_PREFIX)) return;
  const check = await prisma.rentalCheck.findUnique({ where: { paystackReference: data.reference } });
  if (!check || check.paymentStatus === "PAID") return;
  await prisma.rentalCheck.update({
    where: { id: check.id },
    data: { paymentStatus: "FAILED" },
  });
}

function unavailableNeighborhood(listingUrl) {
  const match = String(listingUrl || "").match(/\/listings\/(\d+)(?:\/|$|\?)/);
  return {
    available: false,
    travelTime: null,
    walkingTime: null,
    roadDistance: null,
    businesses: [],
    coordinates: null,
    listingPath: match ? `/listings/${match[1]}/neighborhood` : null,
    provenance: match
      ? "A Lodgist listing link was supplied. Neighborhood View on that listing only shows evidence already stored there. This report does not copy travel time, road distance, businesses, or coordinates from it."
      : "Unavailable. Lodgist does not estimate travel time, walking time, road distance, businesses, or exact coordinates without evidence.",
  };
}

function normalizeEvidence(input) {
  const source = input && typeof input === "object" ? input : {};
  const evidence = {};
  for (const key of EVIDENCE_KEYS) {
    const item = source[key];
    if (!item || !EVIDENCE_STATES.includes(item.state)) {
      evidence[key] = {
        state: "unconfirmed",
        notes: "Not recorded. Missing evidence is not a fraud finding.",
      };
      continue;
    }
    evidence[key] = {
      state: item.state,
      notes: clip(item.notes, 1000) || "",
    };
  }
  return evidence;
}

function validateReview(body) {
  const source = body && typeof body === "object" ? body : {};
  const errors = [];
  const riskScore = typeof source.riskScore === "number" ? source.riskScore : Number(source.riskScore);
  if (!Number.isInteger(riskScore) || riskScore < 0 || riskScore > 100) errors.push("riskScore");
  if (!["LOW", "MEDIUM", "HIGH"].includes(source.confidence)) errors.push("confidence");
  if (!["LOWER_RISK", "UNCERTAIN", "HIGH_RISK"].includes(source.recommendation)) errors.push("recommendation");
  const reviewNotes = clip(source.reviewNotes, 4000);
  if (containsForbiddenClaim(reviewNotes)) errors.push("forbiddenClaim");
  if (source.evidence != null) {
    if (typeof source.evidence !== "object" || Array.isArray(source.evidence)) errors.push("evidence");
    else {
      for (const key of Object.keys(source.evidence)) {
        if (!EVIDENCE_KEYS.includes(key)) errors.push("evidence");
        else if (source.evidence[key] && source.evidence[key].state && !EVIDENCE_STATES.includes(source.evidence[key].state)) {
          errors.push("evidence");
        }
        if (containsForbiddenClaim(source.evidence[key] && source.evidence[key].notes)) errors.push("forbiddenClaim");
      }
    }
  }
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };
  return {
    ok: true,
    data: {
      riskScore,
      confidence: source.confidence,
      recommendation: source.recommendation,
      reviewNotes,
      evidence: normalizeEvidence(source.evidence),
    },
  };
}

function publishReview(check, review) {
  if (!check || check.paymentStatus !== "PAID") return { ok: false, reason: "unpaid" };
  if (check.status === "CANCELLED") return { ok: false, reason: "cancelled" };
  return {
    ok: true,
    data: {
      riskScore: review.riskScore,
      confidence: review.confidence,
      recommendation: review.recommendation,
      reviewNotes: review.reviewNotes,
      evidence: review.evidence,
      neighborhoodContext: unavailableNeighborhood(check.listingUrl),
      reviewStatus: "COMPLETE",
      status: "REPORT_READY",
      reviewedAt: new Date(),
    },
  };
}

function reportReady(check) {
  return check && (check.status === "REPORT_READY" || check.status === "DELIVERED");
}

function buildReport(check) {
  if (!reportReady(check) || !check.recommendation) return null;
  const evidence = normalizeEvidence(check.evidence);
  const sections = EVIDENCE_KEYS.map((key) => ({
    key,
    label: EVIDENCE_LABELS[key],
    state: evidence[key].state,
    notes: evidence[key].notes,
  }));
  const neighborhood = check.neighborhoodContext && typeof check.neighborhoodContext === "object"
    ? check.neighborhoodContext
    : unavailableNeighborhood(check.listingUrl);
  return {
    title: "Lodgist Rental Safety Report",
    trustScore: check.riskScore,
    confidence: check.confidence,
    recommendation: check.recommendation,
    recommendationLabel: RECOMMENDATION_LABEL[check.recommendation],
    checked: sections.filter((section) => section.state === "checked"),
    couldNotVerify: sections.filter((section) => section.state !== "checked"),
    sections,
    propertyEvidence: sections.find((section) => section.key === "propertyEvidence"),
    agentRiskSignals: sections.find((section) => section.key === "agentIdentity"),
    priceContext: sections.find((section) => section.key === "priceContext"),
    neighborhood,
    paymentRisk: sections.find((section) => section.key === "paymentRisk"),
    nextActions: nextActions(check.recommendation),
    limits: "This report is a review of the evidence Lodgist had. It is not a guarantee, and payment of the check fee does not verify the home.",
  };
}

function nextActions(recommendation) {
  if (recommendation === "HIGH_RISK") {
    return [
      "Do not pay yet.",
      "Do not send a deposit, inspection fee, or caution fee to the agent from this advert.",
      "Ask Lodgist support before any transfer.",
    ];
  }
  if (recommendation === "UNCERTAIN") {
    return [
      "Do not pay until the unconfirmed items on this report are checked.",
      "Confirm who controls the home, in person or on a live video walkthrough of the actual rooms.",
      "Pay only into an account whose name you have checked against that person. Lodgist has not authenticated any account.",
    ];
  }
  return [
    "Proceed only with normal precautions.",
    "See the home, or a live walkthrough of the actual rooms, before you pay.",
    "Keep the case reference. This report is not a promise that the home is free of problems.",
  ];
}

function customerView(check, { includeReport, admin } = {}) {
  const report = includeReport ? buildReport(check) : null;
  return {
    publicReference: check.publicReference,
    status: check.status,
    statusLabel: STATUS_LABEL[check.status] || check.status,
    paymentStatus: check.paymentStatus,
    reviewStatus: check.reviewStatus,
    amountNgn: check.amountKobo / 100,
    location: check.location,
    askingRent: check.askingRent,
    listingUrl: check.listingUrl,
    agentName: check.agentName,
    agentPhone: admin ? check.agentPhone : undefined,
    customerPhone: admin ? check.customerPhone : undefined,
    paymentDetails: admin ? check.paymentDetails : maskPaymentDetails(check.paymentDetails),
    customerNotes: check.customerNotes,
    riskScore: reportReady(check) ? check.riskScore : null,
    confidence: reportReady(check) ? check.confidence : null,
    recommendation: reportReady(check) ? check.recommendation : null,
    recommendationLabel: reportReady(check) ? RECOMMENDATION_LABEL[check.recommendation] : null,
    report,
    createdAt: check.createdAt,
    updatedAt: check.updatedAt,
    paidAt: check.paidAt,
    deliveredAt: check.deliveredAt,
  };
}

function summarizeMetrics(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const paid = list.filter((row) => row.paymentStatus === "PAID");
  const delivered = list.filter((row) => row.status === "DELIVERED" && row.deliveredAt && row.createdAt);
  const revenueKobo = paid.reduce((sum, row) => sum + Number(row.amountKobo || 0), 0);
  const times = delivered
    .map((row) => new Date(row.deliveredAt).getTime() - new Date(row.createdAt).getTime())
    .filter((ms) => Number.isFinite(ms) && ms >= 0);
  return {
    submitted: list.length,
    paid: paid.length,
    reportsDelivered: delivered.length,
    revenueNgn: revenueKobo / 100,
    averageCompletionMs: times.length ? Math.round(times.reduce((sum, ms) => sum + ms, 0) / times.length) : null,
  };
}

function commandOf(text) {
  const trimmed = String(text || "").trim();
  const upper = trimmed.toUpperCase();
  if (upper === "CHECK" || upper === "CHECK A RENTAL") return { type: "CHECK" };
  if (upper === "HELP") return { type: "HELP" };
  const status = trimmed.match(/^STATUS\s+([A-Za-z0-9-]+)$/);
  if (status) return { type: "STATUS", reference: status[1].toUpperCase() };
  const report = trimmed.match(/^REPORT\s+([A-Za-z0-9-]+)$/);
  if (report) return { type: "REPORT", reference: report[1].toUpperCase() };
  return null;
}

function helpReply() {
  return (
    "Lodgist rental check\n\n" +
    "CHECK — start a Rental Safety Check (₦5,000)\n" +
    "STATUS <reference> — current case state\n" +
    "REPORT <reference> — report link, only when it is ready and this number opened the case\n" +
    "HELP — this list\n\n" +
    "A paid check is not a verified home. Reply 1 for reviewed listings."
  );
}

function emptyDraft() {
  return { step: "listing", listingUrl: null, location: null, askingRent: null, agentName: null, agentPhone: null, customerNotes: null };
}

function draftContext(session, draft) {
  const base = session && session.context && typeof session.context === "object" ? session.context : {};
  return { ...base, rentalCheckDraft: draft };
}

function clearDraftContext(session) {
  if (!session || !session.context) return null;
  const next = { ...session.context };
  delete next.rentalCheckDraft;
  return next;
}

function caseUrl(check) {
  const path = `/check/${check.publicReference}?token=${encodeURIComponent(check.accessToken)}`;
  const origin = publicOrigin();
  if (origin) return `${origin}${path}`;
  return sitePath(path);
}

async function finishDraft(prisma, { phone, session, draft }) {
  const created = await createRentalCheck(prisma, {
    listingUrl: draft.listingUrl,
    location: draft.location,
    askingRent: draft.askingRent,
    agentName: draft.agentName,
    agentPhone: draft.agentPhone,
    customerNotes: draft.customerNotes,
    customerPhone: phone,
    customerName: session && session.contactName,
  }, session && session.userId);
  if (!created.ok) {
    return {
      handled: true,
      reply: "That detail is not usable yet. Reply CHECK to start again. Do not send money because of this chat.",
      context: clearDraftContext(session),
    };
  }
  const check = created.check;
  const url = caseUrl(check);
  const payLine = process.env.PAYSTACK_SECRET_KEY
    ? (url ? `Pay ₦5,000 on this page: ${url}` : "Payment can be started on Lodgist with this reference. The public site URL is not configured.")
    : "Payment is not configured yet. Keep this reference. Do not send the ₦5,000 to an agent.";
  return {
    handled: true,
    reply:
      `Case ${check.publicReference}. Status: Submitted.\n\n` +
      `${payLine}\n\n` +
      "Paying this fee does not mean the home is verified.",
    context: clearDraftContext(session),
  };
}

async function advanceDraft(prisma, { text, phone, session }) {
  const draft = { ...(session.context.rentalCheckDraft || emptyDraft()) };
  const value = String(text || "").trim();
  const skip = value.toUpperCase() === "SKIP";

  if (draft.step === "listing") {
    if (skip || value.toUpperCase() === "NONE") draft.listingUrl = null;
    else if (!/^https?:\/\//i.test(value)) {
      draft.listingUrl = null;
      draft.location = value.slice(0, 160);
      draft.step = "rent";
      return {
        handled: true,
        reply: "What is the asking rent in naira, numbers only? Example: 450000",
        context: draftContext(session, draft),
      };
    } else draft.listingUrl = value.slice(0, 500);
    draft.step = "location";
    return {
      handled: true,
      reply: "Where is the property? Send the area or address you were given.",
      context: draftContext(session, draft),
    };
  }

  if (draft.step === "location") {
    if (value.length < 2) return { handled: true, reply: "Send the area or address. At least a neighbourhood.", context: session.context };
    draft.location = value.slice(0, 160);
    draft.step = "rent";
    return { handled: true, reply: "What is the asking rent in naira, numbers only? Example: 450000", context: draftContext(session, draft) };
  }

  if (draft.step === "rent") {
    const rent = Number(value.replace(/[, ]/g, ""));
    if (!Number.isInteger(rent) || rent <= 0) {
      return { handled: true, reply: "Send the asking rent as a number of naira. Example: 450000", context: session.context };
    }
    draft.askingRent = rent;
    draft.step = "agentName";
    return { handled: true, reply: "Agent or landlord name? Reply SKIP if you do not have it.", context: draftContext(session, draft) };
  }

  if (draft.step === "agentName") {
    draft.agentName = skip ? null : value.slice(0, 120);
    draft.step = "agentPhone";
    return { handled: true, reply: "Agent or landlord phone? Reply SKIP if you do not have it.", context: draftContext(session, draft) };
  }

  if (draft.step === "agentPhone") {
    if (!skip) {
      const phoneDigits = digits(value);
      if (phoneDigits.length < 10 || phoneDigits.length > 15) {
        return { handled: true, reply: "Send a phone number, or SKIP.", context: session.context };
      }
      draft.agentPhone = phoneDigits;
    }
    draft.step = "notes";
    return { handled: true, reply: "Any notes? Account name you were told to pay, or what looks off. Reply SKIP if none. Do not send card numbers, PINs, or OTPs.", context: draftContext(session, draft) };
  }

  draft.customerNotes = skip ? null : value.slice(0, 2000);
  return finishDraft(prisma, { phone, session, draft });
}

async function handleWhatsAppRentalCheck(prisma, { text, phone, session }) {
  const command = commandOf(text);
  const draft = session && session.context && session.context.rentalCheckDraft;
  if (!command && !draft) return { handled: false };

  if (command && command.type === "HELP") return { handled: true, reply: helpReply() };
  if (command && command.type === "CHECK") {
    return {
      handled: true,
      reply: "Send the property or listing link, or describe the rental you want checked.",
      context: draftContext(session, emptyDraft()),
    };
  }
  if (command && (command.type === "STATUS" || command.type === "REPORT")) {
    const check = await prisma.rentalCheck.findUnique({ where: { publicReference: command.reference } });
    if (!check || !phonesMatch(phone, check.customerPhone)) {
      return { handled: true, reply: "We cannot show that case." };
    }
    if (command.type === "STATUS") {
      return {
        handled: true,
        reply: `${check.publicReference}: ${STATUS_LABEL[check.status] || check.status}. Payment: ${check.paymentStatus}.`,
      };
    }
    if (!reportReady(check)) {
      return { handled: true, reply: `${check.publicReference} is not ready for a report. Current state: ${STATUS_LABEL[check.status] || check.status}.` };
    }
    const url = caseUrl(check);
    if (!url) return { handled: true, reply: "The report is ready, but the public site URL is not configured." };
    if (check.status === "REPORT_READY") {
      await prisma.rentalCheck.update({
        where: { id: check.id },
        data: { status: "DELIVERED", deliveredAt: check.deliveredAt || new Date() },
      });
    }
    return { handled: true, reply: url };
  }

  if (draft) return advanceDraft(prisma, { text, phone, session });
  return { handled: false };
}

module.exports = {
  PRICE_NGN,
  PRICE_KOBO,
  PAYSTACK_PREFIX,
  EVIDENCE_KEYS,
  RECOMMENDATION_LABEL,
  STATUS_LABEL,
  newPublicReference,
  validateIntake,
  createRentalCheck,
  tokenMatches,
  canRead,
  initiatePayment,
  confirmPayment,
  applyVerifiedPayment,
  applyRentalCheckCharge,
  applyRentalCheckChargeFailed,
  validateReview,
  publishReview,
  buildReport,
  customerView,
  summarizeMetrics,
  handleWhatsAppRentalCheck,
  containsForbiddenClaim,
  unavailableNeighborhood,
};
