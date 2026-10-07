const crypto = require("crypto");

const PRODUCT_NAME = "Rental Safety Check";
const PRICE_NGN = 5000;
const PRICE_KOBO = 500000;
const PAYSTACK_REFERENCE_PREFIX = "LODG-ESC-RSC-";
const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const RECOMMENDATION_COPY = {
  LOWER_RISK: "LOWER RISK — PROCEED WITH NORMAL PRECAUTIONS",
  UNCERTAIN: "UNCERTAIN — VERIFY THESE ITEMS FIRST",
  HIGH_RISK: "HIGH RISK — DO NOT PAY YET",
};

const SECTION_LABELS = {
  propertyEvidence: "Property evidence",
  agentIdentity: "Agent identity",
  phoneConsistency: "Phone consistency",
  paymentRisk: "Payment risk",
  askingPrice: "Asking-rent context",
  neighborhood: "Neighborhood",
  suspiciousOrMissing: "Suspicious or missing evidence",
};

const EVIDENCE_KEYS = Object.keys(SECTION_LABELS);
const EVIDENCE_STATES = new Set(["not_checked", "checked", "unavailable", "incomplete", "unconfirmed"]);
const STATE_LABELS = {
  not_checked: "Not checked",
  checked: "Checked",
  unavailable: "Unavailable",
  incomplete: "Incomplete",
  unconfirmed: "Unconfirmed",
};

const CONFIDENCE = new Set(["LOW", "MEDIUM", "HIGH"]);
const RECOMMENDATIONS = new Set(["LOWER_RISK", "UNCERTAIN", "HIGH_RISK"]);
const PAYMENT_METHODS = new Set(["bank_transfer", "cash", "pos", "unknown", "other"]);
const SECRET_KEYS = new Set(["cvv", "cvc", "pin", "otp", "password", "cardnumber", "pan", "secret", "card"]);
const BANNED_CLAIM = [/100\s*%\s*verified/i, /fraud[-\s]?free/i, /guaranteed/i, /\bsafe\b/i];
// 13-19 digit runs with optional single spaces or dashes between digits. Luhn filters most phone numbers.
const CARD_RUN = /\d(?:[ -]?\d){12,18}/g;
const SECRET_LABEL_WITH_DIGITS = /\b(?:pin|otp|cvv|cvc|password)\b\D{0,12}\d{3,8}\b/i;

const NEXT_ACTIONS = {
  LOWER_RISK: [
    "Walk the property in person before you send rent.",
    "Confirm the account name matches the person who controls the home.",
    "Keep this case reference.",
  ],
  UNCERTAIN: [
    "Do not send money until every open item is resolved.",
    "Ask for the items labelled not checked, unavailable, incomplete, or unconfirmed.",
    "Keep this case reference.",
  ],
  HIGH_RISK: [
    "Do not pay yet.",
    "Do not send a deposit to hold the house.",
    "Use this case reference if you contact Lodgist again.",
  ],
};

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function clip(value, max) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) return { error: true };
  return text;
}

function hasBannedClaim(text) {
  return BANNED_CLAIM.some((pattern) => pattern.test(String(text || "")));
}

