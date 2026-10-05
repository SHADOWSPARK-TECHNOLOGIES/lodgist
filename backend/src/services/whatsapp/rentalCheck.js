const { sitePath } = require("./menu");
const {
  PRODUCT_NAME,
  PRICE_NGN,
  validateIntake,
  createRentalCheck,
  phonesMatch,
  issueAccessToken,
} = require("../rentalCheck");

const STEPS = ["listing_url", "location", "asking_rent", "agent_name", "agent_phone", "notes", "payment_details"];

const PROMPTS = {
  listing_url: "Send the listing link, or reply SKIP if you do not have one.",
  location: "Where is the house? Send the area and city.",
  asking_rent: "What rent are they asking? Send the amount in naira, numbers only.",
  agent_name: "What name did the landlord or agent give? Reply SKIP if you do not have it.",
  agent_phone: "What phone number did they give? Reply SKIP if you do not have it.",
  notes: "Anything else we should see? Reply SKIP if not.",
  payment_details:
    "If they asked you to pay into an account, reply with the bank and account name. Do not send card numbers, PINs, or OTPs. Reply SKIP if you have none.",
};

function parseCommand(text) {
  const parts = String(text || "").trim().split(/\s+/);
  const head = (parts[0] || "").toUpperCase();
  if (!["CHECK", "STATUS", "REPORT", "HELP", "CANCEL"].includes(head)) return null;
  return { command: head, arg: parts.slice(1).join(" ").trim() };
}

function helpText() {
  return (
    `${PRODUCT_NAME} is ₦${PRICE_NGN.toLocaleString("en-NG")}.\n` +
    "It is a review of the information you send. It is not a statement that a house is verified.\n\n" +
    "CHECK — start a case\n" +
    "STATUS RSC-… — see where a case is\n" +
    "REPORT RSC-… — get the report link when it is ready\n" +
    "HELP — show this message\n" +
    "CANCEL — stop a check you have not finished"
  );
}

function caseUrl(publicReference) {
  const token = issueAccessToken(publicReference);
  const path = `/check/${encodeURIComponent(publicReference)}?token=${encodeURIComponent(token)}`;
  return sitePath(path);
}

function normalizeDraftPhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

async function loadDraft(prisma, phone) {
  return prisma.rentalCheckDraft.findUnique({ where: { phone } });
}

async function saveDraft(prisma, phone, step, fields) {
  return prisma.rentalCheckDraft.upsert({
    where: { phone },
    create: { phone, step, fields },
    update: { step, fields },
  });
}

