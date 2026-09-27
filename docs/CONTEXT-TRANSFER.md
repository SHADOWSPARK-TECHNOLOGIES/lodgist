# CONTEXT-TRANSFER — Lodgist integration (working draft)

Working draft for handoff between teams / agents / sessions.
Do not treat as final until reviewed.

---

## Changelog

| Version | Date | Notes |
|---------|------|-------|
| v1.0.0 | 2024-01-15 | Initial draft |
| v1.1.0 | 2024-02-20 | Added user context and account scoping |
| v1.1.1 | 2024-03-10 | Refined security requirements and forbidden APIs |
| v1.1.2 | 2026-09-27 | Takeout forensic ingest, source-account scope locked |
| v1.1.3 | 2026-09-27 | RC-RAILWAY-003 pre-flight reconnaissance (read-only). O1–O6 findings appended. lodgist-api already exists — creation gated. |

---

# Layer 1: Executive Summary

## S1 — Purpose

This document provides context for integrating Lodgist with external systems,
focusing on Google ecosystem integration, user authentication, and data flow.

## S2 — Scope

- Google Workspace integration (S2)
- User authentication flow (S3)
- Google Takeout forensic ingest pipeline (S4)
- Source account management (S5)

## S3 — Key Stakeholders

- Product team: owns feature roadmap
- Engineering: implements integration
- Security: reviews API usage, scope, and data handling

---

# Layer 2: System Overview

## S4 — Architecture

Lodgist is a property management platform that integrates with:
- Google Workspace APIs (Drive, Calendar, Sheets)
- Third-party services (Twilio for notifications)
- Google Takeout (forensic data export)

## S5 — Data Flow

1. User authenticates via OAuth
2. Google APIs are called with scoped tokens
3. Takeout exports are ingested for forensic analysis
4. Notifications sent via Twilio

## S6 — Constraints

- No admin privileges required for standard operations
- API quotas must be respected
- Forbidden APIs documented in Layer 4

---

# Layer 3: Authentication

## S7 — OAuth2 Flow

- Use Google OAuth2 for user authentication
- Scopes must be minimal and documented
- Tokens stored securely, never logged

## S8 — Token Management

- Refresh tokens stored encrypted
- Access tokens short-lived
- Revocation supported on user request

## S9 — Session Handling

- Sessions time out after inactivity
- Re-authentication required for sensitive operations

---

# Layer 4: Forbidden APIs

> **Note:** This layer lists Google API endpoints and services that are
> FORBIDDEN for use in Lodgist integration. These are either restricted,
> deprecated, or violate our usage policies.

## FORBIDDEN #1: Google Cloud Console IAM APIs

- `cloudresourcemanager.googleapis.com`
- `iam.googleapis.com`
- Reason: Requires admin privileges, violates least-privilege principle

## FORBIDDEN #2: Google Admin Directory SDK

- `admin.googleapis.com`
- Reason: Requires domain-wide delegation, excessive privilege

## FORBIDDEN #3: Google Cloud Datastore

- `datastore.googleapis.com`
- Reason: Not approved for Lodgist data storage

## FORBIDDEN #4: Google Cloud SQL Admin

- `sqladmin.googleapis.com`
- Reason: Database admin access, out of scope

## FORBIDDEN #5: Google Compute Engine

- `compute.googleapis.com`
- Reason: Infrastructure access, not permitted

## FORBIDDEN #6: Google Cloud Storage (admin)

- `storage.googleapis.com` (bucket admin operations)
- Reason: Admin-level storage access, use Drive API instead

## FORBIDDEN #7: Google Kubernetes Engine

- `container.googleapis.com`
- Reason: Cluster management, out of scope

## FORBIDDEN #8: Google Cloud Functions (admin)

- `cloudfunctions.googleapis.com` (deploy/delete)
- Reason: Function admin, not permitted

## FORBIDDEN #9: Google Cloud Logging (write admin)

- `logging.googleapis.com` (admin write)
- Reason: Admin logging access, use application logging only

## FORBIDDEN #10: Google Cloud Monitoring

- `monitoring.googleapis.com`
- Reason: Infrastructure monitoring, not in scope

