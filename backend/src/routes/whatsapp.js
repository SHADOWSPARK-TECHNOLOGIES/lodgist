const express = require("express");
const crypto = require("crypto");
const { requireAuth } = require("../middleware/auth");
const { parseWebhookBody } = require("./whatsappParse");
const { sitePath, listingsReply, isExactMenuCommand, deterministicReply } = require("../services/whatsapp/menu");
const { handleRentalCheckMessage } = require("../services/whatsapp/rentalCheck");
const { routeTurn, resolveSender, loadOrCreateSession, toHistory } = require("../services/whatsapp/engine");
const {
  logWhatsApp,
  redactPhone,
  phoneLast4,
  mapGraphError,
  logWebhookEvent,
} = require("../services/whatsapp/redact");

const SEND_TIMEOUT_MS = 8000;
const SEND_STATUS = {
  WA_NOT_CONFIGURED: 503,
  META_AUTH: 502,
  META_RATE_LIMIT: 429,
  META_RECIPIENT: 422,
  META_BAD_REQUEST: 502,
  META_SERVER: 502,
  META_NETWORK: 504,
};
const OUTCOME_RANK = [
  "error_internal",
  "reply_failed",
  "reply_skipped_unconfigured",
  "replied",
  "ignored_no_sender",
  "ignored_duplicate",
];

function dbOrInternal(error) {
  const code = error && typeof error.code === "string" ? error.code : "";
  return /^P\d+/.test(code) ? "DB_ERROR" : "INTERNAL";
}

/**
 * Create an Express router for WhatsApp webhook and messaging endpoints.
 * Accepts a `prisma` instance for testability.
 *
 * Flow: Meta webhook → HMAC → phone_number_id filter → msg.id dedupe →
 * session (User or lead) → Gemini intent router (menu fallback) → Lodgist tools → Meta send.
 *
 * @param {object} prisma - Prisma client instance
 * @param {{ complete?: Function }} [options]
 * @returns {import("express").Router}
 */