function luhnValid(number) {
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let digit = number.charCodeAt(i) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function containsPaymentSecret(text) {
  const value = String(text || "");
  if (!value) return false;
  if (SECRET_LABEL_WITH_DIGITS.test(value)) return true;
  const runs = value.match(CARD_RUN) || [];
  return runs.some((run) => {
    const number = run.replace(/\D/g, "");
    return number.length >= 13 && number.length <= 19 && luhnValid(number);
  });
}

function tokenSecret() {
  return process.env.RENTAL_CHECK_TOKEN_SECRET || process.env.JWT_SECRET || "";
}

function issueAccessToken(publicReference) {
  const secret = tokenSecret();
  if (secret) {
    return crypto.createHmac("sha256", secret).update(`rental-check:${publicReference}`).digest("base64url");
  }
  return crypto.randomBytes(24).toString("base64url");
}

function hashAccessToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function tokenMatches(check, token) {
  if (!check || !token || !check.accessTokenHash) return false;
  const hashed = hashAccessToken(token);
  const left = Buffer.from(hashed);
  const right = Buffer.from(String(check.accessTokenHash));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function createPublicReference() {
  const bytes = crypto.randomBytes(8);
  let out = "RSC-";
  for (let i = 0; i < 8; i += 1) {
    out += REFERENCE_ALPHABET[bytes[i] % REFERENCE_ALPHABET.length];
  }
  return out;
}

function isReferenceCollision(error) {
  if (!error || error.code !== "P2002") return false;
  const target = error.meta && error.meta.target;
  const joined = Array.isArray(target) ? target.join(",") : String(target || error.message || "");
  return joined.toLowerCase().includes("publicreference");
}

function defaultEvidence() {
  const evidence = {};
  for (const key of EVIDENCE_KEYS) {
    evidence[key] = {
      state: "not_checked",
      note: "",
      provenance: key === "neighborhood" ? "unavailable" : "not_checked",
    };
  }
  return evidence;
}

function validatePaymentDetails(value) {
  if (value == null || value === "") return { ok: true, data: null };
  if (typeof value !== "object" || Array.isArray(value)) return { ok: false };
  const keys = Object.keys(value);
  for (const key of keys) {
    if (SECRET_KEYS.has(key.toLowerCase())) return { ok: false };
    if (!["method", "bankName", "accountName", "accountNumber", "narration"].includes(key)) return { ok: false };
  }
  if (value.method != null && !PAYMENT_METHODS.has(value.method)) return { ok: false };
  let accountNumber = null;
  if (value.accountNumber != null && String(value.accountNumber).trim() !== "") {
    const raw = String(value.accountNumber).replace(/\s/g, "");
    if (!/^\d{10}$/.test(raw)) return { ok: false };
    accountNumber = raw;
  }
  const bankName = clip(value.bankName, 80);
  const accountName = clip(value.accountName, 120);
  const narration = clip(value.narration, 300);
  if (bankName && bankName.error) return { ok: false };
  if (accountName && accountName.error) return { ok: false };
  if (narration && narration.error) return { ok: false };
  const blob = `${narration || ""} ${bankName || ""} ${accountName || ""}`;
  if (/\d{13,19}/.test(blob) || containsPaymentSecret(blob)) return { ok: false };
  if (hasBannedClaim(blob)) return { ok: false };
  return {
    ok: true,
    data: {
      method: value.method || "unknown",
      bankName,
      accountName,
      accountNumber,
      narration,
    },
  };
}

function validateIntake(body) {
  const source = body && typeof body === "object" ? body : {};
  const errors = [];
  if (source.screenshots != null || source.images != null || source.files != null) {
    errors.push("screenshots");
  }

  let customerName = null;
  if (source.customerName != null && String(source.customerName).trim() !== "") {
    const name = clip(source.customerName, 120);
    if (!name || name.error || name.length < 2) errors.push("customerName");
    else customerName = name;
  }

  const phone = digits(source.customerPhone);
  if (phone.length < 10 || phone.length > 15) errors.push("customerPhone");

  let customerEmail = null;
  if (source.customerEmail != null && String(source.customerEmail).trim() !== "") {
    const email = String(source.customerEmail).trim();
    if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("customerEmail");
    else customerEmail = email;
  }

  let listingUrl = null;
  if (source.listingUrl != null && String(source.listingUrl).trim() !== "") {
    const url = String(source.listingUrl).trim();
    if (url.length > 500 || !/^https?:\/\//i.test(url)) errors.push("listingUrl");
    else listingUrl = url;
  }

  const location = clip(source.location, 160);
  if (!location || location.error || location.length < 2) errors.push("location");

  const rentRaw = typeof source.askingRent === "number" ? source.askingRent : Number(String(source.askingRent || "").replace(/[, ]/g, ""));
  if (!Number.isInteger(rentRaw) || rentRaw < 1 || rentRaw > 1_000_000_000) errors.push("askingRent");

  let agentName = null;
  if (source.agentName != null && String(source.agentName).trim() !== "") {
    const name = clip(source.agentName, 120);
    if (!name || name.error || name.length < 2) errors.push("agentName");
    else agentName = name;
  }

  let agentPhone = null;
  if (source.agentPhone != null && String(source.agentPhone).trim() !== "") {
    const agentDigits = digits(source.agentPhone);
    if (agentDigits.length < 10 || agentDigits.length > 15) errors.push("agentPhone");
    else agentPhone = agentDigits;
  }

  let customerNotes = null;
  if (source.customerNotes != null && String(source.customerNotes).trim() !== "") {
    const notes = clip(source.customerNotes, 2000);
    if (!notes || notes.error) errors.push("customerNotes");
    else if (hasBannedClaim(notes) || containsPaymentSecret(notes)) errors.push("customerNotes");
    else customerNotes = notes;
  }

  const payment = validatePaymentDetails(source.paymentDetails);
  if (!payment.ok) errors.push("paymentDetails");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      customerName,
      customerPhone: phone,
      customerEmail,
      listingUrl,
      location,
      askingRent: rentRaw,
      agentName,
      agentPhone,
      customerNotes,
      paymentDetails: payment.data,
    },
  };
}

async function createRentalCheck(prisma, fields) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const publicReference = createPublicReference();
    const accessToken = issueAccessToken(publicReference);
    try {
      const check = await prisma.rentalCheck.create({
        data: {
          ...fields,
          publicReference,
          accessTokenHash: hashAccessToken(accessToken),
          amountNgn: PRICE_NGN,
          status: "SUBMITTED",
          paymentStatus: "UNPAID",
          reviewStatus: "NOT_STARTED",
          evidence: defaultEvidence(),
        },
      });
      return { check, accessToken };
    } catch (error) {
      lastError = error;
      if (isReferenceCollision(error)) continue;
      throw error;
    }
  }
  throw lastError || new Error("Could not allocate a case reference");
}