function applyStep(fields, step, text) {
  const value = String(text || "").trim();
  const skip = value.toUpperCase() === "SKIP";
  const next = { ...fields };
  if (step === "listing_url") {
    if (skip) next.listingUrl = null;
    else if (!/^https?:\/\//i.test(value) || value.length > 500) return { error: "Send a link that starts with http, or reply SKIP." };
    else next.listingUrl = value;
  } else if (step === "location") {
    if (value.length < 2 || value.length > 160) return { error: "Send the area and city." };
    next.location = value;
  } else if (step === "asking_rent") {
    const amount = Number(value.replace(/[₦,\s]/g, ""));
    if (!Number.isInteger(amount) || amount < 1) return { error: "Send the rent as a whole number of naira." };
    next.askingRent = amount;
  } else if (step === "agent_name") {
    next.agentName = skip ? null : value.slice(0, 120);
  } else if (step === "agent_phone") {
    if (skip) next.agentPhone = null;
    else {
      const phone = value.replace(/\D/g, "");
      if (phone.length < 10 || phone.length > 15) return { error: "Send a phone number, or reply SKIP." };
      next.agentPhone = phone;
    }
  } else if (step === "notes") {
    next.customerNotes = skip ? null : value.slice(0, 2000);
  } else if (step === "payment_details") {
    if (skip) next.paymentDetails = null;
    else {
      if (/\d{13,19}/.test(value)) return { error: "Do not send card numbers. Reply with a bank and account name, or SKIP." };
      next.paymentDetails = { method: "bank_transfer", narration: value.slice(0, 300) };
    }
  }
  return { fields: next };
}

async function finishDraft(prisma, { phone, fields, user, profileName }) {
  const parsed = validateIntake({
    customerName: profileName || null,
    customerPhone: phone,
    listingUrl: fields.listingUrl,
    location: fields.location,
    askingRent: fields.askingRent,
    agentName: fields.agentName,
    agentPhone: fields.agentPhone,
    customerNotes: fields.customerNotes,
    paymentDetails: fields.paymentDetails,
  });
  if (!parsed.ok) {
    return {
      handled: true,
      replyText: "Those details could not be saved. Reply CHECK to start again. Do not send card numbers, PINs, or OTPs.",
    };
  }
  const { check } = await createRentalCheck(prisma, {
    ...parsed.data,
    userId: user && user.id ? user.id : null,
  });
  await prisma.rentalCheckDraft.deleteMany({ where: { phone } });
  const url = caseUrl(check.publicReference);
  const link = url
    ? `Pay ₦${PRICE_NGN.toLocaleString("en-NG")} here: ${url}`
    : "The payment link is not configured on this number yet. Keep the case reference and open Lodgist.";
  return {
    handled: true,
    replyText:
      `Case ${check.publicReference} is saved.\n${link}\n` +
      "This payment is for the check. It does not mean the house has been verified.\n" +
      `Reply STATUS ${check.publicReference} to see progress.`,
  };
}

async function statusReply(prisma, phone, arg) {
  const reference = arg.toUpperCase();
  let check = null;
  if (reference) {
    check = await prisma.rentalCheck.findUnique({ where: { publicReference: reference } });
    if (!check || !phonesMatch(check.customerPhone, phone)) {
      return "No case on this WhatsApp number matches that reference.";
    }
  } else {
    const rows = await prisma.rentalCheck.findMany({
      where: { customerPhone: phone },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    check = rows.find((row) => phonesMatch(row.customerPhone, phone)) || null;
    if (!check) return "No rental check is saved for this WhatsApp number. Reply CHECK to start one.";
  }
  return `Case ${check.publicReference}\nStatus: ${check.status}\nPayment: ${check.paymentStatus}\nReview: ${check.reviewStatus}`;
}

async function reportReply(prisma, phone, arg) {
  const reference = arg.toUpperCase();
  if (!reference) return "Reply REPORT and the case reference. Example: REPORT RSC-ABCD2345";
  const check = await prisma.rentalCheck.findUnique({ where: { publicReference: reference } });
  if (!check || !phonesMatch(check.customerPhone, phone)) {
    return "No case on this WhatsApp number matches that reference.";
  }
  if (check.status !== "REPORT_READY" && check.status !== "DELIVERED") {
    return `The report for ${check.publicReference} is not ready. Status: ${check.status}.`;
  }
  const url = caseUrl(check.publicReference);
  if (!url) return `The report for ${check.publicReference} is ready. The public link is not configured on this number yet.`;
  return url;
}

async function handleRentalCheckMessage(prisma, { text, phone, user, profileName }) {
  const normalized = normalizeDraftPhone(phone);
  if (!normalized || !prisma.rentalCheckDraft || !prisma.rentalCheck) return { handled: false };
  const command = parseCommand(text);
  if (command && command.command === "HELP") return { handled: true, replyText: helpText() };
  if (command && command.command === "CANCEL") {
    await prisma.rentalCheckDraft.deleteMany({ where: { phone: normalized } });
    return { handled: true, replyText: "Stopped. No unfinished check is waiting. Reply CHECK when you want to start." };
  }
  if (command && command.command === "STATUS") {
    return { handled: true, replyText: await statusReply(prisma, normalized, command.arg) };
  }
  if (command && command.command === "REPORT") {
    return { handled: true, replyText: await reportReply(prisma, normalized, command.arg) };
  }
  if (command && command.command === "CHECK") {
    await saveDraft(prisma, normalized, "listing_url", {});
    return {
      handled: true,
      replyText: `${PRODUCT_NAME} is ₦${PRICE_NGN.toLocaleString("en-NG")}. ${PROMPTS.listing_url}`,
    };
  }

  const draft = await loadDraft(prisma, normalized);
  if (!draft) return { handled: false };
  const step = draft.step;
  const applied = applyStep(draft.fields || {}, step, text);
  if (applied.error) return { handled: true, replyText: applied.error };
  const index = STEPS.indexOf(step);
  const nextStep = STEPS[index + 1];
  if (!nextStep) return finishDraft(prisma, { phone: normalized, fields: applied.fields, user, profileName });
  await saveDraft(prisma, normalized, nextStep, applied.fields);
  return { handled: true, replyText: PROMPTS[nextStep] };
}

module.exports = {
  handleRentalCheckMessage,
  parseCommand,
  helpText,
};
