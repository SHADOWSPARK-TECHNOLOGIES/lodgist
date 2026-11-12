# HANDOFF

Updated: 2026-10-25

Project: Lodgist live frontend (`frontend/`). Source snapshot pinned to upstream commit `0af44b83e885a731e723abe5a32b78720af69580`; live `/api/health` reported that same SHA before this change. The snapshot contains frontend textual sources and spatial-core dependencies, not a complete repository/assets clone.

## NOW

Implement only mobile/accessibility fixes: primary button text contrast, persistent labels for rental-check payment-evidence fields, wrapping buttons, readable mobile input sizing, and autocomplete for the customer's own name/phone. Keep payloads, fee/payment semantics, inventory, auth, backend and schema unchanged. Do not edit the duplicate `lodgist/app/` tree.

## VERIFY

QA owns `src/lib/mobileA11y.test.js` and test-script wiring. Implementer owns `src/app/globals.css` and `src/components/rental/CheckIntake.tsx`. Orchestrator owns integration and evidence; deployment specialist remains read-only. Run the new regressions before and after changes, the existing frontend/spatial suites, lint, typecheck and build. Distinguish static/SSR checks from browser reflow or screen-reader checks. Never submit a live case/payment for testing.

## BLOCKED / BOUNDARIES

Terminal Git clone lacks authentication; text sources were retrieved through the connected GitHub app and all 232 files verified against upstream Git blob hashes. Binary public assets are absent, so screenshot parity requires a complete checkout. Production publication is outside this patch. Preserve env-based WhatsApp support and staff-confirmed manual payments; no hardcoded contact number or credential changes.
