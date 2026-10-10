import { createHmac, timingSafeEqual } from "node:crypto";

export type WebhookProvider = "meta" | "twilio" | "local";

export type WebhookVerdict =
  | { ok: true }
  | { ok: false; status: 400 | 403; message: string };

export interface VerifyIncomingWebhookInput {
  provider: WebhookProvider;
  headers: Headers | Record<string, string | null | undefined>;
  rawBody: string;
  url: string;
  body: unknown;
  nodeEnv?: string;
  metaAppSecret?: string;
  twilioAuthToken?: string;
}

const REJECT = "Webhook signature rejected.";

function headerValue(
  headers: VerifyIncomingWebhookInput["headers"],
  name: string,
): string | undefined {
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  const record = headers as Record<string, string | null | undefined>;
  const found = Object.entries(record).find(([key]) => key.toLowerCase() === name.toLowerCase());
  const value = found?.[1];
  return typeof value === "string" ? value : undefined;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function metaSignature(secret: string, rawBody: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

function twilioSignature(secret: string, url: string, params: Record<string, string>): string {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac("sha1", secret).update(payload).digest("base64");
}

export function verifyIncomingWebhook(input: VerifyIncomingWebhookInput): WebhookVerdict {
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV;

  if (input.provider === "local") {
    if (nodeEnv === "production") return { ok: false, status: 403, message: REJECT };
    return { ok: true };
  }

  if (input.provider === "meta") {
    const secret = input.metaAppSecret;
    if (!secret) return { ok: false, status: 403, message: REJECT };
    const sent = headerValue(input.headers, "x-hub-signature-256");
    if (!sent || !sent.startsWith("sha256=")) return { ok: false, status: 403, message: REJECT };
    if (!safeEqual(sent, metaSignature(secret, input.rawBody))) {
      return { ok: false, status: 403, message: REJECT };
    }
    return { ok: true };
  }

  const secret = input.twilioAuthToken;
  if (!secret) return { ok: false, status: 403, message: REJECT };
  const sent = headerValue(input.headers, "x-twilio-signature");
  if (!sent) return { ok: false, status: 403, message: REJECT };
  const params =
    input.body && typeof input.body === "object"
      ? Object.fromEntries(
          Object.entries(input.body as Record<string, unknown>).flatMap(([key, value]) =>
            typeof value === "string" ? [[key, value]] : [],
          ),
        )
      : {};
  if (!safeEqual(sent, twilioSignature(secret, input.url, params))) {
    return { ok: false, status: 403, message: REJECT };
  }
  return { ok: true };
}
