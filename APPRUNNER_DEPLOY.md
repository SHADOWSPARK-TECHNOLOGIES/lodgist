# Lodgist — AWS App Runner Deployment Guide

## ✅ Step 1: Git Commit & Push — DONE

Commit [`dea64997`](https://github.com/Shadow7user/lodgist/commit/dea64997) pushed to `origin/main`.

```
14 files changed, 317 insertions(+), 5 deletions(-)
create mode 100644 apprunner.yaml
```

---

## 📋 Step 2: Create App Runner Service (AWS Console)

### 2.1 — Create Service

1. Open **AWS App Runner Console** → https://console.aws.amazon.com/apprunner
2. Click **Create service**
3. Source: **Source code repository**
4. Provider: **GitHub** → Connect (if not already)
5. Repository: `Shadow7user/lodgist`
6. Branch: `main`
7. Build configuration: **Use a configuration file** → select `apprunner.yaml`
8. Click **Next**

### 2.2 — Service Settings

| Setting | Value |
|---------|-------|
| **Service name** | `lodgist-api` |
| **Virtual CPU** | `1 vCPU` |
| **Memory** | `2 GB` |
| **Port** | `8080` (auto-detected) |
| **Health check path** | `/api/health` |
| **Health check interval** | `10 seconds` |
| **Health check timeout** | `5 seconds` |
| **Healthy threshold** | `3` |
| **Unhealthy threshold** | `5` |

### 2.3 — Environment Variables (Plaintext)

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://postgres:postgres@shadowspark-spine.cgdee2822czx.us-east-1.rds.amazonaws.com:5432/postgres` |
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `HOST` | `0.0.0.0` |
| `CORS_ORIGIN` | *(leave blank — set after Amplify deploy)* |

### 2.4 — Secrets (AWS Secrets Manager)

Create these secrets first (AWS Console → Secrets Manager → Store a new secret → Other type of secret → Plaintext → paste JSON):

**Secret: `lodgist/paystack`**
```json
{"PAYSTACK_SECRET_KEY":"sk_live_...","PAYSTACK_PUBLIC_KEY":"pk_live_..."}
```

**Secret: `lodgist/openai`**
```json
{"OPENAI_API_KEY":"sk-..."}
```

**Secret: `lodgist/gemini`**
```json
{"GEMINI_API_KEY":"..."}
```

**Secret: `lodgist/whatsapp`**
```json
{"WHATSAPP_API_TOKEN":"...","WHATSAPP_PHONE_NUMBER_ID":"...","WHATSAPP_VERIFY_TOKEN":"lodgist_verify_2026","WHATSAPP_APP_SECRET":"..."}
```

Then in App Runner → Environment variables → Add from **Secrets Manager**:

| Key | Secret Name |
|-----|-------------|
| `PAYSTACK_SECRET_KEY` | `lodgist/paystack` |
| `PAYSTACK_PUBLIC_KEY` | `lodgist/paystack` |
| `OPENAI_API_KEY` | `lodgist/openai` |
| `GEMINI_API_KEY` | `lodgist/gemini` |
| `WHATSAPP_API_TOKEN` | `lodgist/whatsapp` |
| `WHATSAPP_PHONE_NUMBER_ID` | `lodgist/whatsapp` |
| `WHATSAPP_VERIFY_TOKEN` | `lodgist/whatsapp` |
| `WHATSAPP_APP_SECRET` | `lodgist/whatsapp` |

### 2.5 — IAM Role for Secrets Manager

App Runner will prompt to create a service role. Attach this inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": ["arn:aws:secretsmanager:us-east-1:<ACCOUNT_ID>:secret:lodgist/*"]
    }
  ]
}
```

### 2.6 — Deploy

Click **Create & deploy**. First build takes ~5–10 minutes.

---

## 🔄 Step 3: Cross-Service Configuration (Post-Deploy)

After **both** Amplify (frontend) and App Runner (backend) are deployed:

### Amplify Console → Environment variables:
| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://<apprunner-url>.us-east-1.awsapprunner.com` |

### App Runner Console → Environment variables → Update:
| Key | Value |
|-----|-------|
| `CORS_ORIGIN` | `https://<amplify-url>.amplifyapp.com` |

Then trigger a **redeploy** in App Runner.

---

## ✅ Step 4: Validation

```bash
curl https://<apprunner-url>.us-east-1.awsapprunner.com/api/health
# Expected: {"status":"ok","service":"Lodgist API","timestamp":"...","uptime":...}
```

Also verify:
- Frontend login flow works (NextAuth providers)
- Both services use same `DATABASE_URL` (RDS)

---

## 🔙 Rollback

1. App Runner Console → `lodgist-api` → **Deployments** → Rollback to last good
2. Or: `git revert HEAD && git push origin main` (auto-deploys)
