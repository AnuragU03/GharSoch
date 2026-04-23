---
name: GharSoch PRD + Prototype Build
overview: Build the PRD in a new app folder (`gharsoc-web/`) by copying the `voice-estate-clean-lab-07s2/` prototype as the pixel-perfect baseline, leaving the original prototype untouched. Add automated voice calling via Vapi (inbound/outbound, warm transfer to broker, meeting scheduling, supervisor prompts).
todos:
  - id: nav-auth-shell
    content: In `gharsoc-web/`, align navigation order + add auth overlay gating to match PRD.
    status: pending
  - id: gharsoc-wizard
    content: In `gharsoc-web/`, implement PRD 4-step GharSoch wizard with real-time totals, tranche builder, and advisory output UI.
    status: pending
  - id: screens-data-wiring
    content: In `gharsoc-web/`, update Dashboard/Campaigns/Call Logs/Analytics/Settings to PRD spec and wire to existing API routes + models.
    status: pending
  - id: vapi-telephony
    content: In `gharsoc-web/`, add Vapi integration plan + webhook endpoints + warm transfer + scheduling + supervisor approval queue hooks.
    status: pending
isProject: false
---

# GharSoch PRD Build (from prototype)

## Goals
- Deliver a **pixel-perfect** dashboard app matching the PRD’s luxury-dark design + IA.
- Implement the PRD’s **core GharSoch 4-step affordability wizard** with real-time calculations and structured outputs.
- Add a production-shaped **automated voice calling system using Vapi** (inbound/outbound), including **broker warm transfer**, **meeting scheduling**, and a **supervisor “ask me what to do next” loop**.

## Project location (important)
- **Source-of-truth implementation** will live in: `gharsoc-web/`
- **Reference prototype (read-only)** remains: `voice-estate-clean-lab-07s2/`
- **Bootstrap approach**: copy `voice-estate-clean-lab-07s2/` → `gharsoc-web/` to preserve the exact pixel/spacing baseline, then iterate only inside `gharsoc-web/`.
## What we’ll build on
- Existing prototype app (UI reference baseline only): [`voice-estate-clean-lab-07s2/`](voice-estate-clean-lab-07s2/)
  - App shell & navigation: [`voice-estate-clean-lab-07s2/app/sections/AppContent.tsx`](voice-estate-clean-lab-07s2/app/sections/AppContent.tsx), [`voice-estate-clean-lab-07s2/app/sections/Sidebar.tsx`](voice-estate-clean-lab-07s2/app/sections/Sidebar.tsx)
  - Current sections exist for most screens (Dashboard, Campaigns, Calls, Agents, Settings, etc.) under [`voice-estate-clean-lab-07s2/app/sections/`](voice-estate-clean-lab-07s2/app/sections/)
- PRD: [`PRD-2026-04-22 (1).md`](PRD-2026-04-22%20(1).md)

## Key design/architecture decisions
- **Pixel-perfect target**: we treat the current prototype UI as the baseline style implementation (fonts, spacing, card/border rhythm), then adjust it to match the PRD’s screen requirements and navigation order.
- **UI structure**: keep “single-page app shell with sections” (`AppContent` + per-screen sections). This is already how the prototype is organized.
- **Data persistence**: use the already-present Next.js API routes + `lyzr-architect` Mongo models for PRD entities (client profiles, call logs, assessments, meetings, matches, config). (These models already exist under `voice-estate-clean-lab-07s2/models/`.)
- **Agent system (IMPORTANT)**: do **not** reuse Lyzr-tied agent plumbing (e.g., `workflow.json`, Lyzr agent IDs, `/api/agent`, `callAIAgent`). Implement our **own** agent execution layer using **OpenAI API** for reasoning, with an in-app **Agent Registry** stored in the database (name, description, prompt, tools, status, last run, versions).
- **Telephony**: Vapi is the calling layer (inbound/outbound + transfers). Vapi webhooks/tool-calls hit our backend endpoints which run OpenAI reasoning + persist results.
## Agent roster (must match your screenshot)
- Lead Qualification & Objection Agent
- GharSoch Financial Advisory Agent
- Post-Call Sync Agent
- GharSoch Self-Service Advisor
- Property Search Agent
- Property Re-engagement Agent
- Calendar Scheduling Agent
- Voice Conversation Orchestrator (Manager)

## Scope by product area
### 1) Navigation / IA (PRD compliance)
- Update sidebar order to match PRD: Dashboard, **GharSoch Tool (2nd)**, Campaigns, Call Logs, Analytics, Settings.
- Ensure header has: logo, notification bell (for escalations / approvals), profile dropdown (auth).

### 2) Auth gating
- PRD wants “visible but locked with auth overlay”.
- Use existing auth API routes in `app/api/auth/*` and wrap app shell with a protected route.

### 3) Dashboard (PRD)
- KPI cards: Active Calls, Calls Today, Avg Sentiment, Meetings Booked, Go/Reconsider/No-Go distribution.
- Live Call Activity feed with sentiment + affordability badges.
- Quick call log table.
- Escalation banner with “Join Call” (hooks into Vapi call link / transfer action).

### 4) Core: GharSoch 4-step wizard (PRD)
Replace the current simplified `AffordabilitySection` with PRD spec:
- Step 1: Property cost (lump sum vs itemized; GST, stamp duty, registration; + other charges).
- Step 2: Payment plan (UC/RTM; possession date; funding method; loan details; tranche builder with running total to 100%).
- Step 3: Financial profile (income sources; obligations; warnings).
- Step 4: Advisory output:
  - Go / Reconsider / No-Go badge + excess ratio
  - tranche-wise table
  - income vs outflow chart
  - recommendations panel
  - report CTA (₹999) stubbed initially (payment/PDF can be a later phase if you want).

### 5) Campaigns / Call Logs / Analytics / Settings (PRD)
- Align tables, filters, detail modals, and status badges with PRD.
- Implement “Sync & Analyze” on call logs using existing agent IDs.
- Implement re-engagement approval flow + scheduling.

### 6) Automated voice calling via Vapi (PRD)
Deliver an integration-ready flow:
- **Inbound/Outbound calls** handled by a Vapi assistant configured as the “Voice Conversation Orchestrator”.
- Vapi webhooks to our backend for:
  - call started / ended
  - transcript available
  - tool/function calls from the assistant
  - escalation triggers (negative sentiment, deadlock, high-value)
- **Warm transfer to broker**: Vapi transfer action using broker phone(s) from Settings; app shows escalation banner and a “Connect broker” action.
- **Scheduling**: assistant uses our Calendar scheduling capability (existing calendar agent/tooling) or a direct “request slots → confirm → create event” API.
- **Supervisor prompts (“ask me what next”)**: a UI queue where the system asks you to approve/deny:
  - re-engagement calls
  - broker transfer
  - follow-up SMS
  - next action on a lead (call now / schedule / mark DNC)

## Milestones
- Milestone A: Pixel-perfect shell + navigation + auth overlay
- Milestone B: GharSoch 4-step wizard + advisory output
- Milestone C: PRD screens (Campaigns/Logs/Analytics/Settings) wired to API + models
- Milestone D: Vapi integration (webhooks + call lifecycle + warm transfer + scheduling)

## Test plan
- Run app locally and confirm:
  - auth overlay gating
  - wizard calculations update live
  - saving assessments + viewing in logs
  - campaign approval state transitions
  - Vapi webhook endpoint accepts sample payloads and creates call logs
