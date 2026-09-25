# Lodgist Backend — AWS App Runner Deployment Plan (via ECR)

## Overview

Deploy the Lodgist Express API backend to **AWS App Runner** by building a Docker image, pushing it to **Amazon ECR**, and creating an App Runner service from the image. The backend connects to an existing publicly-accessible PostgreSQL RDS instance in `us-east-1`.

**Target:** `us-east-1`  
**RDS:** Publicly accessible, no VPC needed  
**Auth:** New AWS CLI credentials (old compromised key revoked)  
**Secrets:** AWS Secrets Manager for API keys/tokens  

---

## Phase 1: Audit & Fix the Dockerfile

### Current State Analysis

The existing [`backend/Dockerfile`](../backend/Dockerfile) has several issues:

1. **Build context mismatch** — The Dockerfile references `backend/package.json` and `packages/db/package.json`, but the build context is the repo root. The `.dockerignore` is at the repo root, which is correct, but the `COPY` paths assume the build context is the repo root.
2. **Missing `packages/db/package-lock.json`** — `npm install` in the builder stage may resolve different dependency versions without a lockfile.
3. **No `.env` handling** — The runtime stage doesn't copy `.env.example` or handle env files. App Runner injects env vars at runtime, so this is fine, but we should ensure `dotenv` doesn't fail silently if no `.env` exists.
4. **`HEALTHCHECK` uses `wget`** — Alpine doesn't ship `wget` by default. Need to install it or switch to `node`-based health check.
5. **No non-root user** — The container runs as root. Best practice is to run as `node` user (available in `node:22-alpine`).

### Required Changes

| # | Change | File | Reason |
|---|--------|------|--------|
| 1 | Install `wget` in runtime stage or replace HEALTHCHECK with `node -e` | `Dockerfile` | Alpine lacks `wget` |
| 2 | Add `USER node` before `EXPOSE` | `Dockerfile` | Security best practice |
| 3 | Ensure `packages/db/package-lock.json` is copied if it exists | `Dockerfile` | Reproducible builds |
| 4 | Add `--production` flag to `npm install` in builder | `Dockerfile` | Skip devDependencies |
| 5 | Update `.dockerignore` to allow `packages/db/package-lock.json` | `.dockerignore` | Currently `*.lock` blocks it |

### Dockerfile Diff

```dockerfile
# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

WORKDIR /app

# Copy package files (including lockfiles for reproducibility)
COPY backend/package.json ./backend/
COPY backend/package-lock.json* ./backend/
COPY packages/db/package.json ./packages/db/
COPY packages/db/package-lock.json* ./packages/db/

# Copy source code preserving monorepo structure
COPY packages/db/src ./packages/db/src
COPY packages/db/prisma ./packages/db/prisma
COPY packages/db/prisma.config.ts ./packages/db/
COPY backend/src ./backend/src

# Install backend dependencies (production only)
RUN cd backend && npm install --omit=dev

# Install packages/db dependencies (prisma + dotenv needed for generate)
RUN cd /app/packages/db && npm install --legacy-peer-deps dotenv prisma

# Generate Prisma client
RUN cd /app/packages/db && npx prisma generate --config prisma.config.ts

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Install wget for health checks
RUN apk add --no-cache wget

# Copy everything preserving the monorepo structure
COPY --from=builder /app ./

# Switch to non-root user
USER node

# Expose the API port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

# Start the server
CMD ["node", "backend/src/index.js"]
```

### `.dockerignore` Diff

Remove `*.lock` from the ignore list (or be more specific):

```
# Remove this line:
*.lock

# Replace with:
# (lockfiles are needed for reproducible builds)
```

---

## Phase 2: Build & Test Docker Image Locally

### Steps

```bash
# 1. Build the image from repo root
cd /home/shadowweaver/Desktop/lodgist
docker build -t lodgist-backend:latest -f backend/Dockerfile .

# 2. Verify the image builds successfully
docker images lodgist-backend

# 3. Run a quick smoke test (local, with a test DATABASE_URL)
docker run --rm -p 4000:4000 \
  -e DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE" \
  -e NODE_ENV=development \
  -e PORT=4000 \
  lodgist-backend:latest

# 4. Test health endpoint
curl http://localhost:4000/api/health
# Expected: {"status":"ok","service":"Lodgist API","timestamp":"...","uptime":...}
```

### Validation Criteria
- [ ] Image builds without errors
- [ ] Container starts and listens on port 4000
- [ ] `GET /api/health` returns 200 with expected JSON
- [ ] Prisma client connects to RDS successfully (check logs for no connection errors)

---

## Phase 3: Create ECR Repository & Configure AWS Auth

