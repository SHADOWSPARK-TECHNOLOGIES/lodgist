# /seed-and-fixtures

Seed the Neon database with realistic test data for development and demo purposes.

## Pre-flight

1. Check existing seed files: `ls packages/db/prisma/seed*`
2. Check for existing data: query listing count from DB
3. Confirm connection: `cd lodgist && npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"Listing\";" 2>&1`

## Seed Categories

### 1. Core listings (general)
- 6 listings across Lagos, Abuja, Rivers, Enugu
- Mix of VERIFIED (truthIndex 85–96), UNVERIFIED (0), UNDER_REVIEW (45–65), FLAGGED (22)
- Each with 2–3 TrustComponents set to passed:true

### 2. Student lodge listings
- 8 listings in Imo State (FUTO, IMSU, Poly Nekede, Alvan Ikoku, Imo Poly)
- isStudentLodge: true, nearbySchool and distanceToSchool populated
- Mix of verification states

### 3. Trust components
- All 6 canonical components per listing (from TRUST_WEIGHTS in computeTruthIndex.ts)
- Passed states match the listing's truthIndex

## Run Order

```bash
# 1. Generate Prisma client
cd lodgist && npx prisma generate

# 2. Run main seed
npx tsx ../packages/db/prisma/seed.ts

# 3. Run trust seed
npx tsx ../packages/db/prisma/seed-trust.ts

# 4. Run student seed (if it exists)
npx tsx ../packages/db/prisma/seed-students.ts 2>/dev/null || echo "No student seed yet"

# 5. Verify
npx prisma db execute --stdin <<< "SELECT id, title, \"riskState\", \"truthIndex\" FROM \"Listing\" LIMIT 10;"
```

## Output Format

```
## Seed Result

### Listings Created
- ID [x]: [title] — riskState: [state], truthIndex: [score]
- ...

### Trust Components
- Listing [x]: [N]/6 components passed

### Student Listings
- [N] student listings seeded

### Verification
SELECT count from "Listing": [N]
SELECT count from "TrustComponent": [N]
```