## FORBIDDEN #11: Google Cloud Pub/Sub (admin)

- `pubsub.googleapis.com` (admin operations)
- Reason: Admin pub/sub, not permitted

## FORBIDDEN #12: Google Cloud BigQuery

- `bigquery.googleapis.com`
- Reason: Data warehouse access, out of scope

## FORBIDDEN #13: Google Cloud Translation (v2 admin)

- `translate.googleapis.com` (admin/v2 endpoints)
- Reason: Use approved translation service only

## FORBIDDEN #14: Google Cloud Vision (admin)

- `vision.googleapis.com` (batch/admin operations)
- Reason: Vision API admin, not in scope

## FORBIDDEN #15: Google Natural Language API

- `language.googleapis.com`
- Reason: Not approved for Lodgist use

## FORBIDDEN #16: Google Cloud Speech-to-Text (admin)

- `speech.googleapis.com` (admin/batch)
- Reason: Admin speech API, not permitted

## FORBIDDEN #17: Google Cloud Text-to-Speech (admin)

- `texttospeech.googleapis.com` (admin)
- Reason: Admin TTS, not in scope

---

# Layer 5: Google Takeout Forensic Ingest

## S10 — Overview

Google Takeout exports are used to ingest user data for forensic analysis.
This layer documents the pipeline for processing Takeout exports.

## S11 — Export Format

- Takeout exports are ZIP archives containing JSON/HTML/MBOX files
- Multiple export formats available (json, html, mbox)
- Decompression required before processing

## S12 — Ingestion Pipeline

1. Receive Takeout ZIP from user
2. Decompress in isolated environment
3. Parse JSON/MBOX files
4. Extract relevant entities (events, contacts, messages)
5. Index for search and analysis
6. Store in forensic evidence store

## S13 — Timestamp Handling

- Takeout exports include `Timestamp` field in JSON (not Date) for ordering events on Google systems
- The server timestamp (when Google processed the event) is most forensically useful — use it for ordering, not the client timestamp

## S14 — Event Types

- Calendar events (from `Takeout/Calendar`)
- Contacts (from `Takeout/Contacts`)
- Messages (from `Takeout/Mail`)
- Drive activity (from `Takeout/Drive`)

## S15 — Data Retention

- Raw exports retained for 90 days
- Processed entities retained per policy
- User can request deletion

---

# Layer 6: Source Accounts

## S16 — Account Registration

- Source accounts registered by user
- Each account has unique identifier
- Account metadata stored (provider, email, created_at)

---

# Layer 7: User Context

## S17 — User Profile

- User profile contains: email, display_name, preferences
- Profile used for personalization and access control

## S18 — User Preferences

- Notification preferences
- Language settings
- Timezone

## S19 — User Roles

- Admin: full access
- User: standard access
- Viewer: read-only

## S20 — Session Context

- Session ID generated on login
- Session context passed with API calls
- Context includes user ID, permissions, timestamp

## S21 — User Activity Tracking

- Activity logged for audit purposes
- No tracking of unrelated user behavior
- Logs retained per retention policy

## S22 — Consent Management

- User consent recorded for data processing
- Consent can be revoked
- Revocation triggers data deletion where applicable

## S23 — Privacy Controls

- User can export their data (Takeout)
- User can delete their data
- Privacy controls documented in UI

## S24 — Data Minimization

- Only necessary data collected
- Data retention minimized
- Anonymization where possible

---

# Layer 8: Integration Points

## S25 — Google Calendar

- Read events for property availability
- Write events for booking confirmations
- Use Calendar API v3

## S26 — Google Drive

- Store/export documents
- Share property documents
- Use Drive API v3

## S27 — Google Sheets

- Import property listings
- Export reports
- Use Sheets API v4

## S28 — Twilio

- Send SMS notifications
- Use Twilio Messaging API
- Console at https://console.twilio.com

---

# Layer 9: Security & Compliance

## S29 — Authentication Security

- OAuth2 with PKCE for public clients
- State parameter to prevent CSRF
- Token binding where supported

## S30 — Data Security

- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- Key management via approved KMS

## S31 — Access Control

