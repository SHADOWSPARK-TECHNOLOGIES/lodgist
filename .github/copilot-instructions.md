# Copilot Instructions for Lodgist

## Quick Start

**Lodgist** is an AI-powered property marketplace platform for Nigeria (starting with Imo State). The codebase is organized as a polyrepo (not a single monorepo) with three separate services sharing a common database layer.

## Architecture

### Service Structure
```
lodgist/
├── frontend/          Next.js 16.2.4 app (React 19, TypeScript) – port 3000
├── backend/           Express.js API server – port 4000
├── packages/
│   ├── ai-core/       Truth Sentinel fraud detection (Express) – port 4001
│   └── db/            Shared @lodgist/db (Prisma 7 + PostgreSQL)
├── infra/             AWS CDK infrastructure (TypeScript)
└── packages/          (Other shared packages: utilities, types, etc.)
```

### Services Overview

**Frontend** (`/frontend`)
- Next.js 16.2.4 with React 19 (breaking changes from v15; read node_modules/next/dist/docs/ before major changes)
- TypeScript, Tailwind CSS 4, ESLint 9
- Deployed to Vercel (see `vercel.json`)

**Backend API** (`/backend`)
- Express.js server with CORS, JSON body parsing (10mb limit)
- Routes: users, listings, verification, ai-analysis, agreements, transactions, rent, escrow, whatsapp
- Health check: `GET /api/health`
- Database: Prisma client from `@lodgist/db`
- Tests: Vitest + Supertest framework exists but minimal coverage

**Truth Sentinel (AI Core)** (`/packages/ai-core`)
- Express fraud detection service
- Core endpoint: `POST /verify-land` (plot_number, owner_name)
- Uses Google Cloud Vision (optional GCP key at `lodgist-deploy-key.json`)
- Integrates Vertex AI Gemini models and OpenAI
- Tests: Vitest with coverage (v8 provider)

**Database Layer** (`/packages/db`)
- Prisma 7 with PrismaPg adapter (PostgreSQL on AWS RDS)
- Config: `prisma.config.ts` (TypeScript-based)
- Shared `@lodgist/db` client exported from `src/client.js`
- Schema: User, Listing, Booking, Escrow, WhatsApp integration models, Fraud signals

### Database Specifics
- **Connection**: PostgreSQL via `DATABASE_URL` env var (AWS RDS endpoint)
- **Enums**: Role, ListingCategory, ListingStatus, BookingStatus, ViewingStatus, EscrowStatus, NotificationType, Currency
- **Key entities**: User (truthIndex, role-based), Listing, Booking, ViewingRequest, EscrowTransaction, WhatsAppSession, FraudReport
- **External integrations**: WhatsApp Cloud API, Paystack payments, Gemini 2.5 Flash LLM

---

## Build, Test & Lint Commands

### Frontend (`/frontend`)
```bash
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Build for production
npm start                # Start production server
npm run lint             # Run ESLint (eslint .)
```

### Backend (`/backend`)
```bash
npm run dev              # Start with --watch (auto-reload on changes)
npm start                # Start production server (PORT 4000 default)
```

### Truth Sentinel AI Core (`/packages/ai-core`)
```bash
npm run dev              # Start with --watch
npm start                # Start production (PORT 4001 default)
npm test                 # Run Vitest suite
npm run db:generate      # Generate Prisma client
```

### Database (`/packages/db`)
```bash
npm run generate         # Generate Prisma client (required after schema changes)
npm run db:push          # Push schema changes to DB (no migration file)
npm run db:migrate       # Create and run migration (interactive)
npm run db:studio        # Open Prisma Studio GUI (http://localhost:5555)
npm run db:seed          # Run seed.js or seed.ts
```

### Running Individual Tests (where applicable)
```bash
# AI Core – run specific test file
cd packages/ai-core && npm test -- escrow.test.js

# Backend – uses Supertest
cd backend && npm test  # (if test script is added)
```

---

## Key Conventions & Patterns

