const SECRET_ENV_NAMES = [
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_API_TOKEN",
  "WHATSAPP_VERIFY_TOKEN",
  "ANTHROPIC_API_KEY",
  "GCP_PROJECT_ID",
];

function redactSecrets(value) {
  let text = typeof value === "string" ? value : safeStringify(value);
  if (!text) return "";
  for (const name of SECRET_ENV_NAMES) {
    const secret = process.env[name];
    if (typeof secret === "string" && secret.length >= 4) {
      text = text.split(secret).join(`[redacted:${name}]`);
    }
  }
  return text;
}

function safeStringify(value) {
  try {
    if (value instanceof Error) return value.message || value.name;
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function redactPhone(phone) {
  const value = String(phone || "");
  if (value.length <= 4) return "****";
  return `****${value.slice(-4)}`;
}

function logWhatsApp(level, message, detail) {
  const line = redactSecrets(message);
  const extra = detail === undefined ? "" : ` ${redactSecrets(detail)}`;
  const logger = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  logger(`[WhatsApp] ${line}${extra}`);
}

function phoneLast4(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

// Map a Graph API failure to a normalized code. Only the HTTP status and the
// numeric Graph error code are used; the response body is never logged.
function mapGraphError({ httpStatus, code } = {}) {
  const c = Number(code);
  if (httpStatus === 401 || httpStatus === 403 || c === 190) return "META_AUTH";
  if (httpStatus === 429 || [4, 80007, 130429].includes(c)) return "META_RATE_LIMIT";
  if ([131026, 131047, 131051].includes(c)) return "META_RECIPIENT";
  if (httpStatus >= 500) return "META_SERVER";
  return "META_BAD_REQUEST";
}

const EVENT_KEYS = [
  "evt", "ts", "requestId", "outcome", "metaMessageIds", "phoneLast4", "msgTypes",
  "messageCount", "statusCount", "statuses", "phoneNumberIdLast4", "configuredLast4",
  "phoneNumberIdMatch", "isLead", "route", "aiOutcome", "reply", "messages", "errorCode",
  "durationMs",
];
const REPLY_KEYS = ["metaMessageId", "httpStatus", "metaErrorCode", "errorCode", "deliveryStatus"];
const MESSAGE_KEYS = ["metaMessageId", "phoneLast4", "msgType", "outcome", "isLead", "route", "aiOutcome", "reply", "errorCode"];

function pick(obj, keys) {
  const out = {};
  if (!obj || typeof obj !== "object") return out;
  for (const key of keys) if (obj[key] !== undefined) out[key] = obj[key];
  return out;
}

function sanitizeEvent(fields) {
  const event = pick(fields, EVENT_KEYS);
  if (event.reply) event.reply = pick(event.reply, REPLY_KEYS);
  if (Array.isArray(event.messages)) {
    event.messages = event.messages.map((m) => {
      const out = pick(m, MESSAGE_KEYS);
      if (out.reply) out.reply = pick(out.reply, REPLY_KEYS);
      return out;
    });
  }
  return event;
}

// One structured, redacted line: `[WhatsAppEvent] {json}`. Unknown keys are dropped.
function logWebhookEvent(fields) {
  const event = { evt: "whatsapp_webhook", ts: new Date().toISOString(), ...sanitizeEvent(fields) };
  if (event.errorCode === undefined) event.errorCode = null;
  const line = redactSecrets(event);
  const isError = typeof event.outcome === "string" && event.outcome.startsWith("error_");
  (isError ? console.error : console.log)(`[WhatsAppEvent] ${line}`);
  return event;
}

module.exports = {
  SECRET_ENV_NAMES,
  phoneLast4,
  mapGraphError,
  logWebhookEvent,
  redactSecrets,
  redactPhone,
  logWhatsApp,
};
