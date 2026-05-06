/**
 * geminiService.js
 *
 * Google Gemini AI service for Lodgist's Trust & Safety features.
 * Uses @google/genai SDK with gemini-1.5-flash model.
 *
 * All functions have graceful fallbacks when the API key is not configured.
 *
 * @module geminiService
 */

let GoogleGenAI;
try {
  GoogleGenAI = require("@google/genai").GoogleGenAI;
} catch {
  // Package not installed — will use fallbacks
}

const GEMINI_MODEL = "gemini-1.5-flash";

/**
 * Get a configured Gemini client, or null if the API key is missing.
 * @returns {GoogleGenAI|null}
 */
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !GoogleGenAI) return null;
  try {
    return new GoogleGenAI({ apiKey });
  } catch {
    return null;
  }
}

/**
 * Analyze a listing image for visual fraud indicators.
 * @param {string} imageBase64 - Base64-encoded image data
 * @returns {Promise<{ risk_score: number, red_flags: string[], summary: string }>}
 */
async function analyzeVisualFraud(imageBase64) {
  const client = getGeminiClient();
  if (!client) {
    return {
      risk_score: 0,
      red_flags: [],
      summary:
        "Visual fraud analysis is unavailable. The Gemini API key has not been configured.",
    };
  }

  try {
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageBase64,
              },
            },
            {
              text: `Analyze this property image for potential fraud indicators common in Nigerian rental scams. Return JSON with: risk_score (0-100), red_flags (array of strings), summary (string). Look for: stock photos, watermarks from other sites, digitally altered images, inconsistent property features, reused images across different listings.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 512,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty Gemini response");
    return JSON.parse(text);
  } catch (err) {
    console.error("Gemini visual analysis failed:", err.message);
    return {
      risk_score: 0,
      red_flags: [],
      summary: "Visual analysis encountered an error. Please try again.",
    };
  }
}

/**
 * Analyze listing text for scam indicators using Gemini.
 * @param {string} title - Listing title
 * @param {string} description - Listing description
 * @returns {Promise<{ risk_score: number, red_flags: string[], summary: string }>}
 */
async function analyzeScamText(title, description) {
  const client = getGeminiClient();
  if (!client) {
    return {
      risk_score: 0,
      red_flags: [],
      summary:
        "AI scam analysis is unavailable. The Gemini API key has not been configured.",
    };
  }

  const fullText = `Title: ${title || "(no title)"}\n\nDescription: ${description || "(no description)"}`;

  try {
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are Lodgist's Trust & Safety AI. Analyze this Nigerian rental listing for scam indicators.

Return JSON with:
- risk_score (0-100)
- red_flags (array of strings)
- summary (string)

Watch for: inspection/viewing fees before viewing, payment before meeting, below-market prices, pressure tactics, refusal of in-person viewing, Western Union/crypto requests, "landlord out of country" claims, stock photos, vague details, early document requests.

Listing:\n\n${fullText}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 512,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty Gemini response");
    return JSON.parse(text);
  } catch (err) {
    console.error("Gemini scam analysis failed:", err.message);
    return {
      risk_score: 0,
      red_flags: [],
      summary: "AI analysis encountered an error. Please try again.",
    };
  }
}

/**
 * Extract structured information from a land document image using OCR.
 * @param {string} imageBase64 - Base64-encoded document image
 * @returns {Promise<{ success: boolean, extracted: object, raw_text: string }>}
 */
async function extractLandDocument(imageBase64) {
  const client = getGeminiClient();
  if (!client) {
    return {
      success: false,
      extracted: {},
      raw_text: "",
    };
  }

  try {
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageBase64,
              },
            },
            {
              text: `Extract all text from this land document image. Then parse it into structured JSON with fields: document_type, plot_number, owner_name, location, date_issued, issuing_authority, is_valid (boolean), confidence (0-100). Return JSON only.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty Gemini response");
    const parsed = JSON.parse(text);
    return {
      success: true,
      extracted: parsed,
      raw_text: text,
    };
  } catch (err) {
    console.error("Gemini document extraction failed:", err.message);
    return {
      success: false,
      extracted: {},
      raw_text: "",
    };
  }
}

/**
 * Detect chat-based fraud patterns in a conversation.
 * @param {Array<{ role: string, content: string }>} messages - Chat messages
 * @returns {Promise<{ is_fraud: boolean, risk_score: number, red_flags: string[], explanation: string }>}
 */
async function detectChatFraud(messages) {
  const client = getGeminiClient();
  if (!client) {
    return {
      is_fraud: false,
      risk_score: 0,
      red_flags: [],
      explanation: "Chat fraud detection is unavailable.",
    };
  }

  const chatLog = messages
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join("\n");

  try {
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Analyze this chat conversation between a tenant and landlord/agent for Nigerian rental fraud patterns.

Return JSON with:
- is_fraud (boolean)
- risk_score (0-100)
- red_flags (array of strings)
- explanation (string)

Watch for: pressure to pay before viewing, requests for "inspection fees", reluctance to show property, excuses for not meeting in person, requests for passport/bank details early, urgency tactics, claims of being abroad.

Chat:\n\n${chatLog}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 512,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty Gemini response");
    return JSON.parse(text);
  } catch (err) {
    console.error("Gemini chat fraud detection failed:", err.message);
    return {
      is_fraud: false,
      risk_score: 0,
      red_flags: [],
      explanation: "Chat analysis encountered an error.",
    };
  }
}

/**
 * Generate an artisan audit report from transaction data.
 * @param {object} artisanData - Artisan profile and transaction history
 * @returns {Promise<{ rating: number, verified: boolean, summary: string, recommendations: string[] }>}
 */
async function auditArtisan(artisanData) {
  const client = getGeminiClient();
  if (!client) {
    return {
      rating: 0,
      verified: false,
      summary: "Artisan audit is unavailable.",
      recommendations: [],
    };
  }

  try {
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are Lodgist's Artisan Verification AI. Analyze this artisan's profile and transaction history for trustworthiness.

Return JSON with:
- rating (0-100)
- verified (boolean)
- summary (string)
- recommendations (array of strings)

Artisan Data: ${JSON.stringify(artisanData)}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 512,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty Gemini response");
    return JSON.parse(text);
  } catch (err) {
    console.error("Gemini artisan audit failed:", err.message);
    return {
      rating: 0,
      verified: false,
      summary: "Artisan audit encountered an error.",
      recommendations: [],
    };
  }
}

module.exports = {
  analyzeVisualFraud,
  analyzeScamText,
  extractLandDocument,
  detectChatFraud,
  auditArtisan,
};
