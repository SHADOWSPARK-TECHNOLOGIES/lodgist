const { SYSTEM_PROMPT, parseIntent } = require("./intents");
const { defaultComplete } = require("./ai");
const { runTool, renderReply } = require("./tools");
const { logWhatsApp } = require("./redact");

function toHistory(messages) {
  return (messages || [])
    .filter((message) => message && message.content)
    .slice(-12)
    .map((message) => ({
      role: message.direction === "OUTBOUND" ? "assistant" : "user",
      content: String(message.content).slice(0, 500),
    }));
}

async function routeTurn({ prisma, text, session, user, history, complete }) {
  const generate = complete || defaultComplete;
  let raw;
  try {
    raw = await generate({
      system: SYSTEM_PROMPT,
      history: history || [],
      userText: text,
    });
  } catch (err) {
    const unavailable = err && err.code === "AI_UNAVAILABLE";
    logWhatsApp(
      unavailable ? "warn" : "error",
      "WhatsApp AI unavailable",
      err instanceof Error ? err.message : ""
    );
    return { source: "menu", intent: null, reply: null, aiOutcome: "unavailable" };
  }

  const parsed = parseIntent(typeof raw === "string" ? raw : "");
  if (!parsed) {
    logWhatsApp("warn", "WhatsApp AI returned an invalid intent");
    return { source: "menu", intent: null, reply: null, aiOutcome: "invalid_intent" };
  }

  try {
    const toolResult = await runTool(prisma, parsed.intent, parsed.arguments, { user, session });
    const reply = renderReply(parsed.intent, toolResult, session?.id);
    return {
      source: "ai",
      intent: parsed.intent,
      arguments: parsed.arguments,
      toolResult,
      reply,
      aiOutcome: "ok",
    };
  } catch (err) {
    logWhatsApp("error", "WhatsApp tool failed", err instanceof Error ? err.message : "");
    return { source: "menu", intent: parsed.intent, reply: null, aiOutcome: "tool_failed" };
  }
}

async function resolveSender(prisma, from) {
  const phone = String(from || "");
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ phone }, { whatsappId: phone }],
    },
  });
  return { phone, user: user || null };
}

async function loadOrCreateSession(prisma, { user, phone, profileName }) {
  const include = {
    listing: true,
    user: true,
    messages: {
      orderBy: { sentAt: "asc" },
      take: 12,
    },
  };

  if (user) {
    const existing = await prisma.whatsAppSession.findFirst({
      where: { contactId: user.id, isActive: true },
      include,
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing;
    return prisma.whatsAppSession.create({
      data: {
        userId: user.id,
        contactId: user.id,
        phone,
        contactName: profileName || user.name || "Unknown",
        platform: "whatsapp",
        isActive: true,
      },
      include,
    });
  }

  const lead = await prisma.whatsAppSession.findFirst({
    where: { phone, userId: null, isActive: true },
    include,
    orderBy: { createdAt: "desc" },
  });
  if (lead) return lead;
  return prisma.whatsAppSession.create({
    data: {
      phone,
      contactName: profileName || "WhatsApp lead",
      platform: "whatsapp",
      isActive: true,
    },
    include,
  });
}

module.exports = {
  toHistory,
  routeTurn,
  resolveSender,
  loadOrCreateSession,
};
