# Azure Cron Setup — GharSoch

This document is the authoritative setup guide for wiring the 4 Azure Function Apps
to the GharSoch Next.js agent routes. Follow every section in order.

---

## a) Decommission Legacy Logic App (if present)

If you see **gharsoch-cron-scheduler** in your Azure Resource Group:

1. Azure Portal → Resource Groups → `gharsoch-rg` (or equivalent)
2. Click **gharsoch-cron-scheduler**
3. Click **Delete** → confirm by typing the resource name
4. Wait for deletion to complete before proceeding

> **Why?** The Logic App may be firing HTTP calls on conflicting schedules. The 4 dedicated
> Function Apps supersede it entirely.

---

## b) Environment Variables — Per Function App

Repeat these steps for **all 4 Function Apps**:

```
gharsoch-cron-followup
gharsoch-cron-matchmaker
gharsoch-cron-reengage
gharsoch-cron-reminders
```

**Steps (Azure Portal):**

1. Open the Function App → left sidebar → **Settings** → **Environment variables**
2. Click the **App settings** tab
3. Add or update each key below using **+ Add**:

| Key | Value |
|-----|-------|
| `CRON_SECRET` | Same 64-char value from `gharsoch-web/.env` `CRON_SECRET=...` |
| `GHARSOCH_API_BASE` | `https://gharsoch.tech` |
| `WEBSITE_TIME_ZONE` | `India Standard Time` |
| `FUNCTIONS_WORKER_RUNTIME` | `node` |
| `WEBSITE_NODE_DEFAULT_VERSION` | `~20` |

4. Click **Apply** → **Confirm** when prompted.

> **Security note:** `CRON_SECRET` is the shared secret validated by every `x-cron-secret`
> header check in the Next.js routes. Never expose it in source control.

---

## c) Local Development Setup

### Prerequisites

```powershell
# Azure Functions Core Tools v4 (install once, global)
npm install -g azure-functions-core-tools@4 --unsafe-perm true

# Verify version — must start with 4.
func --version

# Azure CLI (for publish step only)
# Download from: https://aka.ms/installazurecliwindows
az --version
```

### Setup

```powershell
# From the repo root
cd azure\functions

# Install dependencies
npm install

# Copy example settings and fill in your values
cp local.settings.json.example local.settings.json
```

Edit `local.settings.json`:
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "WEBSITE_NODE_DEFAULT_VERSION": "~20",
    "WEBSITE_TIME_ZONE": "India Standard Time",
    "GHARSOCH_API_BASE": "http://localhost:3000",
    "CRON_SECRET": "<paste value from gharsoch-web/.env>"
  }
}
```

> **Note:** `local.settings.json` is git-ignored. Never commit it.

### Running Locally

**Terminal 1 — Next.js dev server:**
```powershell
cd gharsoch-web
npm run dev
# Starts on http://localhost:3000
```

**Terminal 2 — Azure Functions:**
```powershell
cd azure\functions
npm run build
func start
```

Expected output showing all 4 timers loaded:
```
Functions:
  followup:   timerTrigger
  matchmaker: timerTrigger
  reengage:   timerTrigger
  reminders:  timerTrigger

For detailed output, run func with --verbose flag.
[2026-05-07T04:00:00.000Z] Host started (pid: 12345)
```

---

## d) Deployment — Per Function App

> **Pre-requisite:** Logged into Azure CLI: `az login`

Deploy each Function App from `azure\functions\`:

```powershell
cd azure\functions

# 1. Follow-up Agent (every hour)
func azure functionapp publish gharsoch-cron-followup --typescript

# 2. Matchmaker Agent (every 30 min)
func azure functionapp publish gharsoch-cron-matchmaker --typescript

# 3. Dead Lead Re-engager (daily 10:00 IST)
func azure functionapp publish gharsoch-cron-reengage --typescript

