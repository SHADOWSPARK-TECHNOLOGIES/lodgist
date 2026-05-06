# Lodgist Project Context

## Identity
- Project: Lodgist — AI-powered property marketplace, Nigeria (starting Imo State)
- GCP Project: shadowspark-production-489115
- Active Account: architect@shadowspark-tech.org
- Stack: Next.js 15, Prisma 7, Express, PostgreSQL (AWS RDS), Vertex AI Gemini 2.5 Flash

## Active Services
- Truth Sentinel: packages/ai-core (port 4001) — fraud detection API
- Shared DB: packages/db — @lodgist/db Prisma client with PrismaPg adapter
- Service Account: truth-sentinel-core@shadowspark-production-489115.iam.gserviceaccount.com
- Key: lodgist-deploy-key.json (project root)

## AI Model Rules
- Default model: gemini-2.5-flash (production GA)
- Use gemini-2.5-flash-lite for high-volume WhatsApp bot responses
- Use gemini-2.5-pro ONLY for complex legal document reasoning
- Always use structured JSON output with max_output_tokens: 512

## Core Schemas
- User: id, email, role, truthIndex
- Listing: id, plotNumber, ownerName, location, status
- AIFraudSignal: id, listingId, signalType, confidence, metadata

## Active Endpoints
- POST /verify-land — plot_number + owner_name fraud check
- POST /update-truth-index — Truth Index 2.0 score update
- GET /health — liveness probe

## Priorities
1. Wire Vertex AI to /verify-land endpoint
2. Build WhatsApp webhook integration
3. Deploy ADK fraud detection agent
