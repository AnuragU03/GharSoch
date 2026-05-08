# GharSoch Azure Functions — Cron Wiring

Timer-triggered Azure Functions that POST to GharSoch Next.js agent routes on a fixed schedule.
Each function is a thin HTTP forwarder — the real agent logic lives in the Next.js app.

## Structure

```
azure/functions/
  followup/          → fires every hour    → POST /api/cron/follow-up
  matchmaker/        → fires every 30 min  → POST /api/cron/matchmaker
  reengage/          → fires daily 10:00   → POST /api/cron/re-engage
  reminders/         → fires daily 09:00   → POST /api/cron/reminders
  host.json          → runtime config, retry policy
  package.json       → @azure/functions + typescript
  tsconfig.json      → CommonJS output for Node 20
  local.settings.json.example
  README.md          (this file)
```

## Prerequisites

```powershell
# Azure Functions Core Tools v4 (Windows, via npm)
npm install -g azure-functions-core-tools@4 --unsafe-perm true

# Verify
func --version   # must be >= 4.x
```

## Local Development

```powershell
cd azure/functions
npm install
cp local.settings.json.example local.settings.json
# Edit local.settings.json:
#   GHARSOCH_API_BASE → http://localhost:3000
#   CRON_SECRET       → same value as gharsoch-web/.env
npm run build
func start
```

Expected output (all 4 timers loaded):
```
Functions:
  followup:   timerTrigger
  matchmaker: timerTrigger
  reengage:   timerTrigger
  reminders:  timerTrigger
```

## Manual Test Trigger (local)

With `func start` running (port 7071) and `npm run dev` running (port 3000):

```powershell
# Trigger followup immediately
curl http://localhost:7071/admin/functions/followup `
  -d "{}" `
  -H "Content-Type: application/json" `
  -X POST

# Trigger matchmaker
curl http://localhost:7071/admin/functions/matchmaker `
  -d "{}" `
  -H "Content-Type: application/json" `
  -X POST
```

## Deploy to Azure

Full deploy guide: `docs/AZURE_CRON_SETUP.md`

```powershell
func azure functionapp publish gharsoch-cron-followup  --typescript
func azure functionapp publish gharsoch-cron-matchmaker --typescript
func azure functionapp publish gharsoch-cron-reengage  --typescript
func azure functionapp publish gharsoch-cron-reminders --typescript
```

## NCRONTAB Schedule Reference (6-field, seconds first)

| Function   | Schedule           | Meaning              |
|------------|--------------------|----------------------|
| followup   | `0 0 * * * *`      | Top of every hour    |
| matchmaker | `0 */30 * * * *`   | Every 30 minutes     |
| reengage   | `0 0 10 * * *`     | Daily at 10:00 IST   |
| reminders  | `0 0 9 * * *`      | Daily at 09:00 IST   |

IST is configured via `WEBSITE_TIME_ZONE=India Standard Time` in each Function App.
