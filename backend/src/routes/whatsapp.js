const express = require("express");
const crypto = require("crypto");
const { requireAuth } = require("../middleware/auth");
const { parseWebhookBody } = require("./whatsappParse");
const { sitePath, listingsReply, isExactMenuCommand, deterministicReply } = require("../services/whatsapp/menu");
const { routeTurn, resolveSender, loadOrCreateSession, toHistory } = require("../services/whatsapp/engine");
const { logWhatsApp, redactPhone } = require("../services/whatsapp/redact");
const { handleWhatsAppRentalCheck } = require("../services/rentalCheck");

/**
 * Create an Express router for WhatsApp webhook and messaging endpoints.
 * Accepts a `prisma` instance for testability.
 *
 * Flow: Meta webhook → HMAC → msg.id dedupe → session (User or lead) →
 * Gemini intent router (menu fallback) → Lodgist tools → Meta send.
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

  async function sendWhatsAppMessage(to, text) {
    const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });

    if (!response.ok) {
      logWhatsApp("error", "WhatsApp API error", { status: response.status });
      throw new Error(`WhatsApp API error: ${response.status}`);
    }

    return response.json();
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
    try {
      if (process.env.WHATSAPP_APP_SECRET) {
        const sig = req.headers["x-hub-signature-256"];
        if (!verifyWebhookSignature(sig, req.body)) {
          logWhatsApp("error", "Invalid webhook signature");
          return res.sendStatus(403);
        }
      }

      const parsed = parseWebhookBody(req.body);
      if (!parsed) {
        return res.sendStatus(200);
      }

      const entry = parsed?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const messages = value?.messages;
      const metadata = value?.metadata;

      if (!messages || !metadata) {
        return res.sendStatus(200);
      }

      const profileName = value?.contacts?.[0]?.profile?.name || null;

      for (const msg of messages) {
        if (msg.id) {
          if (seenMsgIds.has(msg.id)) continue;
          seenMsgIds.add(msg.id);
        }

        const from = msg.from;
        if (!from) continue;
        const msgText = msg.text?.body || "";
        const msgType = msg.type || "text";
        const timestamp = new Date(parseInt(msg.timestamp, 10) * 1000);
        const sentAt = Number.isNaN(timestamp.getTime()) ? new Date() : timestamp;

        const { phone, user: senderUser } = await resolveSender(prisma, from);
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
        const rentalTurn = await handleWhatsAppRentalCheck(prisma, {
          text: msgText,
          phone,
          session,
        });
        if (rentalTurn.context !== undefined && prisma.whatsAppSession && prisma.whatsAppSession.update) {
          await prisma.whatsAppSession.update({
            where: { id: session.id },
            data: { context: rentalTurn.context },
          });
          session.context = rentalTurn.context;
        }
        if (rentalTurn.handled) {
          replyText = rentalTurn.reply;
        } else if (isExactMenuCommand(msgText)) {
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
          if (routed.reply) {
            replyText = routed.reply;
          } else {
            const menu = await deterministicReply(prisma, { msgText, session, user: senderUser });
            replyText = menu.replyText;
            trackRefer = menu.trackRefer;
          }
        }

        if (
          process.env.WHATSAPP_API_TOKEN &&
          process.env.WHATSAPP_PHONE_NUMBER_ID
        ) {
          await sendWhatsAppMessage(from, replyText);
        }

        await prisma.whatsAppMessage.create({
          data: {
            sessionId: session.id,
            senderId: senderUser ? senderUser.id : null,
            content: replyText,
            messageType: "TEXT",
            direction: "OUTBOUND",
            sentAt: new Date(),
          },
        });

        if (trackRefer && senderUser) {
          await trackReferral(prisma, from, senderUser.id);
        }
      }

      return res.sendStatus(200);
    } catch (error) {
      logWhatsApp("error", "WhatsApp webhook error", error instanceof Error ? error.message : "");
      return res.sendStatus(200);
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

      if (
        process.env.WHATSAPP_API_TOKEN &&
        process.env.WHATSAPP_PHONE_NUMBER_ID
      ) {
        await sendWhatsAppMessage(to, message);
      }

      if (sessionId) {
        await prisma.whatsAppMessage.create({
          data: {
            sessionId,
            senderId: req.user.id,
            content: message,
            messageType: "TEXT",
            direction: "OUTBOUND",
            sentAt: new Date(),
          },
        });
      }

      res.json({ success: true });
    } catch (error) {
      logWhatsApp("error", "Error sending WhatsApp message", error instanceof Error ? error.message : "");
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
};

module.exports.sitePath = sitePath;
module.exports.listingsReply = listingsReply;
