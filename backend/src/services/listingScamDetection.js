const OpenAI = require("openai");

/**
 * Nigerian rental scam red-flag keywords and patterns.
 * These are checked client-side as a fast pre-filter before the AI call.
 */
const SCAM_KEYWORDS = [
  "inspection fee",
  "inspection fees",
  "agency fee",
  "agency fees",
  "viewing fee",
  "viewing fees",
  "payment before viewing",
  "payment before inspection",
  "pay before you see",
  "pay before viewing",
  "pay before inspection",
  "refundable deposit to view",
  "processing fee for viewing",
  "booking fee to view",
  "key deposit before viewing",
  "advance fee for listing",
  "money before meeting",
  "payment before meeting",
  "wire transfer to agent",
  "western union deposit",
];

/**
 * Initialize the OpenAI client.
 * Expects `OPENAI_API_KEY` in the environment.
 */
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Please set it in your environment variables."
    );
  }
  return new OpenAI({ apiKey });
}

/**
 * Run a fast keyword-based pre-check against the listing text.
 * Returns any keywords that were matched.
 *
 * @param {string} text - The listing description to scan.
 * @returns {string[]} - List of matched scam keywords.
 */
function keywordPreCheck(text) {
  const lower = text.toLowerCase();
  return SCAM_KEYWORDS.filter((keyword) => lower.includes(keyword));
}

/**
 * Analyze a listing description using the OpenAI API to detect potential
 * rental scams common in Nigeria.
 *
 * The response includes:
 *  - `risk_score` (0–100): how likely the listing is a scam
 *  - `red_flags`: an array of specific concerns found
 *  - `summary`: a human-readable explanation in Lodgist's brand tone
 *
 * @param {object} listing - The listing object with at least `title` and `description`.
 * @param {string} listing.title - The listing title.
 * @param {string} listing.description - The listing description/body.
 * @returns {Promise<{ risk_score: number, red_flags: string[], summary: string }>}
 */
async function analyzeListing(listing) {
  const { title, description } = listing;

  if (!title && !description) {
    return {
      risk_score: 0,
      red_flags: [],
      summary:
        "No listing content provided to analyze. Please provide a title and description.",
    };
  }

  // Combine title + description for analysis
  const fullText = `Title: ${title || "(no title)"}\n\nDescription: ${description || "(no description)"}`;

  // 1. Fast keyword pre-check
  const matchedKeywords = keywordPreCheck(fullText);

  // 2. AI-powered analysis
  const client = getOpenAIClient();

  const systemPrompt = `You are Lodgist's Trust & Safety AI assistant. Your role is to analyze rental property listings for potential scams, with a focus on schemes common in Nigeria.

Analyze the listing and return a JSON object with exactly these fields:
- "risk_score": a number from 0 to 100 indicating how likely this is a scam
- "red_flags": an array of strings, each describing a specific concern found
- "summary": a brief, helpful explanation written in a trustworthy and informative tone

Common Nigerian rental scam patterns to watch for:
- Requests for "inspection fees", "viewing fees", or "agency fees" before a property is seen
- Demands for payment before meeting the landlord or agent
- Prices that are suspiciously below market rate
- Pressure tactics like "many people are interested, pay now to secure it"
- Listings that refuse in-person viewing
- Requests for payment via Western Union, wire transfer, or cryptocurrency
- Landlord/agent who claims to be "out of the country" and needs payment upfront
- Duplicate or stock photos used in the listing
- Vague or inconsistent property details
- Requests for personal documents (passport, bank details) early in the process

Be thorough but fair — not every listing with a request is a scam. Use your judgment and explain your reasoning clearly.`;

  const userPrompt = `Please analyze this rental listing for potential scam indicators:\n\n${fullText}`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned an empty response");
    }

    const parsed = JSON.parse(content);

    // Merge keyword matches into the red_flags if not already present
    const allRedFlags = [...(parsed.red_flags || [])];
    for (const keyword of matchedKeywords) {
      const flag = `Listing contains a known scam keyword: "${keyword}".`;
      if (!allRedFlags.some((f) => f.toLowerCase().includes(keyword.toLowerCase()))) {
        allRedFlags.unshift(flag);
      }
    }

    return {
      risk_score: Math.max(0, Math.min(100, parsed.risk_score || 0)),
      red_flags: allRedFlags,
      summary:
        parsed.summary ||
        "Analysis complete. No specific concerns were identified.",
    };
  } catch (err) {
    // If OpenAI fails, fall back to keyword-only analysis
    console.error("OpenAI analysis failed, falling back to keyword check:", err.message);

    if (matchedKeywords.length > 0) {
      return {
        risk_score: Math.min(100, matchedKeywords.length * 25),
        red_flags: matchedKeywords.map(
          (kw) => `Listing contains a known scam keyword: "${kw}".`
        ),
        summary:
          "We were unable to perform a full AI analysis at this time, but our automated keyword scan detected some patterns commonly associated with rental scams. Please exercise caution and verify the listing before proceeding.",
      };
    }

    return {
      risk_score: 0,
      red_flags: [],
      summary:
        "We were unable to complete the full AI analysis at this time. No obvious scam keywords were detected in the listing. We recommend still exercising standard caution when engaging with new listings.",
    };
  }
}

module.exports = { analyzeListing, keywordPreCheck, SCAM_KEYWORDS };