// Meta WhatsApp Cloud API. Required env names (set in the host, never in code):
// WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN,
// WHATSAPP_APP_SECRET, WHATSAPP_PUBLIC_URL
// AI: GCP_PROJECT_ID, GCP_PROJECT_LOCATION, GOOGLE_APPLICATION_CREDENTIALS
// Optional Claude fallback: ANTHROPIC_API_KEY, ANTHROPIC_MODEL
module.exports = function (prisma, options = {}) {
  const router = express.Router();
  const seenMsgIds = new Set();
  let loggedMissingPhoneNumberId = false;

  function configuredPhoneNumberId() {
    const raw = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (typeof raw !== "string") return "";
    return raw.trim();
  }

  // Meta delivers one app's webhooks to every subscribed callback. Ack a change
  // for another business number without dedupe, replies, or database writes.
  // An unset id keeps the previous accept-all behavior and warns once.
  function inboundChangeIsForThisNumber(metadata) {
    const configured = configuredPhoneNumberId();
    if (!configured) {
      if (!loggedMissingPhoneNumberId) {
        loggedMissingPhoneNumberId = true;
        logWhatsApp(
          "warn",
          "WHATSAPP_PHONE_NUMBER_ID is unset; inbound WhatsApp changes are not filtered by phone number"
        );
      }
      return true;
    }
    const incoming = metadata?.phone_number_id;
    if (incoming === undefined || incoming === null || incoming === "") return false;
    return String(incoming) === configured;
  }

  function verifyWebhookSignature(signature, body) {
    if (!signature || !process.env.WHATSAPP_APP_SECRET) return false;
    const rawBody = Buffer.isBuffer(body) ? body.toString("utf8") : JSON.stringify(body);
    const expected = crypto
      .createHmac("sha256", process.env.WHATSAPP_APP_SECRET)
      .update(rawBody)
      .digest("hex");
    const expectedSig = `sha256=${expected}`;
    if (expectedSig.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature));
  }

  function analyzeFraud(text) {
    const lower = text.toLowerCase();
    let score = 0;
    const reasons = [];

    const highRisk = [
      "pay before", "payment before", "inspection fee", "viewing fee",
      "western union", "wire transfer", "crypto", "bitcoin",
      "i'm out of country", "i am out of the country", "abroad",
      "send money", "deposit to secure", "pay now or lose",
      "many people interested", "urgent payment",
    ];
    for (const pattern of highRisk) {
      if (lower.includes(pattern)) {
        score += 0.25;
        reasons.push(`High-risk pattern: "${pattern}"`);
      }
    }

    const medRisk = [
      "discount", "too good", "below market", "cheap",
      "hurry", "quick", "limited time",
      "no viewing", "virtual tour only",
    ];
    for (const pattern of medRisk) {
      if (lower.includes(pattern)) {
        score += 0.1;
        reasons.push(`Medium-risk pattern: "${pattern}"`);
      }
    }

    return {
      score: Math.min(1, score),
      reasoning: reasons.length > 0 ? reasons.join("; ") : "No suspicious patterns detected",
    };
  }

  // Never throws. Returns { ok, metaMessageId, httpStatus, metaErrorCode, errorCode, retryAfter }.
  // Only the numeric Graph error code is read from a failed response.
  async function sendWhatsAppMessage(to, text) {
    const token = process.env.WHATSAPP_API_TOKEN;
    const phoneNumberId = configuredPhoneNumberId();
    if (!token || !phoneNumberId) {
      return { ok: false, errorCode: "WA_NOT_CONFIGURED", metaMessageId: null, httpStatus: null, metaErrorCode: null };
    }
    const doFetch = options.fetch || fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    let response;
    try {
      response = await doFetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timer);
      const result = { ok: false, errorCode: "META_NETWORK", metaMessageId: null, httpStatus: null, metaErrorCode: null };
      logWhatsApp("error", "WhatsApp send failed", { errorCode: result.errorCode, to: phoneLast4(to) });
      return result;
    }
    clearTimeout(timer);
    let json = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    if (!response.ok) {
      const rawCode = json?.error?.code;
      const rawSub = json?.error?.error_subcode;
      const metaErrorCode = Number.isFinite(Number(rawCode)) && rawCode !== null ? Number(rawCode) : null;
      const metaErrorSubcode = Number.isFinite(Number(rawSub)) && rawSub !== null ? Number(rawSub) : null;
      const result = {
        ok: false,
        httpStatus: response.status,
        metaErrorCode,
        metaErrorSubcode,
        errorCode: mapGraphError({ httpStatus: response.status, code: metaErrorCode }),
        metaMessageId: null,
        retryAfter: response.headers?.get?.("retry-after") || null,
      };
      logWhatsApp("error", "WhatsApp send failed", {
        errorCode: result.errorCode,
        httpStatus: result.httpStatus,
        metaErrorCode,
        metaErrorSubcode,
        to: phoneLast4(to),
      });
      return result;
    }
    const metaMessageId = typeof json?.messages?.[0]?.id === "string" ? json.messages[0].id : null;
    logWhatsApp("info", "WhatsApp send ok", { metaMessageId, httpStatus: response.status, to: phoneLast4(to) });
    return { ok: true, metaMessageId, httpStatus: response.status, metaErrorCode: null, errorCode: null };
  }

  function deliveryMetadata(result) {
    return {
      metaMessageId: result.metaMessageId || null,
      deliveryStatus: result.ok ? "accepted" : result.errorCode === "WA_NOT_CONFIGURED" ? "not_sent" : "failed",
      errorCode: result.errorCode || null,
    };
  }

  async function trackReferral(prisma, contactId, referredUserId) {
    try {
      const referrer = await prisma.user.findFirst({
        where: { whatsappId: String(contactId) },
      });
      if (!referrer) return;

      const referral = await prisma.referral.upsert({
        where: { referrerId: referrer.id },
        create: {
          referrerId: referrer.id,
          count: 1,
          rewardClaimed: false,
        },
        update: {
          count: { increment: 1 },
        },
      });

      if (referral.count >= 3 && !referral.rewardClaimed) {
        // sendWhatsAppMessage logs its own success/failure and never throws.
        await sendWhatsAppMessage(
          contactId,
          "🎉 *Congratulations!* You've referred 3 landlords to Lodgist!\n\n" +
          "You've earned ₦1,000 escrow credit. Reply with CLAIM to activate.\n\n" +
          "Keep sharing — more referrals = more credits!"
        );
      }
    } catch (err) {
      logWhatsApp("error", "Referral tracking error", err instanceof Error ? err.message : "");
    }
  }

  router.get("/webhook", (req, res) => {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    if (!verifyToken) return res.sendStatus(403);
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === verifyToken) {
      logWhatsApp("info", "WhatsApp webhook verified");
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  router.post("/webhook", async (req, res) => {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();
    const perMessage = [];
    const finish = (status, fields) => {
      const metaMessageIds = perMessage.map((m) => m.metaMessageId).filter(Boolean);
      const msgTypes = [...new Set(perMessage.map((m) => m.msgType).filter(Boolean))];
      logWebhookEvent({
        requestId,
        ...(perMessage.length
          ? { messageCount: perMessage.length, metaMessageIds, msgTypes, messages: perMessage }
          : {}),
        ...fields,
        durationMs: Date.now() - startedAt,
      });
      return res.sendStatus(status);
    };

    try {
      if (process.env.WHATSAPP_APP_SECRET) {
        const sig = req.headers["x-hub-signature-256"];
        if (!verifyWebhookSignature(sig, req.body)) {
          return finish(403, {
            outcome: "rejected_signature",
            errorCode: sig ? "SIGNATURE_INVALID" : "SIGNATURE_MISSING",
          });
        }
      }

      const parsed = parseWebhookBody(req.body);
      if (!parsed) {
        return finish(200, { outcome: "ignored_unparseable", errorCode: "BODY_UNPARSEABLE" });
      }

      const entry = parsed?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const messages = value?.messages;
      const metadata = value?.metadata;

      if (!messages || !metadata) {
        if (Array.isArray(value?.statuses) && value.statuses.length) {
          const statuses = [...new Set(value.statuses.map((st) => String(st?.status || "unknown")))];
          const ids = value.statuses.map((st) => st?.id).filter((id) => typeof id === "string");
          return finish(200, {
            outcome: "ignored_status_update",
            statusCount: value.statuses.length,
            statuses,
            metaMessageIds: ids,
          });
        }
        return finish(200, { outcome: "ignored_no_messages", messageCount: 0 });
      }

      if (!inboundChangeIsForThisNumber(metadata)) {
        return finish(200, {
          outcome: "ignored_other_number",
          phoneNumberIdMatch: false,
          phoneNumberIdLast4: phoneLast4(metadata?.phone_number_id),
          configuredLast4: phoneLast4(configuredPhoneNumberId()),
          messageCount: Array.isArray(messages) ? messages.length : 0,
        });
      }

      const profileName = value?.contacts?.[0]?.profile?.name || null;

      for (const msg of messages) {
        const item = {
          metaMessageId: typeof msg?.id === "string" ? msg.id : null,
          msgType: typeof msg?.type === "string" ? msg.type : "text",
          phoneLast4: phoneLast4(msg?.from),
        };
        perMessage.push(item);
        if (msg.id) {
          if (seenMsgIds.has(msg.id)) {
            item.outcome = "ignored_duplicate";
            continue;
          }
          seenMsgIds.add(msg.id);
        }

        const from = msg.from;
        if (!from) {
          item.outcome = "ignored_no_sender";
          continue;
        }
        item.outcome = "error_internal";
        const msgText = msg.text?.body || "";
        const msgType = msg.type || "text";
        const timestamp = new Date(parseInt(msg.timestamp, 10) * 1000);
        const sentAt = Number.isNaN(timestamp.getTime()) ? new Date() : timestamp;

        const { phone, user: senderUser } = await resolveSender(prisma, from);
        item.isLead = !senderUser;
        if (!senderUser) {
          logWhatsApp("info", "Unknown WhatsApp sender entered lead flow", redactPhone(phone));
        }

        const session = await loadOrCreateSession(prisma, {
          user: senderUser,
          phone,
          profileName: msg.profile?.name || profileName,
        });
        const history = toHistory(session.messages);

        await prisma.whatsAppMessage.create({
          data: {
            sessionId: session.id,
            senderId: senderUser ? senderUser.id : null,
            content: msgText,
            messageType: String(msgType || "text").toUpperCase(),
            direction: "INBOUND",
            sentAt,
            metadata: { messageId: msg.id || null, type: msgType },
          },
        });

        const fraudResult = analyzeFraud(msgText);
        if (fraudResult.score > 0.8 && session.listingId && prisma.aIFraudSignal) {
          await prisma.aIFraudSignal.create({
            data: {
              listingId: session.listingId,
              score: fraudResult.score,
              reasoning: fraudResult.reasoning,
              metadata: { source: "whatsapp", messageId: msg.id },
            },
          });
          await prisma.listing.update({
            where: { id: session.listingId },
            data: { isFlaggedForFraud: true, fraudReason: fraudResult.reasoning },
          });
        }

        let replyText;
        let trackRefer = false;
        const rentalTurn =
          !isExactMenuCommand(msgText) && prisma.rentalCheckDraft && prisma.rentalCheck
            ? await handleRentalCheckMessage(prisma, {
                text: msgText,
                phone,
                user: senderUser,
                profileName: msg.profile?.name || profileName,
              })
            : { handled: false };
        if (rentalTurn.handled) {
          item.route = "rental_check";
          replyText = rentalTurn.replyText;
        } else if (isExactMenuCommand(msgText)) {
          item.route = "menu";
          const menu = await deterministicReply(prisma, { msgText, session, user: senderUser });
          replyText = menu.replyText;
          trackRefer = menu.trackRefer;
        } else {
          const routed = await routeTurn({
            prisma,
            text: msgText,
            session,
            user: senderUser,
            history,
            complete: options.complete,
          });
          item.aiOutcome = routed.aiOutcome;
          if (routed.reply) {
            item.route = "ai";
            replyText = routed.reply;
          } else {
            item.route = "menu";
            const menu = await deterministicReply(prisma, { msgText, session, user: senderUser });
            replyText = menu.replyText;
            trackRefer = menu.trackRefer;
          }
        }

        const sent = await sendWhatsAppMessage(from, replyText);
        const delivery = deliveryMetadata(sent);
        item.reply = {
          metaMessageId: sent.metaMessageId || undefined,
          httpStatus: sent.httpStatus || undefined,
          metaErrorCode: sent.metaErrorCode || undefined,
          deliveryStatus: delivery.deliveryStatus,
        };
        item.outcome = sent.ok
          ? "replied"
          : sent.errorCode === "WA_NOT_CONFIGURED"
            ? "reply_skipped_unconfigured"
            : "reply_failed";
        item.errorCode = sent.errorCode || null;

        await prisma.whatsAppMessage.create({
          data: {
            sessionId: session.id,
            senderId: senderUser ? senderUser.id : null,
            content: replyText,
            messageType: "TEXT",
            direction: "OUTBOUND",
            sentAt: new Date(),
            metadata: delivery,
          },
        });

        if (trackRefer && senderUser && sent.ok) {
          await trackReferral(prisma, from, senderUser.id);
        }
      }

      const outcome =
        OUTCOME_RANK.find((o) => perMessage.some((m) => m.outcome === o)) || "ignored_no_messages";
      const worst = perMessage.find((m) => m.outcome === outcome) || {};
      return finish(200, {
        outcome,
        phoneLast4: worst.phoneLast4,
        isLead: worst.isLead,
        route: worst.route,
        aiOutcome: worst.aiOutcome,
        reply: worst.reply,
        errorCode: worst.errorCode || null,
      });
    } catch (error) {
      const errorCode = dbOrInternal(error);
      const current = perMessage[perMessage.length - 1];
      if (current) {
        current.outcome = "error_internal";
        current.errorCode = errorCode;
      }
      return finish(200, { outcome: "error_internal", errorCode });
    }
  });

  router.get("/sessions/:userId", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid userId" });
      }

      if (req.user.id !== userId && req.user.role !== "STUDIO_ADMIN") {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      const sessions = await prisma.whatsAppSession.findMany({
        where: {
          userId,
          isActive: true,
        },
        include: {
          messages: {
            orderBy: { sentAt: "desc" },
            take: 50,
          },
          listing: true,
        },
        orderBy: { updatedAt: "desc" },
      });
      res.json({ success: true, data: sessions });
    } catch (error) {
      logWhatsApp("error", "Error fetching sessions", error instanceof Error ? error.message : "");
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post("/send", requireAuth, async (req, res) => {
    if (req.user.role !== "STUDIO_ADMIN") {
      return res.status(403).json({ success: false, error: "Forbidden: STUDIO_ADMIN only" });
    }

    try {
      const { to, message, sessionId } = req.body;
      if (!to || !message) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Missing required fields: to, message",
          });
      }

      const sent = await sendWhatsAppMessage(to, message);
      if (sent.errorCode === "WA_NOT_CONFIGURED") {
        return res.status(503).json({ success: false, errorCode: "WA_NOT_CONFIGURED" });
      }

      let recorded = true;
      if (sessionId) {
        try {
          await prisma.whatsAppMessage.create({
            data: {
              sessionId,
              senderId: req.user.id,
              content: message,
              messageType: "TEXT",
              direction: "OUTBOUND",
              sentAt: new Date(),
              metadata: deliveryMetadata(sent),
            },
          });
        } catch (dbError) {
          recorded = false;
          logWhatsApp("error", "WhatsApp /send record failed", { errorCode: dbOrInternal(dbError) });
        }
      }

      if (!sent.ok) {
        if (sent.retryAfter) res.set("Retry-After", String(sent.retryAfter));
        return res.status(SEND_STATUS[sent.errorCode] || 502).json({ success: false, errorCode: sent.errorCode });
      }
      const body = { success: true, metaMessageId: sent.metaMessageId };
      if (!recorded) body.recorded = false;
      return res.json(body);
    } catch (error) {
      logWhatsApp("error", "Error sending WhatsApp message", { errorCode: dbOrInternal(error) });
      return res.status(500).json({ success: false, errorCode: "INTERNAL" });
    }
  });

  return router;
};

module.exports.sitePath = sitePath;
module.exports.listingsReply = listingsReply;