### Environment Variables
Each service has a `.env.example` template:
- `backend/.env.example` → `DATABASE_URL`, `WHATSAPP_*`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `PAYSTACK_*`, `PORT`, `NODE_ENV`
- `packages/ai-core/.env` follows same pattern
- **Critical**: `DATABASE_URL` is shared across all services; set once at the system level or in each `.env`
- GCP key path: `GOOGLE_APPLICATION_CREDENTIALS` (optional; service auto-skips if missing)

### Code Organization

**Frontend** (`/frontend/src`)
- `/app` – Next.js 15 App Router structure
- `/page.tsx` – Root page component
- `/search` – Search feature directory
- Globals CSS: `/app/globals.css` (Tailwind)

**Backend Routes** (`/backend/src/routes`)
- Each route file is a module exporting Express router
- Pattern: `router.js` with `app.use("/api/path", router)`
- Notable: `escrow.js`, `whatsapp.js`, `listings.js` use factory functions accepting `prisma` instance

**Database Prisma**
- Enum-driven models (Role, ListingStatus, etc.)
- Relations: User → Listing (1:N), Listing → Booking (1:N), User → EscrowTransaction (2x relations)
- Use `mode: "insensitive"` for case-insensitive string searches

### Prisma Workflow
1. **Edit schema** → `packages/db/prisma/schema.prisma`
2. **After schema changes**:
   ```bash
   cd packages/db
   npm run generate           # Regenerate client types
   npm run db:push            # (Quick: no migration file)
   # OR
   npm run db:migrate         # (Tracked: creates migration file)
   ```
3. **Regenerate in dependent services**:
   ```bash
   cd packages/ai-core && npm run db:generate
   ```

### Importing the Shared Database Client
All services import Prisma the same way:
```javascript
const prisma = require("../../packages/db/src/client");
// or from frontend/backend
const { PrismaClient } = require("@prisma/client");
```

### Naming & File Conventions
- **Route handlers**: snake_case file names (e.g., `whatsapp.js`, `ai-analysis.js`)
- **Environment**: Variable names UPPER_SNAKE_CASE
- **API endpoints**: `/api/{resource}/{action}` (e.g., `/api/whatsapp/webhook`, `/api/escrow/{id}`)
- **Error responses**: JSON with `{ success: false, error: "message" }` or `{ error: "..." }`

### Deployment & CI/CD
- **Backend**: Render Blueprint (`render.yaml`) – Docker build from `backend/Dockerfile`, health check at `/api/health`
- **Frontend**: Vercel (`vercel.json`) – automatic deployment from `main` branch
- **Infrastructure**: AWS CDK stack in `/infra` (see `infra/README.md` for CDK commands)
- **Environment secrets**: Managed per platform (Render dashboard, Vercel Settings, AWS Secrets Manager)

### pnpm Workspace Note
- Root has no `package.json` (not a workspace root)
- Each service manages its own `node_modules` independently
- `pnpm-lock.yaml` files are per-service; commit all of them
- **pnpm-specific**: `@lodgist/db` dependency uses `pnpm` config key for build dependencies

### Testing Strategy
- **AI Core** (`packages/ai-core`): Vitest + Supertest for endpoint testing
- **Backend**: Vitest setup exists but coverage is minimal; use Supertest for endpoint tests
- **Frontend**: ESLint only (no unit/E2E tests configured)
- Run: `npm test` in the service directory

### Important: Next.js Version 16.2.4
The frontend uses Next.js 16.2.4, which has breaking changes from your training data (v14–v15). Before writing or modifying Next.js code:
1. Check the breaking changes in `node_modules/next/dist/docs/`
2. Read deprecation warnings carefully
3. Verify App Router patterns are correct (not Pages Router)

---

## Common Tasks

### Add a New API Endpoint
1. Create route file in `/backend/src/routes/feature.js`
2. Export an Express router (or factory function if it needs `prisma`)
3. Import in `/backend/src/index.js` and call `app.use("/api/feature", router)`
4. Test with Supertest in `/backend/__tests__/`