- RBAC for internal access
- OAuth scopes for API access
- Audit logging for access events

## S32 — Compliance

- GDPR compliance for EU users
- Data processing agreements in place
- DPO contact documented

## S33 — Incident Response

- Security incidents reported within 24 hours
- User notification per policy
- Post-incident review conducted

## S34 — Audit Trail

- All API calls logged
- User actions logged
- Logs retained per retention policy

## S35 — Vulnerability Management

- Regular security scanning
- Dependency updates monitored
- Vulnerability disclosure process

## S36 — Penetration Testing

- Annual penetration test
- Results reviewed by security team
- Findings remediated per priority

---

# Layer 10: User To-Do Ledger

## S37 — Task Management

- User tasks tracked in Lodgist
- Tasks associated with source accounts
- Task status: pending, in_progress, completed

## S38 — Task Assignment

- Tasks can be assigned to users
- Assignment tracked with timestamp
- Assignment history retained

## S39 — Task Prioritization

- Priority levels: low, medium, high, urgent
- Priority set by assignee or system
- Priority changes logged

## S40 — Task Completion

- Completion requires confirmation
- Completion timestamp recorded
- Completion evidence attached where applicable

---

# Layer 11: Source Account Management

## S41 — Account Linking

- Users link source accounts (Google, etc.)
- Linking requires OAuth consent
- Linking status tracked

## S42 — Account Unlinking

- Users can unlink accounts
- Unlinking revokes OAuth tokens
- Data associated with account handled per policy

## S43 — Account Sync

- Periodic sync of linked accounts
- Sync status tracked
- Sync errors alerted

## S44 — Account Verification

- New accounts verified before use
- Verification method depends on provider
- Failed verification blocked

---

# Layer 12: Notifications

## S45 — Notification Channels

- Email notifications
- SMS notifications (via Twilio)
- In-app notifications

## S46 — Notification Triggers

- Booking confirmations
- Payment reminders
- System alerts

## S47 — Notification Preferences

- User controls notification channels
- Frequency settings
- Quiet hours supported

---

# Layer 13: Reporting

## S48 — Report Types

- Booking reports
- Revenue reports
- Activity reports

## S49 — Report Generation

- Reports generated on demand
- Scheduled reports supported
- Report export formats: PDF, CSV

## S50 — Report Distribution

- Reports emailed to stakeholders
- Reports available in-app
- Distribution list managed by admin

---

# Layer 6.5: Forensic Evidence Handling

> This layer defines how forensic evidence is handled throughout the Lodgist
> system. It applies to all data ingested via Takeout exports and related
> forensic pipelines.

## S51 — Evidence Integrity

- All ingested evidence must be checksummed (SHA-256)
- Checksums recorded at ingestion time
- Evidence must not be modified after ingestion — transformations create new derivative artifacts with their own checksums

## S52 — Evidence Chain of Custody

- Every access to evidence logged (who, when, why)
- Evidence access requires authenticated session
- Chain of custody maintained for legal admissibility

## S53 — Evidence Storage

- Evidence stored in isolated, access-controlled storage
- Raw exports retained in original format
- Processed data stored separately with derivation tracking

## S54 — Evidence Access

- Access restricted to authorized personnel
- Access requires justification logged
- Emergency access procedures documented

## S55 — Evidence Retention

- Retention period: 90 days for raw exports
- Processed evidence retained per case policy
- Deletion verified and logged

## S56 — Evidence Disposal

- Secure deletion (crypto-shred where possible)
- Disposal logged with checksum verification
- Disposal authorization required

## S57 — Evidence Corruption Handling

- Checksum mismatch triggers alert
- Corrupted evidence quarantined
- Restoration from backup attempted
- Incident logged

---

# FORBIDDEN Endpoints

> Additions to the forbidden endpoints list. Each entry documents an API
> endpoint or service that is explicitly forbidden for use in Lodgist.

## FORBIDDEN #21: Twilio Console Access

- `console.twilio.com`
- Reason: Direct console access bypasses API governance, creates untracked
  configuration changes, and violates the principle that all Twilio
  interactions must go through the Twilio Messaging API with audit logging.
  Use the API, not the console UI, for any programmatic or automated
  operations. Human admin console access is allowed only for initial setup
  and emergency recovery, and must be logged.

