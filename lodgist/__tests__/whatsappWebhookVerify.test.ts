import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyIncomingWebhook } from "@/lib/whatsapp/verifyWebhook";

const metaSecret = "local-meta-test-secret";
const twilioToken = "local-twilio-test-token";
const rawMeta = JSON.stringify({ entry: [{ changes: [] }] });
const twilioUrl = "https://lodgist.example/api/whatsapp/webhook";
const twilioBody = { From: "whatsapp:+2348011111111", Body: "help", MessageSid: "SM1" };

function metaHeader(secret: string, raw: string): string {
  return `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
}

function twilioHeader(token: string, url: string, params: Record<string, string>): string {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac("sha1", token).update(payload).digest("base64");
}

describe("verifyIncomingWebhook", () => {
  it("accepts a valid Meta signature over the raw body", () => {
    const verdict = verifyIncomingWebhook({
      provider: "meta",
      headers: { "x-hub-signature-256": metaHeader(metaSecret, rawMeta) },
      rawBody: rawMeta,
      url: twilioUrl,
      body: JSON.parse(rawMeta),
      metaAppSecret: metaSecret,
    });
    expect(verdict.ok).toBe(true);
  });

  it("rejects an invalid Meta signature", () => {
    const verdict = verifyIncomingWebhook({
      provider: "meta",
      headers: { "x-hub-signature-256": metaHeader("other-secret", rawMeta) },
      rawBody: rawMeta,
      url: twilioUrl,
      body: JSON.parse(rawMeta),
      metaAppSecret: metaSecret,
    });
    expect(verdict).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects Meta when the app secret is missing", () => {
    const verdict = verifyIncomingWebhook({
      provider: "meta",
      headers: { "x-hub-signature-256": metaHeader(metaSecret, rawMeta) },
      rawBody: rawMeta,
      url: twilioUrl,
      body: JSON.parse(rawMeta),
    });
    expect(verdict).toMatchObject({ ok: false, status: 403 });
  });

  it("accepts a valid Twilio signature", () => {
    const verdict = verifyIncomingWebhook({
      provider: "twilio",
      headers: { "X-Twilio-Signature": twilioHeader(twilioToken, twilioUrl, twilioBody) },
      rawBody: "Body=help&From=whatsapp%3A%2B2348011111111&MessageSid=SM1",
      url: twilioUrl,
      body: twilioBody,
      twilioAuthToken: twilioToken,
    });
    expect(verdict.ok).toBe(true);
  });

  it("rejects an invalid Twilio signature", () => {
    const verdict = verifyIncomingWebhook({
      provider: "twilio",
      headers: { "X-Twilio-Signature": twilioHeader("other-token", twilioUrl, twilioBody) },
      rawBody: "unused",
      url: twilioUrl,
      body: twilioBody,
      twilioAuthToken: twilioToken,
    });
    expect(verdict).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects Twilio when the auth token is missing", () => {
    const verdict = verifyIncomingWebhook({
      provider: "twilio",
      headers: { "X-Twilio-Signature": "abc" },
      rawBody: "unused",
      url: twilioUrl,
      body: twilioBody,
    });
    expect(verdict).toMatchObject({ ok: false, status: 403 });
  });

  it("allows the local JSON fixture outside production", () => {
    const verdict = verifyIncomingWebhook({
      provider: "local",
      headers: {},
      rawBody: '{"from":"+234","body":"help"}',
      url: "http://localhost:3000/api/whatsapp/webhook",
      body: { from: "+234", body: "help" },
      nodeEnv: "development",
    });
    expect(verdict.ok).toBe(true);
  });

  it("rejects an unsigned request in production", () => {
    const verdict = verifyIncomingWebhook({
      provider: "local",
      headers: {},
      rawBody: '{"from":"+234","body":"help"}',
      url: "https://lodgist.example/api/whatsapp/webhook",
      body: { from: "+234", body: "help" },
      nodeEnv: "production",
    });
    expect(verdict).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects a malformed Meta header without throwing", () => {
    const verdict = verifyIncomingWebhook({
      provider: "meta",
      headers: { "x-hub-signature-256": "not-a-signature" },
      rawBody: rawMeta,
      url: twilioUrl,
      body: {},
      metaAppSecret: metaSecret,
    });
    expect(verdict).toMatchObject({ ok: false, status: 403 });
  });
});