### Prerequisites
- AWS CLI configured with new credentials (`aws configure`)
- Appropriate IAM permissions: `ecr:CreateRepository`, `ecr:GetAuthorizationToken`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`, `ecr:BatchCheckLayerAvailability`, `ecr:PutImage`

### Steps

```bash
# 1. Verify AWS CLI is working with new credentials
aws sts get-caller-identity

# 2. Create ECR repository
aws ecr create-repository \
  --repository-name lodgist-backend \
  --region us-east-1 \
  --image-tag-mutability MUTABLE \
  --image-scanning-configuration scanOnPush=true

# 3. Note the repository URI from the output
# Example: <account-id>.dkr.ecr.us-east-1.amazonaws.com/lodgist-backend
```

### Output
- ECR Repository URI: `{account_id}.dkr.ecr.us-east-1.amazonaws.com/lodgist-backend`

---

## Phase 4: Tag & Push Docker Image to ECR

### Steps

```bash
# 1. Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  {account_id}.dkr.ecr.us-east-1.amazonaws.com

# 2. Tag the local image
docker tag lodgist-backend:latest \
  {account_id}.dkr.ecr.us-east-1.amazonaws.com/lodgist-backend:latest

# 3. Also tag with a versioned tag (e.g., git commit hash)
GIT_SHA=$(git rev-parse --short HEAD)
docker tag lodgist-backend:latest \
  {account_id}.dkr.ecr.us-east-1.amazonaws.com/lodgist-backend:${GIT_SHA}

# 4. Push both tags
docker push {account_id}.dkr.ecr.us-east-1.amazonaws.com/lodgist-backend:latest
docker push {account_id}.dkr.ecr.us-east-1.amazonaws.com/lodgist-backend:${GIT_SHA}
```

### Tagging Strategy
| Tag | Purpose |
|-----|---------|
| `latest` | Points to current stable build |
| `{git-sha}` | Immutable, traceable to commit |
| `v{major}.{minor}.{patch}` | (Future) Semantic version tags for releases |

---

## Phase 5: Create App Runner Service from ECR Image

### Option A: AWS CLI

```bash
# Create App Runner service from ECR image
aws apprunner create-service \
  --region us-east-1 \
  --service-name lodgist-api \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "{account_id}.dkr.ecr.us-east-1.amazonaws.com/lodgist-backend:latest",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "4000",
        "StartCommand": "node backend/src/index.js"
      }
    },
    "AutoDeploymentsEnabled": true
  }' \
  --health-check-configuration '{
    "Protocol": "TCP",
    "Path": "/api/health",
    "Interval": 10,
    "Timeout": 5,
    "HealthyThreshold": 3,
    "UnhealthyThreshold": 5
  }' \
  --instance-configuration '{
    "Cpu": "1 vCPU",
    "Memory": "2 GB"
  }'
```

### Option B: AWS Console (Manual)

Follow the steps in [`APPRUNNER_DEPLOY.md`](../APPRUNNER_DEPLOY.md) section 2, but select **"Container registry"** as source instead of source code, and paste the ECR image URI.

### Environment Variables (Plaintext)

| Key | Value | Source |
|-----|-------|--------|
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST:5432/DATABASE` | RDS |
| `NODE_ENV` | `production` | Static |
| `PORT` | `4000` | Static |
| `HOST` | `0.0.0.0` | Static |
| `CORS_ORIGIN` | *(set after frontend deploy)* | Amplify URL |

### Secrets (AWS Secrets Manager)

Create these secrets before deploying:

| Secret Name | Keys |
|-------------|------|
| `lodgist/paystack` | `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` |
| `lodgist/openai` | `OPENAI_API_KEY` |
| `lodgist/gemini` | `GEMINI_API_KEY` |
| `lodgist/whatsapp` | `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` |

