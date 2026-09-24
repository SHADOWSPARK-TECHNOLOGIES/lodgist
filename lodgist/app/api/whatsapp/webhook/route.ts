import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleWhatsAppMessage,
  twimlMessage,
  type IncomingMessage,
  type SessionState,
} from "@/lib/whatsapp/conversation";
import { createPrismaWhatsAppDb } from "@/lib/whatsapp/prismaDb";
import { verifyIncomingWebhook, type WebhookProvider } from "@/lib/whatsapp/verifyWebhook";

const sessions = new Map<string, SessionState>();
const replies = new Map<string, string>();
const db = createPrismaWhatsAppDb(prisma);

interface MetaTextMessage {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
}

function metaMessages(body: unknown): IncomingMessage[] {
  if (!body || typeof body !== "object") return [];
  const entry = (body as { entry?: unknown }).entry;
  if (!Array.isArray(entry)) return [];
  const messages: IncomingMessage[] = [];
  for (const item of entry) {
    if (!item || typeof item !== "object") continue;
    const changes = (item as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const value = (change as { value?: { messages?: unknown } }).value;
      if (!value || !Array.isArray(value.messages)) continue;
      for (const message of value.messages as MetaTextMessage[]) {
        if (message.type !== "text" || !message.from || !message.text?.body) continue;
        messages.push({
          phone: message.from,
          body: message.text.body,
          messageId: message.id,
        });
      }
    }
  }
  return messages;
}

function providerFor(contentType: string, body: unknown): WebhookProvider {
  if (!contentType.includes("application/json")) return "twilio";
  if (body && typeof body === "object" && "entry" in body) return "meta";
  return "local";
}

async function readMessages(rawBody: string, contentType: string): Promise<{ channel: "twilio" | "json"; messages: IncomingMessage[] }> {
  if (contentType.includes("application/json")) {
    const body: unknown = rawBody ? JSON.parse(rawBody) : null;
    if (!body || typeof body !== "object") return { channel: "json", messages: [] };
    const local = body as { from?: unknown; body?: unknown; messageId?: unknown };
    if (typeof local.from === "string" && typeof local.body === "string") {
      return {
        channel: "json",
        messages: [
          {
            phone: local.from,
            body: local.body,
            messageId: typeof local.messageId === "string" ? local.messageId : undefined,
          },
        ],
      };
    }
    return { channel: "json", messages: metaMessages(body) };
  }

  const form = new URLSearchParams(rawBody);
  const from = form.get("From");
  const text = form.get("Body");
  const messageId = form.get("MessageSid");
  if (typeof from !== "string" || typeof text !== "string") {
    return { channel: "twilio", messages: [] };
  }
  return {
    channel: "twilio",
    messages: [
      {
        phone: from,
        body: text,
        messageId: typeof messageId === "string" ? messageId : undefined,
      },
    ],
  };
}

function jsonReply(repliesOut: string[], duplicate: boolean) {
  return NextResponse.json({ replies: repliesOut, duplicate });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const contentType = req.headers.get("content-type") ?? "";
  let parsed: unknown = null;
  if (contentType.includes("application/json") && rawBody) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ message: "Malformed JSON." }, { status: 400 });
    }
  } else if (!contentType.includes("application/json")) {
    parsed = Object.fromEntries(new URLSearchParams(rawBody));
  }
  const verdict = verifyIncomingWebhook({
    provider: providerFor(contentType, parsed),
    headers: req.headers,
    rawBody,
    url: req.url,
    body: parsed,
    metaAppSecret: process.env.WHATSAPP_APP_SECRET,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  });
  if (!verdict.ok) {
    return NextResponse.json({ message: verdict.message }, { status: verdict.status });
  }

  try {
    const { channel, messages } = await readMessages(rawBody, contentType);
    if (messages.length === 0) {
      if (channel === "json") return jsonReply([], false);
      return new NextResponse(twimlMessage("Send a text message. Try help."), {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    const repliesOut: string[] = [];
    let duplicate = false;
    for (const message of messages) {
      const result = await handleWhatsAppMessage(message, { db, sessions, replies });
      repliesOut.push(result.reply);
      duplicate = duplicate || result.duplicate;
    }

    if (channel === "json") return jsonReply(repliesOut, duplicate);
    return new NextResponse(twimlMessage(repliesOut.join("\n\n")), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Error processing WhatsApp webhook:", error);
    if ((req.headers.get("content-type") ?? "").includes("application/json")) {
      return NextResponse.json({ message: "Webhook processing failed." }, { status: 500 });
    }
    return new NextResponse(twimlMessage("Sorry, something went wrong. Please try again."), {
      status: 500,
      headers: { "Content-Type": "text/xml" },
    });
  }
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && challenge && expected && token === expected) {
    return new NextResponse(challenge, { status: 200 });
  }
  if (mode === "subscribe") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse("WhatsApp Webhook is active.", { status: 200 });
}