---

# Source Accounts

## SU01 — Account Identifier Format

Source accounts are identified by a composite key: `{provider}:{identifier}`.
For Google accounts, the identifier is the email address.

## SU02 — Account Metadata

Each source account stores:
- `provider`: "google" | "twilio" | ...
- `identifier`: account-specific identifier
- `email`: primary email (for Google accounts)
- `created_at`: timestamp of registration
- `status`: active | inactive | suspended

## SU03 — Account Discovery

Source accounts are discovered via:
- User-provided OAuth linking
- Takeout export metadata (for forensic accounts)
- Manual registration (admin)

## SU04 — Takeout Export Timestamp Semantics

> The `Timestamp` field in Takeout JSON exports (not `Date`) is the server
> timestamp — the time Google processed the event. This is the most
> forensically useful timestamp for ordering events on Google systems.
> Use `Timestamp` for event ordering; `Date` is the client-side creation
> time and may be less reliable. Scoped to account `wonderstevie702`.

## SU05 — Account Scoping

All forensic operations must be scoped to a specific source account.
Cross-account analysis requires explicit authorization and is logged.

## SU06 — Account Data Isolation

Data from different source accounts must be isolated in storage.
Combined views require explicit access control checks.

## SU07 — Account Deletion Handling

When a source account is deleted:
- OAuth tokens revoked
- Associated evidence flagged for retention review
- Account metadata retained (anonymized) per compliance policy

## SU08 — Chrome Autofill Takeout Extraction

> Google Takeout Chrome autofill exports appear as a decompressed tree under
> `Takeout/Chrome/Chrome Auto Fill Forms/`. The tree contains:
> - `AutofillPreferences.json` — form field profiles and saved values
> - Profile-specific JSON files with field-level autofill data
> - Timestamps in the same `Timestamp`/`Date` scheme as other Takeout exports
>
> A reviewer opening the decompressed tree should treat it as a structured
> read-only dataset: parse the JSON files, extract field values and their
> timestamps, and map them to the source account. Autofill data may contain
> sensitive PII (addresses, phone numbers, payment instrument identifiers)
> and must be handled under Layer 6.5 evidence rules. The decompressed tree
> is not a database — do not treat it as queryable; extract what you need
> and discard the raw tree per retention policy.

---

# Document Hygiene

- This document is a working draft
- Sections marked with `>` are notes, not normative requirements
- FORBIDDEN sections are normative — do not use these endpoints
- Changelog entries must be added for each version
- Review before sharing externally

---

# RC-RAILWAY-003 Pre-Flight Reconnaissance (O1–O6)

> Read-only reconnaissance. No mutations. No deploys. No service creation.
> Session: 2026-09-27.

## O1 — Railway project inventory (read-only)

Status: OK

Commands run:
- `railway whoami`
- `railway status`
- `railway status --json | head -c 200000 | jq . >/dev/null && echo PARSE_OK || echo PARSE_FAIL`
- `railway service list`
- `railway domain --service lodgist`

Findings:
- F1: Railway CLI authenticated as wonderstevie702@gmail.com | Evidence: LIVE
- F2: Project name = lodgist, Project ID = 46e8a12a-4123-4de8-b904-46b3883fb9be | Evidence: LIVE
- F3: Single environment: production (ID 8c7ffbd7-0c78-4f48-ad4a-b7f682a5592b) | Evidence: LIVE
- F4: Two services in production: lodgist (ID 7db5cf1e-6fbe-4f85-9849-130199fff2f6) and lodgist-api (ID 32bff927-2290-453a-af79-ebdf83e02ec6) | Evidence: LIVE
- F5: Postgres database linked (ID d0629dae-bab7-4aca-b436-e0d038b49e12, 0.2 GB / 4.9 GB, EU West) | Evidence: LIVE
- F6: status --json parses cleanly (PARSE_OK) | Evidence: LIVE
- F7: lodgist service domains: lodgist-production.up.railway.app (service domain) and lodgist.online (custom, port 8080, ACTIVE) | Evidence: LIVE
- F8: Canonical IDs verified: project ID 46e8a12a-4123-4de8-b904-46b3883fb9be matches; repo SHADOWSPARK-TECHNOLOGIES/lodgist matches service repo field | Evidence: LIVE

