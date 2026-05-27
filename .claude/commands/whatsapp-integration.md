# /whatsapp-integration

Audit and extend the WhatsApp integration for Lodgist.

## Pre-flight

1. Find webhook: `cat lodgist/app/api/whatsapp/webhook/route.ts`
2. Find WhatsApp session model: `grep -A 20 "model WhatsAppSession" packages/db/prisma/schema.prisma`
3. Check env vars: `grep -i whatsapp lodgist/.env 2>/dev/null | cut -d= -f1`
4. Check Vercel env: `vercel env ls | grep -i whatsapp`

## Required Env Vars

```
WHATSAPP_VERIFY_TOKEN=    # Meta webhook verification token
WHATSAPP_API_TOKEN=       # Meta Cloud API bearer token
WHATSAPP_PHONE_NUMBER_ID= # From Meta developer dashboard
WHATSAPP_BUSINESS_ACCOUNT_ID=
```

## Webhook Verification (GET handler)

```ts
// Meta sends hub.verify_token + hub.challenge on first setup
if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
  return new Response(challenge, { status: 200 });
}
return new Response("Forbidden", { status: 403 });
```

## Message Handling (POST handler)

Flow to implement:
1. Parse `entry[0].changes[0].value.messages[0]`
2. Identify intent: listing enquiry / verification request / payment status check
3. Look up session by `from` (phone number) in WhatsAppSession model
4. Route to appropriate handler
5. Reply via Meta Cloud API: `POST https://graph.facebook.com/v18.0/{phone_number_id}/messages`

## Send Message Helper

```ts
async function sendWhatsApp(to: string, text: string) {
  await fetch(`https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
}
```

## Output Format

```
## WhatsApp Audit

### Webhook handler: FOUND / MISSING
### Env vars: [list present/missing]
### Verification GET: IMPLEMENTED / MISSING
### Message POST: IMPLEMENTED / STUB / MISSING
### Session model: PRESENT / MISSING

### Next Steps
1. [action]
```
