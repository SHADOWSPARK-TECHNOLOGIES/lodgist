const express = require("express");
const crypto = require("crypto");
const { requireAuth } = require("../middleware/auth");
const { parseWebhookBody } = require("./whatsappParse");

/**
 * Create an Express router for WhatsApp webhook and messaging endpoints.
 * Accepts a `prisma` instance for testability.
 *
 * @param {object} prisma - Prisma client instance
 * @returns {import("express").Router}
 */
// Meta WhatsApp Cloud API. Required env names (set in the host, never in code):
// WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN,
// WHATSAPP_APP_SECRET, WHATSAPP_PUBLIC_URL
function sitePath(path) {
  const base = String(process.env.WHATSAPP_PUBLIC_URL || "").trim().replace(/\/$/, "");
  if (!base) return "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function visit(path, fallback) {
  const url = sitePath(path);
  return url ? `Visit ${url}` : fallback;
}

function listingsReply() {
  return (
    "Homes show on Lodgist only after they are checked.\n\n" +
    `${visit("/listings", "Open Lodgist and browse homes.")}\n\n` +
    "If that list is empty, there are no verified homes yet."
  );
}

module.exports = function (prisma) {
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
      const error = await response.text();
      console.error("WhatsApp API error:", error);
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
      console.error("Referral tracking error:", err);
    }
  }

  router.get("/webhook", (req, res) => {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    if (!verifyToken) return res.sendStatus(403);
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === verifyToken) {
      console.log("WhatsApp webhook verified");
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  router.post("/webhook", async (req, res) => {
    try {
      if (process.env.WHATSAPP_APP_SECRET) {
        const sig = req.headers["x-hub-signature-256"];
        if (!verifyWebhookSignature(sig, req.body)) {
          console.error("Invalid webhook signature");
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

      for (const msg of messages) {
        if (msg.id) {
          if (seenMsgIds.has(msg.id)) continue;
          seenMsgIds.add(msg.id);
        }

        const from = msg.from;
        const msgText = msg.text?.body || "";
        const msgType = msg.type || "text";
        const timestamp = new Date(parseInt(msg.timestamp) * 1000);

        const senderUser = await prisma.user.findFirst({
          where: { phone: from },
        });

        if (!senderUser) {
          console.log(`Unknown sender (phone: ${from}), skipping`);
          continue;
        }

        let session = await prisma.whatsAppSession.findFirst({
          where: {
            contactId: senderUser.id,
            isActive: true,
          },
          include: {
            listing: true,
            user: true,
          },
          orderBy: { createdAt: "desc" },
        });

        if (!session) {
          session = await prisma.whatsAppSession.create({
            data: {
              userId: senderUser.id,
              contactId: senderUser.id,
              contactName: msg.profile?.name || senderUser.name || "Unknown",
              platform: "whatsapp",
              isActive: true,
            },
            include: { listing: true, user: true },
          });
        }

        await prisma.whatsAppMessage.create({
          data: {
            sessionId: session.id,
            senderId: senderUser.id,
            content: msgText,
            messageType: msgType.toUpperCase(),
            direction: "INBOUND",
            sentAt: timestamp,
            metadata: msg,
          },
        });

        const fraudResult = analyzeFraud(msgText);
        if (fraudResult.score > 0.8 && session.listingId) {
          await prisma.aIFraudSignal.create({
            data: {
              listingId: session.listingId,
              score: fraudResult.score,
              reasoning: fraudResult.reasoning,
              metadata: { source: "whatsapp", messageId: msg.id, from },
            },
          });
          await prisma.listing.update({
            where: { id: session.listingId },
            data: { isFlaggedForFraud: true, fraudReason: fraudResult.reasoning },
          });
        }

        let replyText =
          "Thank you for your message. A Lodgist agent will get back to you shortly.";

        if (
          msgText.toLowerCase().includes("hello") ||
          msgText.toLowerCase().includes("hi")
        ) {
          replyText =
            "👋 *Welcome to Lodgist!* Nigeria's Most Trusted Property Platform.\n\n" +
            "Reply with:\n" +
            "1️⃣ *Listings* — Browse available properties\n" +
            "2️⃣ *My Bookings* — Check your bookings\n" +
            "3️⃣ *Talk to Agent* — Speak with a human\n" +
            "4️⃣ *Refer* — Invite 3 landlords, get ₦1,000 escrow credit!";
        } else if (
          msgText === "1" ||
          msgText.toLowerCase().includes("listing")
        ) {
          replyText = listingsReply();
        } else if (
          msgText === "2" ||
          msgText.toLowerCase().includes("booking")
        ) {
          replyText =
            "Your bookings\n\n" +
            `${visit("/dashboard", "Open your Lodgist dashboard to see bookings.")}\n\n` +
            "Need help? Reply with your booking reference.";
        } else if (
          msgText === "3" ||
          msgText.toLowerCase().includes("agent")
        ) {
          replyText =
            "👨‍💼 *Connect with an Agent*\n\n" +
            "An agent will be with you shortly. Your reference ID is: `" +
            (session?.id || "N/A") + "`\n\n" +
            visit("/listings", "Browse homes on Lodgist. Only checked homes are listed.");
        } else if (
          msgText.toLowerCase() === "4" ||
          msgText.toLowerCase().includes("refer")
        ) {
          replyText =
            "🎁 *Referral Program*\n\n" +
            "Share Lodgist with 3 landlord friends and earn ₦1,000 escrow credit!\n\n" +
            "How it works:\n" +
            "1. Forward this message to 3 landlords\n" +
            (sitePath("/register")
              ? `2. They sign up at ${sitePath("/register")}\n`
              : "2. They sign up on Lodgist\n") +
            "3. You get ₦1,000 credit when they list their first property\n\n" +
            "Reply CLAIM when you've referred 3 people!";
        } else if (msgText.toLowerCase() === "claim") {
          const referral = await prisma.referral.findUnique({
            where: { referrerId: senderUser.id },
          });
          if (referral && referral.count >= 3 && !referral.rewardClaimed) {
            await prisma.referral.update({
              where: { referrerId: senderUser.id },
              data: { rewardClaimed: true },
            });
            replyText =
              "✅ *Reward Claimed!*\n\n" +
              "₦1,000 escrow credit has been added to your account. " +
              "Use it on your next booking at Lodgist.\n\n" +
              "Keep referring — more credits await! 🚀";
          } else if (referral && referral.count < 3) {
            replyText =
              `📊 You've referred ${referral.count}/3 landlords. ` +
              `Share Lodgist with ${3 - referral.count} more to earn ₦1,000!`;
          } else {
            replyText =
              "No referrals found yet. Share Lodgist with 3 landlords to earn ₦1,000 escrow credit!";
          }
        } else if (
          msgText.toLowerCase().includes("lagos") ||
          msgText.toLowerCase().includes("abuja") ||
          msgText.toLowerCase().includes("owerri") ||
          msgText.toLowerCase().includes("portharcourt") ||
          msgText.toLowerCase().includes("port harcourt")
        ) {
          const city = msgText.trim();
          const cityPath = `/listings?search=${encodeURIComponent(city)}`;
          replyText =
            `Looking in ${city}.\n\n` +
            `${visit(cityPath, "Open Lodgist and search that area.")}\n\n` +
            "Homes appear there only after they are checked.";
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
            senderId: senderUser.id,
            content: replyText,
            messageType: "TEXT",
            direction: "OUTBOUND",
            sentAt: new Date(),
          },
        });

        if (msgText.toLowerCase().includes("refer") || msgText.toLowerCase() === "4") {
          await trackReferral(prisma, from, senderUser.id);
        }
      }

      return res.sendStatus(200);
    } catch (error) {
      console.error("WhatsApp webhook error:", error);
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
      console.error("Error fetching sessions:", error);
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
      console.error("Error sending WhatsApp message:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
};

module.exports.sitePath = sitePath;
module.exports.listingsReply = listingsReply;