### Modify Database Schema
1. Edit `/packages/db/prisma/schema.prisma`
2. Run `cd packages/db && npm run db:migrate` (tracked) or `npm run db:push` (untracked)
3. Run `npm run generate` to update client types
4. If AI Core uses the schema, run `cd packages/ai-core && npm run db:generate`

### Deploy Backend to Render
1. Push to `main` branch
2. Render auto-deploys based on `render.yaml` config
3. Verify health check: `GET /api/health`
4. Set environment variables in Render dashboard (secrets not in version control)

### Test Fraud Detection
1. Ensure `GOOGLE_APPLICATION_CREDENTIALS` points to a valid GCP key
2. Call: `POST http://localhost:4001/verify-land` with `{ plot_number: "...", owner_name: "..." }`
3. Response includes fraud signals, truth index, and confidence scores

---

## WhatsApp Integration

### Webhook Setup
- **Endpoint**: `POST /api/whatsapp/webhook` (backend)
- **Verification**: Meta sends `x-hub-signature-256` header (HMAC-SHA256)
- **Environment Variables**:
  - `WHATSAPP_API_TOKEN` — Bearer token for Cloud API calls
  - `WHATSAPP_PHONE_NUMBER_ID` — Your Meta Business phone number ID
  - `WHATSAPP_APP_SECRET` — Used for webhook signature verification
  - `WHATSAPP_VERIFY_TOKEN` — Custom token for initial challenge (env only; no committed fallback)

### Webhook Signature Verification
The WhatsApp router verifies incoming webhooks:
```javascript
// Example: Backend will check x-hub-signature-256 header
// Signature format: sha256=<hex-digest>
```

### Fraud Analysis on Messages
All incoming WhatsApp messages are scanned for fraud indicators:
- **High-risk patterns** (+0.25 score): "pay before", "wire transfer", "western union", "crypto", "abroad", "urgent payment"
- **Medium-risk patterns** (+0.1 score): "discount", "limited time", "hurry", "no viewing"
- Score clamped to 0–1; patterns trigger `WhatsAppMessage` record with fraud metadata

### Sending Messages
The WhatsApp router provides `sendWhatsAppMessage(to, text)` function:
- Calls Meta Cloud API at `https://graph.instagram.com/v20.0/{PHONE_NUMBER_ID}/messages`
- Requires valid `WHATSAPP_API_TOKEN`
- Returns message ID or error

---

## Vertex AI & Gemini Integration

### Configuration
- **Default Model**: `gemini-2.5-flash` (production GA)
- **Location**: `us-central1` (default; override with `GCP_PROJECT_LOCATION`)
- **Project**: `shadowspark-production-489115` (override with `GCP_PROJECT_ID`)
- **Service Account**: `truth-sentinel-core@shadowspark-production-489115.iam.gserviceaccount.com`
- **Key File**: `lodgist-deploy-key.json` (optional; service auto-skips if missing)

### Gemini Service (Backend)
Located: `/backend/src/services/geminiService.js`
- **Graceful Fallbacks**: If GCP credentials are missing, all functions return safe defaults
- **Image Analysis**: `analyzeVisualFraud(imageBase64)` — detects stock photos, watermarks, digital alterations
- **Response Format**: JSON with `risk_score (0-100)`, `red_flags (array)`, `summary (string)`
- **Config**: `responseMimeType: "application/json"`, `temperature: 0.2`, `maxOutputTokens: 512`

### Truth Sentinel Endpoints (AI Core)
Located: `/packages/ai-core/src/index.js`

**`POST /verify-land`** — Core fraud detection
```json
Request:
{
  "plot_number": "IM/8/345",
  "owner_name": "Emeka Okafor"
}

Response:
{
  "success": true,
  "verified": boolean,
  "match_count": number,
  "evidence": [
    {
      "listingId": number,
      "title": string,
      "fraudSignals": [
        { "score": number, "reasoning": string }
      ]
    }
  ],
  "summary": string
}
```

