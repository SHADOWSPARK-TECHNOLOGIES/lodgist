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

module.exports = {
  SECRET_ENV_NAMES,
  redactSecrets,
  redactPhone,
  logWhatsApp,
};