Then reference them in App Runner env vars as described in [`APPRUNNER_DEPLOY.md`](../APPRUNNER_DEPLOY.md#24--secrets-aws-secrets-manager).

---

## Phase 6: Configure App Runner IAM Role for Secrets Manager

App Runner needs an IAM role to read secrets from Secrets Manager.

### Create the Role

```bash
# Create trust policy for App Runner
aws iam create-role \
  --role-name lodgist-apprunner-secrets-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {
        "Service": "tasks.apprunner.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }]
  }'
```

### Attach Inline Policy

```bash
aws iam put-role-policy \
  --role-name lodgist-apprunner-secrets-role \
  --policy-name lodgist-secrets-access \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": ["arn:aws:secretsmanager:us-east-1:{ACCOUNT_ID}:secret:lodgist/*"]
    }]
  }'
```

---

## Phase 7: Validate Deployment

### Health Check

```bash
# Get the App Runner service URL
aws apprunner describe-service \
  --region us-east-1 \
  --service-arn arn:aws:apprunner:us-east-1:{ACCOUNT_ID}:service/lodgist-api/{SERVICE_ID} \
  --query 'Service.ServiceUrl' \
  --output text

# Test health endpoint
curl https://{SERVICE_URL}/api/health
# Expected: {"status":"ok","service":"Lodgist API","timestamp":"...","uptime":...}
```

### API Smoke Tests

```bash
# Test listings endpoint
curl https://{SERVICE_URL}/api/listings

# Test users endpoint
curl https://{SERVICE_URL}/api/users

# Test 404 handler
curl https://{SERVICE_URL}/api/nonexistent
# Expected: {"error":"Route not found"}
```

### Logs

```bash
# View App Runner logs
aws apprunner describe-service \
  --region us-east-1 \
  --service-arn arn:aws:apprunner:us-east-1:{ACCOUNT_ID}:service/lodgist-api/{SERVICE_ID} \
  --query 'Service.LogConfiguration' \
  --output json
```

---

## Phase 8: Post-Deploy & Rollback

### Cross-Service Wiring

After both App Runner (backend) and Amplify/Vercel (frontend) are deployed:

1. **Frontend env var**: Set `NEXT_PUBLIC_API_URL` to the App Runner service URL
2. **Backend CORS**: Set `CORS_ORIGIN` to the frontend URL
3. **Redeploy** App Runner to pick up CORS change

### Rollback Procedure

```bash
# Option 1: Rollback to previous image tag
aws apprunner update-service \
  --region us-east-1 \
  --service-arn arn:aws:apprunner:us-east-1:{ACCOUNT_ID}:service/lodgist-api/{SERVICE_ID} \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "{account_id}.dkr.ecr.us-east-1.amazonaws.com/lodgist-backend:{PREVIOUS_SHA}",
      "ImageRepositoryType": "ECR"
    }
  }'

# Option 2: Rollback via Console
# App Runner Console → lodgist-api → Deployments → Rollback to last good
```

---

## Architecture Diagram

```mermaid
flowchart LR
    subgraph "AWS us-east-1"
        ECR[Amazon ECR<br/>lodgist-backend]
        AR[AWS App Runner<br/>lodgist-api]
        RDS[(Amazon RDS<br/>PostgreSQL)]
        SM[AWS Secrets Manager<br/>lodgist/* secrets]
    end

    subgraph "Local Dev"
        DEV[Developer Machine]
        DOCKER[Docker Build]
    end

    DEV -->|docker build| DOCKER
    DOCKER -->|docker push| ECR
    ECR -->|auto-deploy| AR
    AR -->|reads secrets| SM
    AR -->|DATABASE_URL| RDS
    AR -->|serves API| INTERNET[Internet]
    INTERNET -->|/api/health| AR
```

---

## Execution Checklist

### Phase 1 — Dockerfile Fixes
- [ ] Add `apk add --no-exec wget` to runtime stage
- [ ] Add `USER node` before `EXPOSE`
- [ ] Update `.dockerignore` to allow lockfiles
- [ ] Add `--production` flag to npm install

### Phase 2 — Local Build & Test
- [ ] `docker build -t lodgist-backend:latest -f backend/Dockerfile .`
- [ ] `docker run` smoke test
- [ ] `curl localhost:4000/api/health` returns 200

### Phase 3 — ECR Setup
- [ ] `aws sts get-caller-identity` confirms new creds
- [ ] `aws ecr create-repository --repository-name lodgist-backend`

### Phase 4 — Push to ECR
- [ ] `aws ecr get-login-password | docker login`
- [ ] `docker tag` and `docker push` with `latest` + git SHA tags

### Phase 5 — App Runner Service
- [ ] Create App Runner service from ECR image
- [ ] Set plaintext env vars (DATABASE_URL, NODE_ENV, PORT, HOST)
- [ ] Create Secrets Manager secrets
- [ ] Wire secrets to App Runner env vars

### Phase 6 — IAM Role
- [ ] Create `lodgist-apprunner-secrets-role`
- [ ] Attach inline policy for `secretsmanager:GetSecretValue`

### Phase 7 — Validation
- [ ] `GET /api/health` returns 200
- [ ] `GET /api/listings` returns data (RDS connectivity confirmed)
- [ ] `GET /api/nonexistent` returns 404
- [ ] App Runner logs show no errors

### Phase 8 — Post-Deploy
- [ ] Set `NEXT_PUBLIC_API_URL` in frontend
- [ ] Set `CORS_ORIGIN` in App Runner
- [ ] Document rollback procedure