function phonesMatch(left, right) {
  const a = digits(left);
  const b = digits(right);
  if (a.length < 10 || b.length < 10) return false;
  return a.slice(-10) === b.slice(-10);
}

function isRentalPaystackReference(reference, data) {
  if (data && data.metadata && data.metadata.type === "rental_safety_check") return true;
  return typeof reference === "string" && reference.startsWith(PAYSTACK_REFERENCE_PREFIX);
}

function chargeAmountAccepted(data) {
  if (!data || Number(data.amount) !== PRICE_KOBO) return false;
  if (data.currency && data.currency !== "NGN") return false;
  return true;
}

function verifyAmountAccepted(verified) {
  if (!verified || verified.status !== "success") return false;
  if (Number(verified.amount) !== PRICE_NGN) return false;
  if (verified.currency && verified.currency !== "NGN") return false;
  return true;
}

function paidPaymentUpdate(check) {
  const keep = check.status === "REPORT_READY" || check.status === "DELIVERED" || check.status === "UNDER_REVIEW";
  return {
    paymentStatus: "PAID",
    status: keep ? check.status : "UNDER_REVIEW",
    paidAt: check.paidAt || new Date(),
  };
}

function publicStatus(check) {
  return {
    product: PRODUCT_NAME,
    publicReference: check.publicReference,
    status: check.status,
    paymentStatus: check.paymentStatus,
    reviewStatus: check.reviewStatus,
    amountNgn: check.amountNgn,
    reportReady: check.status === "REPORT_READY" || check.status === "DELIVERED",
    createdAt: check.createdAt,
  };
}

function neighborhoodBlock(item) {
  const raw = item && item.state ? item.state : "not_checked";
  const note = item && item.note ? String(item.note).trim() : "";
  const attached = item && item.provenance === "spatial_lab" && note.length >= 2;
  if (!note || raw === "not_checked" || raw === "unavailable") {
    return {
      state: "unavailable",
      stateLabel: "Unavailable",
      provenance:
        "Spatial Lab was not used. This case has no Lodgist listing coordinates. No travel time, business, or map point was created.",
      note: note || null,
    };
  }
  const state = EVIDENCE_STATES.has(raw) ? raw : "unconfirmed";
  return {
    state,
    stateLabel: STATE_LABELS[state] || "Unconfirmed",
    provenance: attached
      ? "Attached by a reviewer from an existing Lodgist Spatial Lab result. This check did not measure a new route or place."
      : "Reviewer note. Not a Spatial Lab measurement.",
    note,
  };
}

