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
    "The public list is Lodgist-reviewed homes, not samples. Review is not verification, so they say Not verified by Lodgist. Viewing is only for verified homes.\n\n" +
    `${visit("/listings", "Open Lodgist and browse homes.")}\n\n` +
    "If that list is empty, there are no published homes yet."
  );
}

function welcomeReply() {
  return (
    "👋 *Welcome to Lodgist!* Nigeria's Most Trusted Property Platform.\n\n" +
    "Reply with:\n" +
    "CHECK — Check a rental before you pay (₦5,000)\n" +
    "1️⃣ *Listings* — Browse available properties\n" +
    "2️⃣ *My Bookings* — Check your bookings\n" +
    "3️⃣ *Talk to Agent* — Speak with a human\n" +
    "4️⃣ *Refer* — Invite 3 landlords, get ₦1,000 escrow credit!"
  );
}

function isExactMenuCommand(msgText) {
  const exact = String(msgText || "").trim().toLowerCase();
  return exact === "1" || exact === "2" || exact === "3" || exact === "4" || exact === "claim";
}

/**
 * Existing keyword menu. Used for exact menu keys, and as the fallback when
 * Gemini and Claude are unavailable or return an invalid intent.
 */
async function deterministicReply(prisma, { msgText, session, user }) {
  let replyText = "Thank you for your message. A Lodgist agent will get back to you shortly.";
  let trackRefer = false;
  const text = String(msgText || "");
  const lower = text.toLowerCase();

  if (lower.includes("hello") || lower.includes("hi")) {
    replyText = welcomeReply();
  } else if (text === "1" || lower.includes("listing")) {
    replyText = listingsReply();
  } else if (text === "2" || lower.includes("booking")) {
    replyText =
      "Your bookings\n\n" +
      `${visit("/dashboard", "Open your Lodgist dashboard to see bookings.")}\n\n` +
      "Need help? Reply with your booking reference.";
  } else if (text === "3" || lower.includes("agent")) {
    replyText =
      "👨‍💼 *Connect with an Agent*\n\n" +
      "An agent will be with you shortly. Your reference ID is: `" +
      (session?.id || "N/A") + "`\n\n" +
      visit("/listings", "Browse homes on Lodgist. Unverified homes say Not verified by Lodgist.");
  } else if (lower === "4" || lower.includes("refer")) {
    trackRefer = true;
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
  } else if (lower === "claim") {
    if (!user) {
      replyText =
        "No referrals found yet. Share Lodgist with 3 landlords to earn ₦1,000 escrow credit!";
    } else {
      const referral = await prisma.referral.findUnique({
        where: { referrerId: user.id },
      });
      if (referral && referral.count >= 3 && !referral.rewardClaimed) {
        await prisma.referral.update({
          where: { referrerId: user.id },
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
    }
  } else if (
    lower.includes("lagos") ||
    lower.includes("abuja") ||
    lower.includes("owerri") ||
    lower.includes("portharcourt") ||
    lower.includes("port harcourt")
  ) {
    const city = text.trim();
    const cityPath = `/listings?search=${encodeURIComponent(city)}`;
    replyText =
      `Looking in ${city}.\n\n` +
      `${visit(cityPath, "Open Lodgist and search that area.")}\n\n` +
      "Homes appear there only after they are checked.";
  }

  return { replyText, trackRefer };
}

module.exports = {
  sitePath,
  listingsReply,
  welcomeReply,
  isExactMenuCommand,
  deterministicReply,
};
