# Phase 2 — Trust UI Components
# Paste this entire block into Claude CLI

You are building the Lodgist Trust Layer UI.
Read CLAUDE.md before proceeding. All rules there apply here.

## Pre-flight (do this first, report findings, then proceed)
1. Run: find components -name "PropertyCard*" -o -name "ListingCard*" | head -5
2. Run: find app pages -name "*listing*" -o -name "*property*" | grep -v node_modules | head -10
3. Run: cat tailwind.config.ts || cat tailwind.config.js
4. Confirm: App Router or Pages Router?
5. Confirm: Is SWR installed? (check package.json)

Report pre-flight findings in your first response block. Then proceed.

---

## Task 1 — components/trust/RiskStateBadge.tsx

Props: { state: 'VERIFIED' | 'UNVERIFIED' | 'UNDER_REVIEW' | 'FLAGGED' | 'SUSPENDED' }

State → style mapping:
| State | Background | Text | Icon | Label |
|---|---|---|---|---|
| VERIFIED | bg-[#1ABC9C] | text-white | ✓ checkmark SVG | Verified |
| UNVERIFIED | border border-gray-300 bg-white | text-gray-500 | clock SVG | Unverified |
| UNDER_REVIEW | bg-orange-100 | text-orange-700 | hourglass SVG | Being Verified |
| FLAGGED | bg-amber-100 | text-amber-800 | warning triangle SVG | Needs Attention |
| SUSPENDED | bg-red-100 | text-red-800 | lock SVG | Suspended |

Rules:
- Pill shape: rounded-full px-2.5 py-1
- Text: text-xs font-medium
- Icon: 12px inline SVG, mr-1
- All icons inline SVG — no icon library
- Export as named export AND default export

---

## Task 2 — components/trust/TruthIndexMeter.tsx

Props: { score: number; size?: 'sm' | 'md' | 'lg' }
Default size: 'md'

Color thresholds:
- 0–40:   #DC2626 (red)
- 41–69:  #FF6F3C (orange — brand)
- 70–89:  #0F9D7E (teal muted)
- 90–100: #1ABC9C (teal — brand)

Label below bar:
- 0–40:   "High Risk — Proceed with Caution"
- 41–69:  "More Verification Needed"
- 70–89:  "Good Standing"
- 90–100: "Fully Verified"

Size variants (bar height / font):
- sm: h-1.5, text-xs
- md: h-2.5, text-sm
- lg: h-4, text-base

Animate bar fill on mount using CSS transition (transition-all duration-700).
Show score as "{score}/100" right-aligned above the bar.

---

## Task 3 — components/trust/TrustPanel.tsx

Props interface (exact):
```ts
interface TrustPanelProps {
  riskState: 'VERIFIED' | 'UNVERIFIED' | 'UNDER_REVIEW' | 'FLAGGED' | 'SUSPENDED'
  truthIndex: number
  components: {
    label: string
    passed: boolean
    weight: number
    notes?: string
  }[]
  verificationStatus?: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | null
  onRequestVerification?: () => void
}
```

Layout (top to bottom):
1. RiskStateBadge (right-aligned, small)
2. TruthIndexMeter size="md" (full width)
3. Divider
4. Checklist heading: "Verification Checklist" text-sm font-semibold text-gray-700
5. Checklist items — for each component:
   - Teal checkmark (✓) if passed: true
   - Gray dash (–) if passed: false (neutral — not alarming)
   - Label text (text-sm)
   - Weight shown as chip: "30 pts" text-xs text-gray-400
   - If notes exist: clickable expand toggle showing notes text in text-xs text-gray-500
6. Conditional section:
   - If riskState === 'UNVERIFIED' AND verificationStatus is null/undefined:
     Orange button (full width on mobile): "Request Verification for This Property"
     Below: text-xs text-gray-400 "Free for landlords · Takes 2–5 days"
   - If verificationStatus === 'PENDING' or 'IN_REVIEW':
     Teal info box: "Verification in progress — we'll update this listing when complete"
   - If verificationStatus === 'REJECTED':
     Amber info box: "Verification was not approved. The landlord may resubmit with additional documents."
   - If verificationStatus === 'APPROVED' or riskState === 'VERIFIED':
     Show nothing extra (meter and checklist say it all)

Container: rounded-xl border border-gray-100 bg-white p-4 shadow-sm

---

## Task 4 — components/trust/TrustSkeleton.tsx

Loading state placeholder for TrustPanel while API data loads.
Use Tailwind animate-pulse.
Match TrustPanel's visual dimensions:
- Fake meter bar (h-2.5 w-full bg-gray-200 rounded)
- 6 fake checklist rows (h-4 bg-gray-100 rounded w-3/4)
- Fake button (h-10 bg-gray-100 rounded)

---

## Task 5 — Inject into PropertyCard

Find the existing PropertyCard (or ListingCard).
Add optional props (do NOT change existing props):
```ts
riskState?: string
truthIndex?: number
```

Changes inside the card:
1. Import RiskStateBadge
2. On the listing image container (find the existing image wrapper):
   - Add: className="relative" if not already present
   - Inside, top-right absolute: 
     {riskState && <RiskStateBadge state={riskState as any} className="absolute top-2 right-2 z-10" />}
3. Below listing price (find the price element):
   - Add: {truthIndex !== undefined && (
       <span className="text-xs text-gray-400">Trust Score: {truthIndex}/100</span>
     )}

Do NOT change any other existing props, layout, or styles.
Report the exact line numbers changed.

---

## Task 6 — Inject into ListingDetail

Find the existing listing detail page or component.
Find where the description section ends and where the contact/CTA section begins.
Between them, add:

```tsx
{/* Trust & Verification Section */}
<section className="mt-8 mb-6">
  <h2 className="text-lg font-semibold text-[#0B1B2B] mb-4">
    Trust & Verification
  </h2>
  {trustLoading ? (
    <TrustSkeleton />
  ) : trustData ? (
    <TrustPanel
      riskState={trustData.riskState}
      truthIndex={trustData.truthIndex}
      components={trustData.components}
      verificationStatus={trustData.verificationStatus}
      onRequestVerification={() => router.push(`/verify/${listing.id}`)}
    />
  ) : (
    <p className="text-sm text-gray-400">Trust data unavailable for this listing.</p>
  )}
</section>
```

Data fetching — add above the return statement:
```ts
const [trustData, setTrustData] = useState(null)
const [trustLoading, setTrustLoading] = useState(true)

useEffect(() => {
  fetch(`/api/listings/${listing.id}/trust`)
    .then(r => r.ok ? r.json() : null)
    .then(data => { setTrustData(data); setTrustLoading(false) })
    .catch(() => setTrustLoading(false))
}, [listing.id])
```

If SWR is installed, use useSWR instead — cleaner.

---

## Deliverables

Return in this exact format:

## Files Created
- [ ] components/trust/RiskStateBadge.tsx
- [ ] components/trust/TruthIndexMeter.tsx
- [ ] components/trust/TrustPanel.tsx
- [ ] components/trust/TrustSkeleton.tsx

## Files Modified
- [ ] <path to PropertyCard> — lines changed: X–Y
- [ ] <path to ListingDetail> — lines changed: X–Y

## Pre-flight Results
- Router type: App Router / Pages Router
- SWR installed: yes / no
- Existing card component: <path>
- Existing detail component: <path>
- Custom Tailwind colors: <list>

## Flags
- ⚠️ Any new classes not in Tailwind config
- ⚠️ Any new dependencies needed
- ⚠️ Any prop interface conflicts

## Verification
Manual test steps at 375px viewport.
