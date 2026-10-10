# Lodgist phase 1

Brand: Lodgist is the product. ShadowSpark Technologies is the curator. The navbar stays Lodgist. The relationship is in the footer, About, Trust Center, and a single line on sign-in.

## Routes now

- `/` home, three steps, Nigeria context
- `/listings` search, max annual rent (API `maxPrice`), empty vs error vs no-match
- `/trust` what we check and what we do not guarantee
- `/about` curator relationship
- `/login` and `/register` small curator line

## Score, with evidence

| Category | Weight | Now | Why not full |
|---|---:|---:|---|
| Product clarity | 10 | 6 | Home and Trust Center explain the job. No listing-detail decision page yet. |
| Renter journey | 15 | 6 | Browse and WhatsApp exist. Inspection booking is not a finished screen. |
| Trust and safety | 15 | 7 | Fake 75 Trust Score removed. Trust Center states the inspection limit. Report flow is WhatsApp, not an in-app form. |
| Search and listings | 10 | 5 | Area search and max rent call the real API. No area, type, or sort chips. Marketplace is empty in production. |
| Visual system | 10 | 4 | Tokens file matches existing CSS. Screens are not rebuilt on it. |
| Mobile | 10 | 4 | Existing layout stacks. Not measured at 320–1440. |
| Accessibility | 10 | 3 | Search fields have labels. No keyboard, contrast, or screen-reader pass. |
| Performance | 10 | 4 | Production home returns 200. No Lighthouse run this pass. |
| WhatsApp conversion | 5 | 3 | Empty state asks for an area on WhatsApp. |
| QA and production | 5 | 3 | `npm run build` is the gate for this branch. No analytics events. |

CURRENT SCORE: 45/100
TARGET: 100/100

P0: production has no checked homes, so the journey ends at the empty state.
P1: listing detail still does not show move-in cost, last checked, and what remains unchecked on one screen.
P2: design tokens are not yet the source for every component.

Do not call this 100/100.
