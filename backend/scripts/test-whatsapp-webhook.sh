#!/usr/bin/env bash
# ─── Lodgist WhatsApp Webhook Test Suite ─────────────────────────────────────
# Tests the webhook verification (GET) and message handling (POST) endpoints.
#
# Usage:
#   chmod +x backend/scripts/test-whatsapp-webhook.sh
#   ./backend/scripts/test-whatsapp-webhook.sh              # Test localhost
#   WHATSAPP_URL=https://abc123.ngrok.io ./script.sh        # Test ngrok tunnel
#
# Environment:
#   WHATSAPP_URL   - Base URL (default: http://localhost:4000)
#   VERIFY_TOKEN   - Verify token (default: lodgist_verify_2026)

set -euo pipefail

BASE_URL="${WHATSAPP_URL:-http://localhost:4000}"
VERIFY_TOKEN="${VERIFY_TOKEN:-lodgist_verify_2026}"
PASS=0
FAIL=0

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
bold()  { printf "\033[1m%s\033[0m\n" "$1"; }

# ── Test 1: GET webhook verification (valid token) ──────────────────────────
bold "Test 1: GET /api/whatsapp/webhook — valid verify token"
RESP=$(curl -s -w "\n%{http_code}" \
  "${BASE_URL}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=challenge_ok")
HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$HTTP_CODE" = "200" ] && [ "$BODY" = "challenge_ok" ]; then
  green "  ✅ PASS — returned challenge (HTTP $HTTP_CODE)"
  PASS=$((PASS + 1))
else
  red "  ❌ FAIL — expected 200 + 'challenge_ok', got HTTP $HTTP_CODE body='$BODY'"
  FAIL=$((FAIL + 1))
fi

# ── Test 2: GET webhook verification (invalid token) ─────────────────────────
bold "Test 2: GET /api/whatsapp/webhook — invalid verify token"
RESP=$(curl -s -w "\n%{http_code}" \
  "${BASE_URL}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123")
HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" = "403" ]; then
  green "  ✅ PASS — rejected invalid token (HTTP $HTTP_CODE)"
  PASS=$((PASS + 1))
else
  red "  ❌ FAIL — expected 403, got HTTP $HTTP_CODE"
  FAIL=$((FAIL + 1))
fi

# ── Test 3: POST webhook — valid Meta-style payload (no signature, dev mode) ─
bold "Test 3: POST /api/whatsapp/webhook — incoming message (dev mode)"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  "${BASE_URL}/api/whatsapp/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "123456789",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": { "phone_number_id": "987654321" },
          "messages": [{
            "from": "+2348000000000",
            "id": "wamid.test123",
            "timestamp": "1700000000",
            "type": "text",
            "text": { "body": "Hello" }
          }]
        }
      }]
    }]
  }')
HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" = "200" ]; then
  green "  ✅ PASS — acknowledged message (HTTP $HTTP_CODE)"
  PASS=$((PASS + 1))
else
  red "  ❌ FAIL — expected 200, got HTTP $HTTP_CODE"
  FAIL=$((FAIL + 1))
fi

# ── Test 4: POST webhook — empty body (health check / notification) ──────────
bold "Test 4: POST /api/whatsapp/webhook — empty notification (no messages)"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  "${BASE_URL}/api/whatsapp/webhook" \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[]}')
HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" = "200" ]; then
  green "  ✅ PASS — acknowledged empty (HTTP $HTTP_CODE)"
  PASS=$((PASS + 1))
else
  red "  ❌ FAIL — expected 200, got HTTP $HTTP_CODE"
  FAIL=$((FAIL + 1))
fi

# ── Test 5: POST webhook — HMAC signature verification (simulated) ───────────
# Only runs if WHATSAPP_APP_SECRET is set in env; validates that valid HMAC passes
bold "Test 5: POST /api/whatsapp/webhook — HMAC signature (if APP_SECRET set)"
if [ -n "${WHATSAPP_APP_SECRET:-}" ]; then
  PAYLOAD='{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"metadata":{"phone_number_id":"p"},"messages":[{"from":"+2348000000000","id":"w1","timestamp":"1700000000","type":"text","text":{"body":"Hi"}}]}}]}]}'
  SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WHATSAPP_APP_SECRET" | sed 's/.* //')
  RESP=$(curl -s -w "\n%{http_code}" -X POST \
    "${BASE_URL}/api/whatsapp/webhook" \
    -H "Content-Type: application/json" \
    -H "x-hub-signature-256: sha256=${SIGNATURE}" \
    -d "$PAYLOAD")
  HTTP_CODE=$(echo "$RESP" | tail -1)
  if [ "$HTTP_CODE" = "200" ]; then
    green "  ✅ PASS — valid HMAC accepted (HTTP $HTTP_CODE)"
    PASS=$((PASS + 1))
  else
    red "  ❌ FAIL — expected 200, got HTTP $HTTP_CODE"
    FAIL=$((FAIL + 1))
  fi
else
  echo "  ⚠️  SKIPPED — WHATSAPP_APP_SECRET not set in environment"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
bold "──────── Results ────────"
green "  ✅ Passed: $PASS"
if [ "$FAIL" -gt 0 ]; then
  red "  ❌ Failed: $FAIL"
  exit 1
else
  echo "  ✨ All tests passed!"
fi
