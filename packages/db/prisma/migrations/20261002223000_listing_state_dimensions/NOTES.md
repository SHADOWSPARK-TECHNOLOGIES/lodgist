# Listing state dimensions

Migration: `20261002223000_listing_state_dimensions`

Additive columns on `Listing`. `status` and `riskState` stay. Public browse still filters on those, plus the sample JSON flag, the same way as #36.

| Column | Enum | Default for new rows |
|---|---|---|
| `origin` | `ListingOrigin` | `DIRECT_SUBMISSION` |
| `publication` | `ListingPublication` | `PUBLISHED` |
| `availability` | `ListingAvailability` | `UNKNOWN` |
| `verification` | `ListingVerification` | `NOT_CHECKED` |
| `locationPrecision` | `ListingLocationPrecision` | `UNKNOWN` |
| `actionEligibility` | `ListingActionEligibility` | `ENQUIRY` |

## Backfill

- Origin is direct submission. There is no source column, so nothing becomes an authorized import or an external reference.
- Publication follows status and risk: rejected and archived become removed; fraud, flagged, and suspended risk become suspended; pending and verified become published.
- Availability stays unknown. `availableFrom` is not inventory confirmation.
- Verification stays not checked, except `riskState = UNDER_REVIEW`, which becomes pending. `ListingStatus.VERIFIED` and `RiskState.VERIFIED` do not become `CHECKS_COMPLETED`.
- Location precision stays unknown. The public listing API still returns a snapped area and does not add an exact pin.
- Action eligibility follows the existing viewing gate: verified and not fraud-flagged can take a viewing request; pending and not fraud-flagged can take an enquiry; everything else is source link only.

Samples are not a column. They stay hidden in the public serializer.

## Deploy

Apply this migration before the API that selects the six columns. A select against a database that has not migrated fails the way a missing `riskState` column does.
