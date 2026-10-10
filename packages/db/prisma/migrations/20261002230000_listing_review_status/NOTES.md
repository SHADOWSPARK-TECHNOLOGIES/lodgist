# Listing review status

Migration: `20261002230000_listing_review_status`

One column on `Listing`: `reviewStatus` (`ListingReviewStatus`), default `NOT_REVIEWED`.

`APPROVED` means Lodgist reviewed the home and approved it for public display. The public label is **Lodgist-reviewed**.

That is not verification. The public verification label stays **Not verified by Lodgist** until checks are actually completed. This migration does not mark any row `APPROVED`, and it does not change `status` or `riskState`.

Paystack `charge.success` confirms a booking or escrow payment. It must not set `reviewStatus`, `status`, or `riskState` on the listing, and it must not produce a verified badge.

Apply this migration before the API that selects `reviewStatus`.
