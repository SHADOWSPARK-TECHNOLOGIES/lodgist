import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleWhatsAppMessage,
  twimlMessage,
  whatsAppWebhookOpen,
  type IncomingMessage,
  type SessionState,
} from "@/lib/whatsapp/conversation";
import { createPrismaWhatsAppDb } from "@/lib/whatsapp/prismaDb";

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

async function readMessages(req: NextRequest): Promise<{ channel: "twilio" | "json"; messages: IncomingMessage[] }> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body: unknown = await req.json();
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

  const form = await req.formData();
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
  if (!whatsAppWebhookOpen()) {
    return NextResponse.json(
      { message: "WhatsApp webhook signature verification is not configured." },
      { status: 503 },
    );
  }

  try {
    const { channel, messages } = await readMessages(req);
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