Unknowns raised: none

DoNot triggered: none (no create/delete/rename attempted)

---

## O2 — Does lodgist-api already exist?

Status: BLOCKED — gate triggered

Commands run:
- `railway service list` (revealed lodgist-api)
- `railway status` (confirmed Online status)

Findings:
- F9: lodgist-api ALREADY EXISTS and is Online | Evidence: LIVE
- F10: lodgist-api service ID = 32bff927-2290-453a-af79-ebdf83e02ec6 | Evidence: LIVE
- F11: lodgist-api URL = https://lodgist-api-production.up.railway.app | Evidence: LIVE
- F12: lodgist-api deployment ID = 96489f6e-7bb2-428b-8209-83e7c9803cab | Evidence: LIVE
- F13: lodgist-api repo = SHADOWSPARK-TECHNOLOGIES/lodgist (same as lodgist) | Evidence: LIVE
- F14: lodgist-api region = EU West | Evidence: LIVE
- F15: RC-RAILWAY-003 service-creation objective is BLOCKED — a prior attempt already landed; do NOT delete to "start clean" | Evidence: LOG

Unknowns raised:
- U1: Who created lodgist-api and when? (deployment ID 96489f6e present but no visible created-at in CLI output — need dashboard or deploy log to date it)
- U2: Is lodgist-api's current deployment the intended target for RC-RAILWAY-003, or a stale/wrong build? (next prompt must decide whether to re-deploy onto existing service or treat as blocker)

DoNot triggered:
- FORBIDDEN-DELETE: did not delete lodgist-api to "start clean" (per O2 gate)
- FORBIDDEN-CREATE: did not attempt to create a second lodgist-api service

---

## O3 — Backend deployability audit (local, read-only)

Status: OK

Commands run:
- `cd /home/moronto/src/lodgist/backend && ls -la`
- `cat package.json | jq '{name,version,scripts,engines,dependencies}'`
- `head -60 src/index.js` + `sed -n '60,200p' src/index.js`
- `find . -maxdepth 2 \( -name 'railway.toml' -o -name 'railway.json' -o -name 'Dockerfile' \)`
- `test -f .railwayignore && cat .railwayignore || echo "NO_RAILWAYIGNORE"`
- `cat Dockerfile`

Findings:
- F16: package.json name = lodgist-backend, version = 1.0.0 | Evidence: REPO
- F17: `start` script defined: `node src/index.js` | Evidence: REPO
- F18: `engines` field is null (no Node version pin in package.json) | Evidence: REPO
- F19: src/index.js binds to `process.env.PORT || 4000` (env-var driven, fallback 4000) | Evidence: REPO
- F20: src/index.js binds to `process.env.HOST || "0.0.0.0"` (env-var driven, fallback 0.0.0.0 — NOT localhost/127.0.0.1) | Evidence: REPO
- F21: Health route exists at `GET /api/health`, returns JSON (`res.json({...})`) with fields: status, service, version, timestamp, uptime, database.{status,latencyMs}, memory | Evidence: REPO
- F22: Health route performs a live DB connectivity check (`prisma.user.count()`) and reports dbStatus = "connected" | "disconnected" | "unknown" | Evidence: REPO
- F23: No railway.toml in backend/ | Evidence: LOCAL
- F24: No railway.json in backend/ | Evidence: LOCAL
- F25: Dockerfile exists in backend/ (multi-stage: node:22-alpine builder + runtime, non-root USER node, EXPOSE 8080, HEALTHCHECK on /api/health) | Evidence: REPO
- F26: No .railwayignore in backend/ | Evidence: LOCAL
- F27: Dockerfile EXPOSE is 8080 but index.js default PORT fallback is 4000 — potential port mismatch if env PORT is not set; Railway sets PORT automatically but the Dockerfile CMD runs `node backend/src/index.js` without overriding PORT | Evidence: REPO
- F28: Production startup guards crash at boot if JWT_SECRET, CORS_ORIGIN, WEBAUTHN_RP_ID, or WEBAUTHN_ORIGIN are missing/misconfigured in production | Evidence: REPO
- F29: CORS fail-closed: in production with no CORS_ORIGIN, returns empty origin list (no external origins allowed) | Evidence: REPO
- F30: Dockerfile build stage uses `npm install --omit=dev --production` for backend, but packages/db uses `npm install --legacy-peer-deps --no-package-lock` with explicit dependency versions (not from a lockfile) | Evidence: REPO

