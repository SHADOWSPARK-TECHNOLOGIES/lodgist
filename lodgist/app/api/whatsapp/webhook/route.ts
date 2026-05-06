import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { flagListingForFraud } from '@/lib/services/fraudDetectionService';

// ─── In-memory session store keyed by phone number ───────────────────────────
interface SessionState {
  step: 'idle' | 'awaiting_search_location' | 'awaiting_view_listing_id' | 'awaiting_booking_status_id';
  lastCommand?: string;
}

const sessions = new Map<string, SessionState>();

// ─── TwiML helpers ────────────────────────────────────────────────────────────

function twimlMessage(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(body)}</Message>
</Response>`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

// ─── Command parsing ──────────────────────────────────────────────────────────

type ParsedCommand =
  | { type: 'search'; location: string }
  | { type: 'view'; listingId: string }
  | { type: 'status'; bookingId: string }
  | { type: 'report'; listingId: string; reason: string }
  | { type: 'help' }
  | { type: 'unknown'; raw: string };

function parseCommand(text: string): ParsedCommand {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // search [location]
  const searchMatch = lower.match(/^search\s+(.+)/);
  if (searchMatch) {
    return { type: 'search', location: searchMatch[1].trim() };
  }

  // view [listing-id]
  const viewMatch = lower.match(/^view\s+(.+)/);
  if (viewMatch) {
    return { type: 'view', listingId: viewMatch[1].trim() };
  }

  // status [booking-id]
  const statusMatch = lower.match(/^status\s+(.+)/);
  if (statusMatch) {
    return { type: 'status', bookingId: statusMatch[1].trim() };
  }

  // report [listing-id] [reason...]
  const reportMatch = trimmed.match(/^report\s+(\S+)(?:\s+(.+))?/i);
  if (reportMatch) {
    return {
      type: 'report',
      listingId: reportMatch[1],
      reason: reportMatch[2]?.trim() ?? 'No reason provided',
    };
  }

  if (lower === 'help' || lower === 'menu') {
    return { type: 'help' };
  }

  return { type: 'unknown', raw: trimmed };
}

// ─── Conversation handlers ────────────────────────────────────────────────────

async function handleSearch(location: string, sender: string): Promise<string> {
  const terms = location.split(/\s+/).filter(Boolean);

  // Build a Prisma query that matches state OR city OR address
  const where: Record<string, unknown> = {
    OR: terms.map((term) => ({
      OR: [
        { state: { contains: term, mode: 'insensitive' } },
        { city: { contains: term, mode: 'insensitive' } },
        { address: { contains: term, mode: 'insensitive' } },
      ],
    })),
  };

  const properties = await prisma.property.findMany({
    where: where as any,
    include: {
      listings: {
        where: { status: 'available' },
        select: { id: true, price: true },
        take: 1,
      },
    },
    take: 5,
  });

  if (properties.length === 0) {
    return `Sorry, I couldn't find any listings in "${location}". Try a different location or use "help" to see available commands.`;
  }

  const lines = properties.map((p, i) => {
    const listingInfo =
      p.listings.length > 0
        ? ` \u2014 \u20A6${Number(p.listings[0].price).toLocaleString()} (ID: ${p.listings[0].id})`
        : ' \u2014 No active listings';
    return `${i + 1}. *${p.address}*, ${p.city}, ${p.state}${listingInfo}`;
  });

  return `Here are the top ${properties.length} listings in "${location}":\n\n${lines.join('\n')}\n\nReply with *view [listing-id]* to schedule a viewing.`;
}

async function handleView(listingId: string, sender: string): Promise<string> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      property: {
        select: { address: true, city: true, state: true },
      },
    },
  });

  if (!listing) {
    return `Sorry, I couldn't find a listing with ID "${listingId}". Please check the ID and try again.`;
  }

  // In a real app this would create a viewing request in the DB.
  // For now we return a confirmation message.
  return (
    `\u2705 *Viewing request submitted!*\n\n` +
    `You've requested to view:\n` +
    `*${listing.property.address}*, ${listing.property.city}, ${listing.property.state}\n` +
    `Price: \u20A6${Number(listing.price).toLocaleString()}\n\n` +
    `A Lodgist agent will contact you shortly at ${sender} to confirm the appointment.`
  );
}

async function handleStatus(bookingId: string): Promise<string> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      listing: {
        select: {
          id: true,
          property: { select: { address: true, city: true, state: true } },
        },
      },
    },
  });

  if (!booking) {
    // Return a mock status message as specified in the requirements
    return (
      `\U0001F4CB *Booking Status*\n\n` +
      `Booking ID: ${bookingId}\n` +
      `Status: *Pending Confirmation*\n` +
      `Note: We're still processing your request. You'll receive an update once the landlord confirms.`
    );
  }

  return (
    `\U0001F4CB *Booking Status*\n\n` +
    `Booking ID: ${booking.id}\n` +
    `Property: ${booking.listing.property.address}, ${booking.listing.property.city}\n` +
    `Status: *${booking.status.toUpperCase()}*\n` +
    `Dates: ${booking.startDate.toLocaleDateString()} \u2014 ${booking.endDate.toLocaleDateString()}`
  );
}