function buildReport(check) {
  const evidence = { ...defaultEvidence(), ...(check.evidence && typeof check.evidence === "object" ? check.evidence : {}) };
  const sections = EVIDENCE_KEYS.map((key) => {
    const item = evidence[key] || { state: "not_checked", note: "" };
    const state = EVIDENCE_STATES.has(item.state) ? item.state : "not_checked";
    if (key === "neighborhood") {
      const block = neighborhoodBlock(item);
      return {
        key,
        label: SECTION_LABELS[key],
        state: block.state,
        stateLabel: block.stateLabel,
        note: block.note,
        provenance: block.provenance,
      };
    }
    return {
      key,
      label: SECTION_LABELS[key],
      state,
      stateLabel: STATE_LABELS[state],
      note: item.note ? String(item.note) : null,
      provenance: null,
    };
  });
  const checked = sections.filter((section) => section.state === "checked").map((section) => section.label);
  const couldNotVerify = sections.filter((section) => section.state !== "checked").map((section) => section.label);
  const recommendation = RECOMMENDATIONS.has(check.recommendation) ? check.recommendation : null;
  return {
    product: PRODUCT_NAME,
    publicReference: check.publicReference,
    status: check.status,
    published: check.status === "REPORT_READY" || check.status === "DELIVERED",
    trustScore: Number.isInteger(check.riskScore) ? check.riskScore : null,
    confidence: check.confidence || null,
    recommendation,
    recommendationLabel: recommendation ? RECOMMENDATION_COPY[recommendation] : null,
    disclaimer:
      "A score is not verification. Unknown, unavailable, incomplete, or unconfirmed evidence stays labelled. Lack of evidence is not recorded as fraud.",
    sections,
    checked,
    couldNotVerify,
    nextActions: recommendation ? NEXT_ACTIONS[recommendation] : [],
    amountNgn: check.amountNgn,
    location: check.location,
    askingRent: check.askingRent,
    reportPublishedAt: check.reportPublishedAt || null,
  };
}

function adminView(check) {
  if (!check) return null;
  const { accessTokenHash, ...rest } = check;
  return {
    ...rest,
    preview: buildReport(check),
  };
}

function validateEvidence(source) {
  const evidence = defaultEvidence();
  if (source == null) return { ok: true, data: evidence };
  if (typeof source !== "object" || Array.isArray(source)) return { ok: false, error: "evidence" };
  for (const key of Object.keys(source)) {
    if (!EVIDENCE_KEYS.includes(key)) return { ok: false, error: "evidence" };
    const item = source[key];
    if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false, error: key };
    for (const field of Object.keys(item)) {
      if (!["state", "note", "provenance"].includes(field)) return { ok: false, error: key };
    }
    if (item.state != null && !EVIDENCE_STATES.has(item.state)) return { ok: false, error: key };
    const note = item.note == null ? "" : String(item.note).trim();
    if (note.length > 500 || hasBannedClaim(note)) return { ok: false, error: key };
    let provenance = item.provenance || (key === "neighborhood" ? "unavailable" : "not_checked");
    if (key === "neighborhood") {
      if (!["unavailable", "reviewer_note", "spatial_lab"].includes(provenance)) return { ok: false, error: key };
      if (provenance === "spatial_lab" && note.length < 2) return { ok: false, error: key };
    }
    evidence[key] = {
      state: item.state || "not_checked",
      note,
      provenance,
    };
  }
  return { ok: true, data: evidence };
}