**`POST /update-truth-index`** — Update user Truth Index 2.0
```json
Request (one of):
{
  "user_id": number,
  "activity_score": number,      // 0-100
  "verification_score": number,  // 0-100
  "rating_score": number         // 0-100
}
OR
{
  "user_id": number,
  "absolute_score": number       // Direct override, 0-100
}

Response:
{
  "success": true,
  "user_id": number,
  "previous_truth_index": number,
  "new_truth_index": number,
  "delta": number,
  "audited": number (audit trail ID)
}

Formula: Truth Index 2.0 = (0.4 × activity) + (0.3 × verification) + (0.3 × rating)
```

**`GET /health`** — Liveness probe
```json
Response:
{
  "status": "ok",
  "timestamp": ISO8601,
  "uptime": seconds
}
```

### Fraud Detection Utils
Located: `/packages/ai-core/src/utils/fraudChecks.js`
- **`checkDuplicateLandlordPhone(listing)`** — Finds users with same phone across accounts (score: 40)
- **`checkPriceAnomaly(listing)`** — Compares listing price to median in area (score: 15–30)
- **`performImageReverseSearch(imageUrl)`** — Reverse image lookup (using Google Cloud Vision)

---

## Database Seeding

### Seed Script
Located: `/packages/db/prisma/seed.ts` (TypeScript)

### Running Seeds
```bash
cd packages/db
npm run db:seed
```

### Seed Process
1. **Deletes all existing data** in dependency order (messages → sessions → ... → users)
2. **Creates test users**:
   - Admin: `admin@lodgist.ng` (password: `Admin2026!`)
   - Landlord: `emeka@lodgist.ng` (password: `Landlord2026!`)
   - Tenant: `chioma@lodgist.ng` (password: `Tenant2026!`)
3. **Creates sample properties** across Nigeria (Lagos, FCT, Rivers, Imo)
4. **Creates listings** with pricing, images, and mock fraud signals
5. **Creates bookings, escrow transactions, and viewing requests**

### Default Seed Data
- **6 Properties**: Distributed across Lagos, Wuse (FCT), Port Harcourt, Owerri
- **Currencies**: NGN primary (with USD, GBP, EUR support)
- **Categories**: RESIDENTIAL, COMMERCIAL, SHORT_LET
- **Booking Statuses**: PENDING, CONFIRMED, CANCELLED, COMPLETED
- **Move-in Costs**: Includes base_rent, agency_fee, legal_fee, caution_fee, inspection_fee

### Password Hashing
Seeds use bcryptjs v3 with cost factor 12 (async hashing)

---

## Architecture Decisions & Gotchas

### Polyrepo Structure
- **No root `package.json`** — Each service is independent
- **Lock files committed** — `pnpm-lock.yaml` per service to ensure reproducible installs
- **Shared database** — All services connect to same PostgreSQL database via `DATABASE_URL`
- **Shared client**: `@lodgist/db` exports Prisma client from `packages/db/src/client.js`

### Prisma 7 with PrismaPg Adapter
- Uses `@prisma/adapter-pg` for direct PostgreSQL connection (not via `libpq`)
- Config: `prisma.config.ts` (TypeScript-based, not `schema.prisma`)
- **After schema changes**: Always run `npm run generate` to regenerate client types before using in code

### Truth Index 2.0 Formula
```
Truth Index = (0.4 × activity_score) + (0.3 × verification_score) + (0.3 × rating_score)
Range: 0–100 (clamped)
Audit Trail: Every update creates an `AIFraudSignal` record with metadata
```

### WhatsApp Message Fraud Scoring
- Scores accumulate per detected pattern (can exceed 1.0, then clamped)
- High-risk patterns worth more than medium-risk
- Stored in `WhatsAppMessage.metadata` for future audit/review

### Environment Variables Are Shared
- `DATABASE_URL` must be set once (used by frontend, backend, AI core)
- If set at system level (`.bashrc`, `.zshrc`), no need to set in each `.env`
- Development: Each service reads its own `.env` file (ignored by git)

### Next.js 16.2.4 Gotchas
- **Breaking from v15**: Check `node_modules/next/dist/docs/` before major changes
- **App Router only** — No Pages Router support
- **Vercel deployment**: Automatic on `main` branch push (see `vercel.json`)
- **TypeScript strict mode**: Enabled; watch for `@types/react-dom` version compatibility