async function handleReport(listingId: string, reason: string, sender: string): Promise<string> {
  try {
    const flagged = await flagListingForFraud({
      listingId,
      reporterPhoneNumber: sender,
      reason,
    });

    if (flagged) {
      return (
        `\U0001F6A8 *Fraud Report Submitted*\n\n` +
        `Listing ${listingId} has been flagged for review. Our team will investigate and take appropriate action. Thank you for helping keep Lodgist safe!`
      );
    }

    return (
      `\u2705 *Report Received*\n\n` +
      `Thank you for reporting listing ${listingId}. After our initial check, it appears legitimate, but we'll continue to monitor it.`
    );
  } catch (error) {
    console.error('Error reporting fraud:', error);
    return `Sorry, something went wrong while processing your report. Please try again later.`;
  }
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.formData();
    console.log('Incoming WhatsApp message:', Object.fromEntries(body.entries()));

    const incomingMsg = (body.get('Body') as string | null)?.trim();
    const sender = body.get('From') as string | null; // e.g. "whatsapp:+2348012345678"

    if (!sender || !incomingMsg) {
      return new NextResponse(twimlMessage('Invalid message format. Please send a text message.'), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Retrieve or initialise session
    const session = sessions.get(sender) ?? { step: 'idle' as const };

    // ── Handle multi-step conversation ────────────────────────────────────
    if (session.step === 'awaiting_search_location') {
      const response = await handleSearch(incomingMsg, sender);
      sessions.set(sender, { step: 'idle' });
      return new NextResponse(twimlMessage(response), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    if (session.step === 'awaiting_view_listing_id') {
      const response = await handleView(incomingMsg, sender);
      sessions.set(sender, { step: 'idle' });
      return new NextResponse(twimlMessage(response), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    if (session.step === 'awaiting_booking_status_id') {
      const response = await handleStatus(incomingMsg);
      sessions.set(sender, { step: 'idle' });
      return new NextResponse(twimlMessage(response), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // ── Parse command ─────────────────────────────────────────────────────
    const command = parseCommand(incomingMsg);

    switch (command.type) {
      case 'search': {
        const response = await handleSearch(command.location, sender);
        sessions.set(sender, { step: 'idle' });
        return new NextResponse(twimlMessage(response), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }

      case 'view': {
        const response = await handleView(command.listingId, sender);
        sessions.set(sender, { step: 'idle' });
        return new NextResponse(twimlMessage(response), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }

      case 'status': {
        const response = await handleStatus(command.bookingId);
        sessions.set(sender, { step: 'idle' });
        return new NextResponse(twimlMessage(response), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }

      case 'report': {
        const response = await handleReport(command.listingId, command.reason, sender);
        sessions.set(sender, { step: 'idle' });
        return new NextResponse(twimlMessage(response), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }

      case 'help': {
        const helpText =
          `\U0001F916 *Lodgist WhatsApp Bot*\n\n` +
          `Here are the commands you can use:\n\n` +
          `\U0001F50D *search [location]* \u2014 Find top 5 listings in a state or LGA\n` +
          `   Example: *search Lagos*\n\n` +
          `\U0001F441\uFE0F *view [listing-id]* \u2014 Schedule a viewing for a listing\n` +
          `   Example: *view clabc123def456*\n\n` +
          `\U0001F4CB *status [booking-id]* \u2014 Check your booking status\n` +
          `   Example: *status clxyz789*\n\n` +
          `\U0001F6A8 *report [listing-id] [reason]* \u2014 Report a suspicious listing\n` +
          `   Example: *report clabc123def456 suspicious price*\n\n` +
          `\U0001F4AC *help* \u2014 Show this menu`;

        sessions.set(sender, { step: 'idle' });
        return new NextResponse(twimlMessage(helpText), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }

      case 'unknown': {
        sessions.set(sender, { step: 'idle' });
        const unknownText =
          `I didn't recognise that command. Try one of these:\n\n` +
          `\u2022 *search [location]* \u2014 Find listings\n` +
          `\u2022 *view [listing-id]* \u2014 Schedule a viewing\n` +
          `\u2022 *status [booking-id]* \u2014 Check booking status\n` +
          `\u2022 *report [listing-id] [reason]* \u2014 Report fraud\n` +
          `\u2022 *help* \u2014 Show all commands`;

        return new NextResponse(twimlMessage(unknownText), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }
    }
  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error);
    return new NextResponse(
      twimlMessage('Sorry, an error occurred while processing your message. Please try again later.'),
      { status: 200, headers: { 'Content-Type': 'text/xml' } },
    );
  }
}

// ─── GET handler (Twilio webhook verification) ────────────────────────────────

export async function GET(req: NextRequest) {
  return new NextResponse('WhatsApp Webhook is active.', { status: 200 });
}
