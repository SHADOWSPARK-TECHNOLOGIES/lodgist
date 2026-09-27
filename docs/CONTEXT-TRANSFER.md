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