Unknowns raised:
- U3: Is the PORT mismatch (Dockerfile EXPOSE 8080 vs default 4000) intentional? Does the existing lodgist-api deployment set PORT=8080 as a Railway variable? (F27)
- U4: packages/db has no lockfile in the Dockerfile install step — is that the intended build path, or was a pnpm workspace lockfile expected? (F30)
- U5: No `engines` field in package.json — does the existing lodgist-api service pin a Node version via Railway runtime settings or a Dockerfile FROM? (F18)

DoNot triggered: none

---

## O4 — Next service env (name-only, no values)

Status: OK

Commands run:
- `railway variables --service lodgist | awk -F= '{print $1}' | sort`

Findings:
- F31: NEXT_PUBLIC_API_URL: PRESENT | Evidence: LIVE
- F32: Full variable set for lodgist service includes: CORS_ORIGIN, DATABASE_URL, DIRECT_URL, HOST, HOSTNAME, JWT_SECRET (redacted), NEXTAUTH_SECRET (redacted), NEXTAUTH_URL, NEXT_PUBLIC_API_URL, NODE_ENV, RAILPACK_INSTALL_CMD, RAILWAY_ENVIRONMENT, RAILWAY_ENVIRONMENT_ID, RAILWAY_ENVIRONMENT_NAME, RAILWAY_PRIVATE_DOMAIN, RAILWAY_PROJECT_ID, RAILWAY_PROJECT_NAME, RAILWAY_PUBLIC_DOMAIN, RAILWAY_SERVICE_ID, RAILWAY_SERVICE_LODGIST_API_URL, RAILWAY_SERVICE_LODGIST_URL, RAILWAY_SERVICE_NAME, RAILWAY_STATIC_URL, WEBAUTHN_ORIGIN, WEBAUTHN_RP_ID | Evidence: LIVE
- F33: REDACTED — JWT_SECRET, NEXTAUTH_SECRET shown as redacted in report; values NOT printed per refusal rules | Evidence: LIVE
- F34: RAILWAY_SERVICE_LODGIST_API_URL = lodgist-api-production.up.railway.app (confirms Next knows about the existing API service) | Evidence: LIVE
- F35: RAILWAY_SERVICE_LODGIST_URL = lodgist.online | Evidence: LIVE

Unknowns raised: none

DoNot triggered:
- FORBIDDEN-PRINT-SECRET: did not print JWT_SECRET or NEXTAUTH_SECRET values (redacted, reported PRESENT NOT SHOWN)

---

## O5 — Repo state

Status: OK

Commands run:
- `git rev-parse HEAD`
- `git branch --show-current`
- `git status --porcelain`
- `git ls-files | grep -c '\.env'`
- `git ls-files | grep -c 'github.authkey'`

Findings:
- F36: HEAD SHA = b4a54747f9b039dc097fea02407d85c3af93eeeb | Evidence: REPO
- F37: Current branch = cursor/lodgist-prod-config-4cbdd | Evidence: REPO
- F38: Dirty-file count = 4 (tracked modifications: .cursor/rules/99-agent-orchestrator.mdc, .gitignore; plus untracked: docs/CONTEXT-TRANSFER.md, docs/TRACK_B.md, docs/contracts/, skills-lock.json, .agent/, .agents/, .claude/skills/) | Evidence: REPO
- F39: Tracked .env files = 2 | Evidence: REPO
- F40: github.authkey IS tracked (count = 1) | Evidence: REPO
- F41: Canonical branch cursor/lodgist-prod-config-4cbdd matches prompt expectation | Evidence: REPO