### Google Cloud Credentials Handling
- If `GOOGLE_APPLICATION_CREDENTIALS` file doesn't exist or is empty, services gracefully disable GCP features
- No error is thrown; conversely, services log warnings and continue
- `lodgist-deploy-key.json` is in `.gitignore` (never committed)

### Port Allocation
| Service | Default Port | Override |
|---------|--------------|----------|
| Frontend | 3000 | `npm run dev -- -p 3001` (Next.js) |
| Backend API | 4000 | `PORT=5000 npm start` |
| AI Core (Truth Sentinel) | 4001 | `PORT=4002 npm start` |
| Prisma Studio | 5555 | `cd packages/db && npm run db:studio` |

---

## Troubleshooting

**"Cannot find module '@lodgist/db'"**
- Run `cd packages/db && npm run generate` to create Prisma client
- Ensure `DATABASE_URL` is set

**Prisma version mismatch**
- Delete `node_modules` and `pnpm-lock.yaml` in the affected service
- Reinstall: `npm install` or `pnpm install`

**Next.js breaking changes**
- Check `next.config.ts` for config syntax
- Verify App Router usage (not Pages Router)
- Run `npm run build` to catch compile errors early

**Port conflicts**
- Frontend: 3000 | Backend: 4000 | AI Core: 4001
- Override with `PORT` environment variable

---

## Useful Resources

- **Prisma 7 Docs**: https://www.prisma.io/docs/
- **Next.js 16 Docs**: https://nextjs.org/docs (beware breaking changes vs. v15)
- **Express.js**: https://expressjs.com/
- **Render Deployment**: https://render.com/docs/deploy-node-express-app
- **Vercel Deployment**: https://vercel.com/docs

---

## First-Time Setup Checklist

If you're starting work in this repository for the first time:

1. **Install dependencies**
   ```bash
   cd frontend && npm install && cd ../backend && npm install && cd ../packages/db && npm install && cd ../ai-core && npm install
   ```

2. **Generate Prisma client** (required before first run)
   ```bash
   cd packages/db && npm run generate
   ```

3. **Set up environment variables**
   ```bash
   # Create .env files from .env.example templates
   cp backend/.env.example backend/.env
   # Update DATABASE_URL, WhatsApp credentials, API keys in each .env
   ```

4. **Test database connection**
   ```bash
   cd packages/db && npm run db:studio  # Opens GUI at localhost:5555
   ```

5. **Seed database (optional but recommended for development)**
   ```bash
   cd packages/db && npm run db:seed
   ```

6. **Start services individually** (in separate terminals)
   ```bash
   # Terminal 1: Frontend
   cd frontend && npm run dev
   
   # Terminal 2: Backend API
   cd backend && npm start
   
   # Terminal 3: AI Core (Truth Sentinel)
   cd packages/ai-core && npm start
   ```

7. **Verify all services running**
   ```bash
   curl http://localhost:3000      # Frontend
   curl http://localhost:4000/api/health   # Backend
   curl http://localhost:4001/health       # AI Core
   ```

---

## Quick Debugging Tips

**Database queries not working after schema change?**
1. Regenerate Prisma client: `cd packages/db && npm run generate`
2. Restart the service using the database

**WhatsApp webhook failing?**
1. Verify `x-hub-signature-256` header is present in request
2. Check `WHATSAPP_APP_SECRET` is correctly set
3. Use `npm run dev` to see request/response logs

**Gemini API returning empty response?**
1. Verify `GOOGLE_APPLICATION_CREDENTIALS` points to valid key file
2. Check `GCP_PROJECT_ID` matches your project (default: `shadowspark-production-489115`)
3. Ensure Vision API is enabled in GCP console

**Port already in use?**
```bash
# Find process using port
lsof -i :4000  # Replace with any port number
# Kill it
kill -9 <PID>
```

---

*Last updated: 2026-05-13*
*Enhanced with WhatsApp, Vertex AI, seeding, and architecture details*
