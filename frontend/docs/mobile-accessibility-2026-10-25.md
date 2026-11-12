# Mobile accessibility patch — 25 October 2026

## Source and scope

Upstream baseline: `0af44b83e885a731e723abe5a32b78720af69580`. Live `https://lodgist.online/api/health` reported this same frontend SHA before editing. Source mapping is operational corroboration from sanitized deployment metadata, not cryptographic attestation.

Terminal cloning lacked credentials. The connected GitHub app supplied 232 frontend/spatial text files, all verified against upstream Git blob hashes before edits. Unchanged seed/benchmark/ledger fixtures referenced by the full suite were subsequently retrieved from that same SHA. This local snapshot is not a full repository/assets checkout; publishing must overlay only the changed files onto the original Git tree.

## Changes

- Preserve orange backgrounds; use navy primary-button text. Calculated contrast: normal 6.29:1, hover 4.83:1.
- Allow shared button labels to wrap within their container; shared input text uses 1rem.
- Add persistent, explicitly associated labels for bank name, account name and account number in rental-check intake.
- Add customer-only phone/name autocomplete; keep agent and payment-recipient fields separate.
- Preserve submitted payloads, validation, payment fee/reference semantics, API calls, dependencies, backend, schema, authentication and permissions.

## Verification performed

| Check | Result |
|---|---|
| Locked dependency install | PASS: pnpm 9.15.9, frozen lockfile; Node 24.22.1 |
| Initial focused regression run | Expected RED: 5 product failures, no setup errors |
| Final focused regression suite | PASS: 6 tests (contrast normal/hover, rendered labels, sizing, wrapping, customer-only autocomplete) |
| `npm test` | PASS: 106 frontend tests and 158 spatial-core tests |
| `npm run lint` | PASS with 0 errors, 6 warnings in unchanged files |
| `tsc --noEmit` | PASS |
| `npm run build` | PASS: Next.js 16.3.8 production build, local API/site URLs |
| Independent source review | No blocking finding; focused suite independently rerun |
| Patch whitespace | PASS: `git diff --check` |

The first broad test attempts exposed missing snapshot fixtures, not product regressions. The original unchanged fixtures were recovered; no test was deleted or weakened. Spatial tests regenerate benchmark JSON; the generated change was restored after verification. Lockfile is unchanged.

## Remaining verification

CSS declaration tests and server rendering do not prove browser computed cascade, narrow-screen reflow, enlarged text, autofill execution or screen-reader announcements. Verify 320/375/390px, enlarged text and keyboard/screen-reader operation on a complete local/staging candidate. Public binary assets were not recovered here, so screenshot parity is not established. No live form, payment, booking or admin write was made.

CI uses Node 20; the local pass used Node 24.22.1. Obtain CI results before merge. Merge, host publication and post-release health checks remain separate from this patch. No production deployment performed.