function validateReview(body, check) {
  if (!check) return { ok: false, status: 404, error: "Case not found." };
  if (check.status === "CANCELLED") return { ok: false, status: 409, error: "This case is cancelled." };
  if (check.paymentStatus !== "PAID") {
    return { ok: false, status: 409, error: "A review can be saved only after payment is confirmed." };
  }
  const source = body && typeof body === "object" ? body : {};
  const publish = source.publish === true;
  let riskScore = check.riskScore;
  if (source.riskScore != null && source.riskScore !== "") {
    const score = typeof source.riskScore === "number" ? source.riskScore : Number(source.riskScore);
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      return { ok: false, status: 400, error: "Trust score must be a whole number from 0 to 100." };
    }
    riskScore = score;
  }
  const confidence = source.confidence || check.confidence || null;
  if (confidence && !CONFIDENCE.has(confidence)) {
    return { ok: false, status: 400, error: "Confidence must be LOW, MEDIUM, or HIGH." };
  }
  const recommendation = source.recommendation || check.recommendation || null;
  if (recommendation && !RECOMMENDATIONS.has(recommendation)) {
    return { ok: false, status: 400, error: "Recommendation is not one of the allowed values." };
  }
  let reviewerNotes = check.reviewerNotes || null;
  if (source.reviewerNotes != null) {
    const notes = clip(source.reviewerNotes, 4000);
    if (notes && notes.error) return { ok: false, status: 400, error: "Reviewer notes are too long." };
    reviewerNotes = notes;
  }
  const evidence = validateEvidence(source.evidence == null ? check.evidence : source.evidence);
  if (!evidence.ok) return { ok: false, status: 400, error: "Evidence labels are incomplete or not allowed." };

  if (publish) {
    if (!Number.isInteger(riskScore)) return { ok: false, status: 400, error: "A trust score is required before publication." };
    if (!confidence) return { ok: false, status: 400, error: "Confidence is required before publication." };
    if (!recommendation) return { ok: false, status: 400, error: "A recommendation is required before publication." };
  }

  const alreadyDelivered = check.status === "DELIVERED";
  const data = {
    riskScore: riskScore == null ? null : riskScore,
    confidence,
    recommendation,
    reviewerNotes,
    evidence: evidence.data,
    reviewStatus: publish ? "COMPLETE" : "IN_PROGRESS",
    reviewedAt: new Date(),
  };
  if (publish) {
    data.status = alreadyDelivered ? "DELIVERED" : "REPORT_READY";
    data.reportPublishedAt = check.reportPublishedAt || new Date();
  }
  return { ok: true, data };
}

function summarizeMetrics({ submitted, paidCount, delivered, paidAmounts, completions }) {
  const revenueNgn = (paidAmounts || []).reduce((sum, amount) => sum + Number(amount || 0), 0);
  let averageCompletionMs = null;
  const rows = completions || [];
  if (rows.length) {
    const total = rows.reduce((sum, row) => {
      const end = new Date(row.reportPublishedAt).getTime();
      const start = new Date(row.createdAt).getTime();
      if (Number.isNaN(end) || Number.isNaN(start)) return sum;
      return sum + (end - start);
    }, 0);
    averageCompletionMs = Math.round(total / rows.length);
  }
  return {
    submitted: submitted || 0,
    paid: paidCount || 0,
    reportsDelivered: delivered || 0,
    revenueNgn,
    averageCompletionMs,
  };
}

function paystackCustomerEmail(check) {
  if (check.customerEmail) return check.customerEmail;
  return `checks+${String(check.publicReference).toLowerCase()}@lodgist.online`;
}

module.exports = {
  PRODUCT_NAME,
  PRICE_NGN,
  PRICE_KOBO,
  PAYSTACK_REFERENCE_PREFIX,
  RECOMMENDATION_COPY,
  SECTION_LABELS,
  STATE_LABELS,
  validateIntake,
  validateReview,
  createPublicReference,
  issueAccessToken,
  hashAccessToken,
  tokenMatches,
  createRentalCheck,
  phonesMatch,
  isRentalPaystackReference,
  chargeAmountAccepted,
  verifyAmountAccepted,
  paidPaymentUpdate,
  publicStatus,
  buildReport,
  adminView,
  summarizeMetrics,
  defaultEvidence,
  paystackCustomerEmail,
  hasBannedClaim,
  containsPaymentSecret,
  isReferenceCollision,
};
