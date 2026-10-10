const { SYSTEM_PROMPT } = require("./intents");
const { logWhatsApp } = require("./redact");

const GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_CLAUDE_MODEL = "claude-opus-4-8";

function historyTranscript(history, userText) {
  const lines = (history || []).map((turn) => {
    const role = turn.role === "assistant" ? "Assistant" : "User";
    return `${role}: ${String(turn.content || "").slice(0, 500)}`;
  });
  lines.push(`User: ${String(userText || "").slice(0, 1000)}`);
  return lines.join("\n");
}

function geminiConfigured() {
  return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCP_PROJECT_ID);
}

function readGeminiText(result) {
  const parts = result?.response?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || "").join("").trim();
}

async function tryGemini({ system, history, userText }) {
  if (!geminiConfigured()) return null;
  let VertexAI;
  try {
    VertexAI = require("@google-cloud/vertexai").VertexAI;
  } catch (err) {
    logWhatsApp("error", "Gemini SDK unavailable", err instanceof Error ? err.message : "");
    return null;
  }

  try {
    const project = process.env.GCP_PROJECT_ID || "shadowspark-production-489115";
    const location = process.env.GCP_PROJECT_LOCATION || "us-central1";
    const googleAuthOptions = {
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    };
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      googleAuthOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    const vertex = new VertexAI({ project, location, googleAuthOptions });
    const model = vertex.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
      },
      systemInstruction: {
        role: "system",
        parts: [{ text: system }],
      },
    });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: historyTranscript(history, userText) }] }],
    });
    return readGeminiText(result) || null;
  } catch (err) {
    logWhatsApp("error", "Gemini request failed", err instanceof Error ? err.message : "");
    return null;
  }
}

function anthropicMessages(history, userText) {
  const turns = [];
  for (const turn of history || []) {
    const role = turn.role === "assistant" ? "assistant" : "user";
    const content = String(turn.content || "").slice(0, 500);
    if (!content) continue;
    const prev = turns[turns.length - 1];
    if (prev && prev.role === role) prev.content = `${prev.content}\n${content}`;
    else turns.push({ role, content });
  }
  const current = String(userText || "").slice(0, 1000);
  const prev = turns[turns.length - 1];
  if (prev && prev.role === "user") prev.content = `${prev.content}\n${current}`;
  else turns.push({ role: "user", content: current });
  if (turns[0]?.role === "assistant") {
    turns.unshift({ role: "user", content: "(earlier context)" });
  }
  return turns;
}

async function tryClaude({ system, history, userText }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_CLAUDE_MODEL;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        system,
        messages: anthropicMessages(history, userText),
      }),
    });
    if (!response.ok) {
      logWhatsApp("error", "Claude fallback failed", { status: response.status });
      return null;
    }
    const data = await response.json();
    const text = (data.content || [])
      .filter((block) => block && block.type === "text")
      .map((block) => block.text || "")
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    logWhatsApp("error", "Claude fallback failed", err instanceof Error ? err.message : "");
    return null;
  }
}

/**
 * Gemini 2.5 Flash is primary. Claude is used only when ANTHROPIC_API_KEY is
 * set and Gemini is unconfigured or fails. Throws when neither returns text
 * so the caller can use the deterministic menu.
 */
async function defaultComplete({ system = SYSTEM_PROMPT, history, userText }) {
  const gemini = await tryGemini({ system, history, userText });
  if (gemini) return gemini;
  const claude = await tryClaude({ system, history, userText });
  if (claude) return claude;
  const error = new Error("AI provider not configured");
  error.code = "AI_UNAVAILABLE";
  throw error;
}

module.exports = {
  GEMINI_MODEL,
  DEFAULT_CLAUDE_MODEL,
  defaultComplete,
  tryGemini,
  tryClaude,
  geminiConfigured,
};