Unknowns raised:
- U6: Which 2 tracked .env files exist? (counts only; file names not printed — should be identified before any service creation to confirm they're not production secrets)
- U7: github.authkey is tracked in the repo — is it a real secret or a placeholder? (count = 1 confirms presence; content not read per refusal rules)

DoNot triggered:
- FORBIDDEN-READ-SECRET: did not cat any .env file or github.authkey content (name-only counts reported)

---

## O6 — Lockfile / monorepo shape

Status: OK

Commands run:
- `ls /home/moronto/src/lodgist/*.lock* /home/moronto/src/lodgist/*/pnpm-lock.yaml 2>/dev/null`
- `ls /home/moronto/src/lodgist/pnpm-workspace.yaml /home/moronto/src/lodgist/package.json 2>/dev/null`

Findings:
- F42: Two pnpm-lock.yaml files exist: frontend/pnpm-lock.yaml and lodgist/pnpm-lock.yaml | Evidence: LOCAL
- F43: Root package.json exists at /home/moronto/src/lodgist/package.json | Evidence: LOCAL
- F44: No pnpm-workspace.yaml found at repo root | Evidence: LOCAL
- F45: backend/ uses package-lock.json (npm), NOT pnpm-lock.yaml — backend is on npm, not pnpm | Evidence: REPO
- F46: The Next.js "two lockfile" warning (F09: /app/pnpm-lock.yaml and /app/lodgist/pnpm-lock.yaml) is a BUILD-CONFIG problem, not expected — two pnpm-lock.yaml files in sibling directories without a pnpm-workspace.yaml means Next cannot determine which lockfile is canonical | Evidence: LOCAL
- F47: Monorepo shape: root package.json + frontend/pnpm-lock.yaml + lodgist/pnpm-lock.yaml + backend/package-lock.json (npm) — mixed package managers across workspaces | Evidence: LOCAL

Unknowns raised:
- U8: Is the root package.json a pnpm workspace root (with `packages` field) despite missing pnpm-workspace.yaml, or is it a plain root package? (F44 — file read needed to confirm workspace field)
- U9: Which pnpm-lock.yaml does the existing lodgist-api deployment use — frontend/ or lodgist/? (F46 — deployment variable RAILPACK_INSTALL_CMD = `pnpm install --frozen-lockfile` but no --dir flag visible; need to confirm which workspace it targets)

DoNot triggered: none

---

# Pending patches to CONTEXT-TRANSFER

## §2 F-rows to append (findings not yet woven into sections)

- F1–F8 (O1): Railway inventory — already reflected in §2 narrative if present; otherwise append as Layer 14 or a new "Railway Deployment State" sub-section.
- F9–F15 (O2): lodgist-api already exists — append as a gated finding under "Service Creation State".
- F16–F30 (O3): Backend deployability — append as "Backend Deployment Readiness".
- F31–F35 (O4): Next service env — append as "Next.js Environment Variables (lodgist service)".
- F36–F41 (O5): Repo state — append as "Repository State at Pre-Flight".
- F42–F47 (O6): Lockfile/monorepo — append as "Lockfile and Monorepo Shape".

## §9 Changelog row to append

- v1.1.3 | 2026-09-27 | RC-RAILWAY-003 pre-flight reconnaissance (read-only). O1–O6 findings appended. lodgist-api already exists — creation gated. See §2 F9–F15 and U1–U2.

## Unknowns requiring resolution before RC-RAILWAY-003 execution

- U1: Date/time of lodgist-api creation (deployment ID 96489f6e)
- U2: Is lodgist-api's current deployment the intended target, or a stale build?
- U3: PORT mismatch — Dockerfile EXPOSE 8080 vs default 4000; does existing service set PORT=8080?
- U4: packages/db no lockfile in Dockerfile — intended or gap?
- U5: No engines field — how is Node version pinned on existing service?
- U6: Which 2 tracked .env files exist?
- U7: Is tracked github.authkey a real secret or placeholder?
- U8: Does root package.json declare a `packages` workspace field?
- U9: Which pnpm-lock.yaml does lodgist-api deployment consume?

---

*End of RC-RAILWAY-003 pre-flight reconnaissance. No mutations performed.*