# 4. Appointment Guardian (daily 09:00 IST)
func azure functionapp publish gharsoch-cron-reminders --typescript
```

Each publish command will:
1. Compile TypeScript → `dist/`
2. Zip the `dist/` + `node_modules/` + `host.json`
3. Upload to the Function App via Kudu

> **Important:** Run these commands one at a time and wait for the `Deployment successful`
> message before moving to the next one.

---

## e) Post-Deploy Verification

### 1. Manual Trigger via Portal (Code + Test)

For each Function App:
1. Azure Portal → Function App → **Functions** → click the function name (e.g. `followup`)
2. Click **Code + Test** → **Test/Run** (top toolbar)
3. Set **HTTP method** to `POST`, body `{}`
4. Click **Run** → expect **HTTP response code: 200**

### 2. Monitor — Recent Invocations

1. Azure Portal → Function App → **Monitor** → **Invocations**
2. The most recent invocation should show **Status: Success**
3. Click the invocation to see the full log output (includes the `→ 200` log line)

### 3. Verify agent_execution_logs (MongoDB)

Run in `azure\functions` after a test trigger:

```powershell
# From gharsoch-web directory
node -e "require('dotenv').config(); const { MongoClient } = require('mongodb'); (async () => { const c = new MongoClient(process.env.DATABASE_URL); await c.connect(); const fiveMinsAgo = new Date(Date.now() - 5*60*1000).toISOString(); const logs = await c.db('test').collection('agent_execution_logs').find({ created_at: { `$gte: fiveMinsAgo } }).sort({created_at:-1}).limit(5).toArray(); logs.forEach(l => console.log(l.agent_id, l.status, l.created_at)); await c.close(); })();"
```

Expected: a row for the triggered agent with `status: success` within the last 5 minutes.

### 4. End-to-End Check (after all 4 are deployed)

Wait until the next scheduled fire time, then check Monitor for automatic invocations.

| Function App | First automatic fire |
|---|---|
| gharsoch-cron-followup | Next top of the hour |
| gharsoch-cron-matchmaker | Next :00 or :30 |
| gharsoch-cron-reengage | 10:00 IST tomorrow |
| gharsoch-cron-reminders | 09:00 IST tomorrow |

---

## f) Rollback / Pause — Disabling a Single Function App

To pause one Function App without touching the others:

**Option 1 — Disable via Portal (preferred):**
1. Azure Portal → Function App (e.g. `gharsoch-cron-matchmaker`)
2. Left sidebar → **Overview**
3. Click **Stop** (top toolbar)
4. To re-enable: click **Start**

**Option 2 — Disable individual function (keeps Function App running):**
1. Function App → **Functions** → click the function
2. Toggle **Enabled** to **Disabled**

**Option 3 — Azure CLI:**
```powershell
# Stop the Function App entirely
az functionapp stop --name gharsoch-cron-matchmaker --resource-group <your-rg>

# Restart
az functionapp start --name gharsoch-cron-matchmaker --resource-group <your-rg>
```

---

## g) NCRONTAB Cheat Sheet (Azure — 6-field, seconds first)

Azure Function NCRONTAB format:
```
{second} {minute} {hour} {day} {month} {dayofweek}
```

| Expression | Meaning |
|---|---|
| `0 0 * * * *` | Top of every hour |
| `0 */30 * * * *` | Every 30 minutes |
| `0 0 9 * * *` | Daily at 09:00 (respects WEBSITE_TIME_ZONE) |
| `0 0 10 * * *` | Daily at 10:00 (respects WEBSITE_TIME_ZONE) |
| `0 0 */6 * * *` | Every 6 hours |
| `0 0 9 * * 1-5` | Weekdays at 09:00 |
| `0 */15 9-18 * * *` | Every 15 min between 9am–6pm |

### GharSoch Active Schedules

| Function App | Schedule | Route | Meaning |
|---|---|---|---|
| `gharsoch-cron-followup` | `0 0 * * * *` | `/api/cron/follow-up` | Hourly follow-up sweep |
| `gharsoch-cron-matchmaker` | `0 */30 * * * *` | `/api/cron/matchmaker` | 30-min match sweep (→ event in Phase 3.5) |
| `gharsoch-cron-reengage` | `0 0 10 * * *` | `/api/cron/re-engage` | Daily 10:00 IST dead lead re-engagement |
| `gharsoch-cron-reminders` | `0 0 9 * * *` | `/api/cron/reminders` | Daily 09:00 IST appointment reminders |

> **IST note:** All daily schedules use `WEBSITE_TIME_ZONE=India Standard Time`.
> This means the NCRONTAB `hour` field is treated as IST, not UTC. No UTC offset math required.

---

## Troubleshooting

**"Function not found" after publish:**
- Run `func azure functionapp publish ... --typescript` again from `azure\functions\` directory.
- Ensure `dist/` was built before publish: `npm run build`.

**401 Unauthorized from Next.js route:**
- Verify `CRON_SECRET` in the Function App App Settings matches the value in `gharsoch-web/.env`.

**503 / ECONNREFUSED (prod):**
- Verify `GHARSOCH_API_BASE=https://gharsoch.tech` (no trailing slash).
- Check if the Next.js app is running: `https://gharsoch.tech/api/health` should return `{"status":"ok"}`.

**Timer fires but agent_execution_logs shows "failed":**
- Check the Next.js server logs (Azure App Service → Log Stream) for the route error.
- Run the curl manually: `Invoke-RestMethod -Method POST -Uri https://gharsoch.tech/api/cron/reminders -Headers @{'x-cron-secret'='...'}`.
