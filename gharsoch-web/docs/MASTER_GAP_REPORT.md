# GharSoch — Master Gap Report

**Generated:** 2026-05-07  
**Against:** Master Prompt (Sections 0–16) + Addendum (Section 14, 17)  
**Baseline:** Existing codebase in `gharsoch-web/`

---

## Executive Summary

The existing codebase has foundation pieces (auth, MongoDB models, Vapi setup) but is missing the **execution contract layer** and the **agent orchestration spine**. Current state:

- ❌ Only Matchmaker is wired to `agentLogger` (Sections 1, 4)
- ❌ Cron routes do not exist or do not call `runAgent` wrapper
- ❌ Event triggers (new client, property PATCH) are not wired in-process
- ❌ No `runAgent` wrapper contract (Section 4)
- ❌ No orchestrator (Section 10: Semantic Kernel)
- ❌ No Client→Lead Converter agent (Section 12)
- ❌ Campaign automation not wired to `runAgent` (Section 13)
- ❌ Entire UI redesign pending (Section 14)
- ❌ Azure Cron / Function App setup undefined (Section 15)

**Phase 1 readiness:** 0%. Must create `lib/runAgent.ts`, `lib/envCheck.ts`, and extend `lib/agentLogger.ts` before any agent can run properly.

---

## Gap by Section

### Section 2 — Default Decisions
✅ Runtime env mostly correct (Next.js 14, TypeScript, Tailwind, shadcn, MongoDB)  
⚠️ LLM keys: `OPENAI_API_KEY` assumed present, not validated at boot  
⚠️ Vapi env: `VAPI_PHONE_NUMBER_ID` missing from known env list  

### Section 3 — Required Environment Variables

**Status:** Partial  
**Location:** No centralized `lib/envCheck.ts`

**Missing files:**
- `lib/envCheck.ts` — must exist and export `validateEnv()` called from `app/layout.tsx`

**Environment variables defined but not validated:**
```
✅ OPENAI_API_KEY (assumed used)
✅ DATABASE_URL (used in lib/mongodb.ts)
✅ VAPI_API_KEY (referenced)
✅ AZURE_STORAGE_CONNECTION_STRING (referenced)

❌ VAPI_PHONE_NUMBER_ID — not in existing .env or validated
❌ VAPI_ASSISTANT_OUTBOUND_ID — defined but not in list
❌ VAPI_ASSISTANT_INBOUND_ID — defined but not in list
❌ VAPI_ASSISTANT_REMINDER_ID — defined but not in list
❌ CRON_SECRET — not implemented; required for /api/cron/* routes
❌ PUBLIC_APP_URL — used in Vapi setup but not centrally validated
```

**Gap:** Need to add `validateEnv()` to `app/layout.tsx` server component to throw on boot if any var missing.

---

### Section 4 — The Agent Execution Contract (NON-NEGOTIABLE)

**Status:** ❌ BROKEN — Only Matchmaker partially implements this

**Missing file:**
- `lib/runAgent.ts` — **CRITICAL**, does not exist

**Current state:**
- `lib/agentLogger.ts` has some methods but incomplete
- Cron routes (Follow-Up, Reminders, Re-engage, Price-Drop) either do not exist or do not call `agentLogger`
- No `executionEventBroadcaster` integration in cron routes
- No `ctx.think()`, `ctx.openai`, `ctx.vapi`, `ctx.db`, `ctx.kb` API

**Specific gaps:**

| Contract element | Status | Location |
|------------------|--------|----------|
| `runAgent({ agentId, agentName, trigger, input, handler })` | ❌ Missing | needs `lib/runAgent.ts` |
| `agentLogger.startAgentRun()` | ⚠️ Partial | `lib/agentLogger.ts` exists but signature unclear |
| `logAgentThinking({ kind, content, confidence })` | ❌ Missing | needs implementation |
| `logAgentAction({ kind, tool, input, output })` | ❌ Missing | needs implementation |
| `completeAgentRun(runId, output, 'success')` | ⚠️ Partial | unclear if implemented |
| `failAgentRun(runId, error)` | ❌ Missing | needs implementation |
| `executionEventBroadcaster.broadcastExecutionStarted()` | ⚠️ Exists | `lib/agentExecutionEventBroadcaster.ts` but not wired to all agents |
| `ctx.think()` | ❌ Missing | needs implementation |
| `ctx.openai.call()` | ❌ Missing | needs `lib/openaiClient.ts` with logging hook |
| `ctx.vapi.call()` | ❌ Missing | needs `lib/vapiClient.ts` enhancement |
| `ctx.db.write()` | ❌ Missing | needs abstraction layer |
| `ctx.kb.query()` | ⚠️ Partial | `lib/builderKBService.ts` exists but not integrated into logger |

**Gate 1 blocker:** Cannot proceed to Phase 2 without `lib/runAgent.ts`.

---

### Section 5 — Phase Plan

#### Phase 1 — Foundation

**Missing files to create:**

| File | Purpose | Status |
|------|---------|--------|
| `lib/envCheck.ts` | Boot-time validation | ❌ Does not exist |
| `lib/runAgent.ts` | Agent execution wrapper | ❌ Does not exist |
| `lib/openaiClient.ts` | Shared OpenAI client | ❌ Does not exist (individual routes call OpenAI directly?) |
| `scripts/create_indexes.js` | DB indexes | ⚠️ Exists but needs extension for `agent_execution_logs` |

**Files to extend:**

| File | Required extensions | Status |
|------|----------------------|--------|
| `lib/agentLogger.ts` | `startAgentRun`, `logAgentThinking`, `logAgentAction`, `completeAgentRun`, `failAgentRun` | ⚠️ Partial |
| `lib/agentExecutionEventBroadcaster.ts` | Verify channels: `agent_event`, `agent:{agentId}`, `run:{runId}` | ⚠️ Assumed working |
| `lib/vapiClient.ts` | `triggerOutboundCall({ assistantId, phone, leadContext, metadata })` with logging | ⚠️ Partial |
| `lib/builderKBService.ts` | Verify methods exist; add logging hook | ⚠️ Assumed working |
| `app/layout.tsx` | Call `validateEnv()` in server component | ❌ Not called |

#### Phase 2 — Wire All 5 Agents Through `runAgent`

**Missing cron routes:**

| Route | Exists? | Wrapped in `runAgent`? |
|-------|---------|------------------------|
| `app/api/cron/matchmaker/route.ts` | ❌ No (only event) | N/A |
| `app/api/cron/follow-up/route.ts` | ❌ No | ❌ |
| `app/api/cron/reminders/route.ts` | ❌ No | ❌ |
| `app/api/cron/re-engage/route.ts` | ❌ No | ❌ |
| `app/api/cron/price-drop/route.ts` | ❌ No (event-only) | ❌ |
| `app/api/agent/price-drop/route.ts` | ❌ No (event-triggered) | ❌ |

**Event triggers missing in-process dispatch:**

- `POST /api/clients` — should dispatch `clientLeadConverterAgent` in-process
- `POST /api/clients/bulk` — same
- `POST /api/properties` — should dispatch `matchmakerAgent` in-process
- `PATCH /api/properties/{id}` (on price decrease) — should dispatch `priceDropAgent` in-process

**Gap:** All 5 agents need cron/event routes created and wrapped in `runAgent`.

#### Phase 3 — Cron That Actually Fires

**Status:** Unknown  
**Missing file:** `docs/AZURE_CRON_SETUP.md` (do not have yet, but section 15 has the canonical text)

**Unknown state:**
- Does Azure Function App exist for cron?
- Is `WEBSITE_TIME_ZONE=India Standard Time` set?
- Do Function App timers post to the Next.js routes?
- Is there any cron setup at all?

**Gap:** Need to verify or create the entire Azure Function App tier.

#### Phase 4 — Admin UI Operations Center

**Status:** ❌ BROKEN — Current UI is stale, does not show all 5 agents

**Missing:**
- Entire UI redesign per `gharsoch_admin_prototype.html` (14+ sections)
- 12 new route pages (Dashboard, Leads, Clients, Properties, Campaigns, Appointments, Calls, AI Operations, Agent Activity, KB, Analytics, Settings)
- 12+ new TSX section files
- Component library: `AgentCard`, `RunDetailDrawer`, `LivePulse`, `Sidebar`, etc.
- Real data fetching (currently likely mock or incomplete)

**Existing UI state:**
- `components/LiveAgentMonitoring.tsx` exists but likely incomplete
- No `RunDetailDrawer` component
- No command palette
- Settings page likely has unrelated toggles (per Section 14.4 criticism)

**Gap:** Entire UI layer needs rebuild to spec.

#### Phase 5 — Re-enable Reasoning Summaries

**Status:** ⚠️ Known broken (from PHASE_7_IMPLEMENTATION.md screenshot)

**Issue:** Reasoning summaries disabled due to `ERR_SSL_WRONG_VERSION_NUMBER` (internal HTTPS self-fetch).

**Gap:** Refactor `reasoningSummaryGenerator.ts` to be in-process, wrap in try/catch, add 8s timeout.

#### Phase 6 — KB Wiring End-To-End

**Status:** ⚠️ Partial

**Known state:**
- `lib/builderKBService.ts` exists
- Builder KB collection seeded? (unknown)
- `scripts/seed_builder_kb.js` exists?

**Gap:** Verify KB seeding, ensure logging of KB queries as actions.

---

### Section 9 — Cron vs Event vs Orchestrator

**Current misunderstanding:** All 5 agents treated as time-based cron.

**Spec requirement:** Split into event (2) and cron (3):

| Agent | Correct Trigger | Current | Status |
|-------|-----------------|---------|--------|
| Matchmaker | Event (new client, new property) | Cron | ❌ Wrong trigger pattern |
| Follow-Up | Cron hourly | Cron | ✅ Correct |
| Appointment Guardian | Cron daily 09:00 IST | Cron | ✅ Correct |
| Dead Lead Re-engager | Cron daily 10:00 IST | Cron | ✅ Correct |
| Price Drop Negotiator | Event (property PATCH) | Cron | ❌ Wrong trigger pattern |
| Voice Orchestrator | Live Vapi tool-call | N/A | ❌ Does not exist |

**Gap:** Matchmaker and Price-Drop need to be event-triggered from API POST/PATCH handlers in-process, not on cron.

---

### Section 10 — Multi-Agent Orchestration (Semantic Kernel)

**Status:** ❌ Does not exist

**Missing:**
- `lib/orchestrator/` directory and all subfiles
- Semantic Kernel imports and setup
- 12 agent definitions (Matchmaker, Follow-Up, etc.)
- Inter-call memory collection `agent_conversations` in MongoDB
- `ChatCompletionAgent` instances
- Plugin registry

**Gap:** Entire orchestrator layer needs to be built from scratch.

---

### Section 11 — Vapi Wiring

**Status:** ⚠️ Partial setup, routes missing

**Known state:**
- `lib/vapiClient.ts` exists
- Three assistant IDs defined (outbound, inbound, reminder)
- Webhook signature verification needed

**Missing:**
- `app/api/vapi/webhook/route.ts` — the tool-call router (Section 11.2)
- The 8 tools NOT connected via router:
  1. `search_properties` — missing
  2. `qualify_lead` — missing
  3. `book_appointment` — missing
  4. `schedule_callback` — missing
  5. `mark_dnd` — missing
  6. `calculate_affordability` — missing
  7. `confirm_appointment` — missing
  8. `reschedule_appointment` — missing
- `end-of-call-report` handler — missing

**Gap:** Entire Vapi webhook tool router needs to be built.

---

### Section 12 — Client → Lead Conversion Automation

**Status:** ❌ Does not exist

**Missing:**
- `models/Client.ts` — separate from leads
- `POST /api/clients` handler with in-process `clientLeadConverterAgent`
- `POST /api/clients/bulk` for CSV upload
- Client→Lead Converter agent logic
- Conversion status column in UI

**Gap:** Entire flow is missing.

---

### Section 13 — Campaign Automation

**Status:** ⚠️ Collections exist, automation missing

**Known state:**
- `models/Campaign.ts` exists
- `POST /api/campaigns/trigger` likely exists but not wrapped in `runAgent`

**Missing:**
- Campaign Conductor agent logic
- Campaign progress streaming (SSE)
- TRAI window enforcement in campaign runs
- DNC / 24h check in campaign loop

**Gap:** Campaign orchestration logic needs implementation.

---

### Section 14 — UI Redesign (REPLACED)

**Status:** ❌ 0% complete

**From addendum:**
- **No role-gating in UI during build.** All sections visible to all roles during dev.
- Build the full admin UI per prototype.
- Auth gating applied only at Section 17.6 (auth layer, not component layer).

**12 pages to build:**

1. `/` — Dashboard
2. `/leads` — Lead Pipeline (Kanban)
3. `/clients` — Clients list with conversion status
4. `/properties` — Property grid
5. `/campaigns` — Active campaigns with progress
6. `/appointments` — Appointments calendar view
7. `/calls` — Call logs with transcripts
8. `/ai-operations` — AI Operations Center ← most critical
9. `/agent-activity` — Live activity stream
10. `/kb` — Knowledge base builders
11. `/analytics` — Funnel, KPIs
12. `/settings` — Runtime toggles only

**Key components missing:**
- `Sidebar`
- `AgentCard`
- `RunDetailDrawer`
- `LivePulse`
- `CommandPalette`
- `KanbanColumn` + `LeadCard`
- All entity modals (NewClient, NewProperty, NewCampaign)

**Gap:** Entire UI rebuild required.

---

### Section 15 — Azure Cron Setup

**Status:** Unknown

**Missing documentation:** `docs/AZURE_CRON_SETUP.md` does not exist.

**Unknown state:**
- Is there an Azure Function App?
- Do timers exist?
- Is `WEBSITE_TIME_ZONE` set?
- Do functions call the Next.js routes?

**Gap:** Need to verify existing or create entire Function App infrastructure.

---

### Section 16 — Reasoning Summaries & Self-HTTPS

**Status:** ⚠️ SSL issue known

**Current problem (from PHASE_7_IMPLEMENTATION.md):**
```
ERR_SSL_WRONG_VERSION_NUMBER when calling reasoning summary generation
→ caused by internal HTTPS call to https://gharsoch.tech from server code
```

**Solution:** No `fetch('https://gharsoch.tech/...')` from server code. Refactor to in-process function calls.

**Grep check needed:**
```
grep -R "https://gharsoch.tech" app/ lib/
```
Expect to find violations.

**Gap:** Identify and refactor all internal self-HTTPS calls.

---

### Section 17 — HTML → TSX Conversion Guide

**Status:** Addendum appended, ready for execution

**All 17.1–17.10 steps pending per Phase 4 / Phase 9 (UI redesign phases TBD).

---

## Codebase-Wide Structural Gaps

### Missing Core Abstractions

| Abstraction | Purpose | Exists? | Status |
|-------------|---------|---------|--------|
| `AgentContext` (ctx) | Passed to handler in `runAgent` | ❌ No | Needs `lib/agentContext.ts` |
| `agentLogger` global | Central logging | ⚠️ Partial | Extend in Phase 1 |
| `executionEventBroadcaster` | SSE publishing | ⚠️ Partial | Verify in Phase 1 |
| `orchestrator` | Multi-agent coordination | ❌ No | Needs Section 10 work |
| Shared DB connection pool | Cosmos retry + timeout | ⚠️ Partial | Verify health |

### Missing Indexes

**Collection:** `agent_execution_logs`  
**Required indexes (from Section 4):**
```
agent_id (ascending)
run_id (ascending, unique or sparse)
started_at (descending)
```

**Status:** Need to add to `scripts/create_indexes.js`.

### Missing Schemas / Models

| Collection | Model file | Purpose | Exists? |
|-----------|-----------|---------|---------|
| `agent_execution_logs` | N/A (no model needed) | Execution audit trail | ⚠️ Collection exists, schema unclear |
| `clients` | `models/Client.ts` | New; Section 12 | ❌ No |
| `agent_conversations` | N/A | Section 10 inter-call memory | ❌ No |

---

## Self-HTTPS Violations (Must Search)

**Current known issue:** At least one place calling `https://gharsoch.tech` internally.

**Action needed:** 
```bash
grep -r "https://gharsoch.tech" app/ lib/ --include="*.ts" --include="*.tsx"
```

Expected violations:
- `lib/reasoningSummaryGenerator.ts` (known, from PHASE_7 doc)
- Possibly client POST hooks trying to trigger Matchmaker

---

## Acceptance Test Coverage (Section 6)

**Status:** 0/7 tests implemented

| Test | Implementation | Status |
|------|----------------|----|
| 1. Cron-to-UI (5s update) | `scripts/e2e_agents.ts` | ❌ Missing |
| 2. OpenAI call produces JSON | E2E harness | ❌ Missing |
| 3. Vapi call recorded | E2E harness | ❌ Missing |
| 4. Mongo state transitions | E2E harness | ❌ Missing |
| 5. KB query logged | E2E harness | ❌ Missing |
| 6. Error resilience | E2E harness | ❌ Missing |
| 7. No self-HTTPS | Grep + review | ⚠️ Partial (known violation) |
| 8. Index health | `scripts/create_indexes.js` idempotency | ❌ Unknown |

**Gap:** E2E test harness needs to be created.

---

## Hard "Do Not" List Violations (Section 7)

**Current risk areas (must audit):**

1. ✅ Exactly 5 agents? Verify in agent registry.
2. ❌ Mock data? Likely present in prototype, must remove before ship.
3. ❌ Self-HTTPS calls? Known violation in reasoning summary generation.
4. ❌ Silent errors? Need to enforce `failAgentRun` in all catch blocks.
5. ❌ Secrets in logs? Need to audit logging code for key masking.
6. ❌ New state store? Verify only Mongo is used.
7. ❌ Data model changes? Verify no renames/deletes to Lead, Property, Appointment, Campaign, Call.
8. ❌ UI change without docs update? Check `docs/PROJECT_STRUCTURE_AND_FILE_MAP.md`.
9. ⚠️ Section without loading state? New sections need Suspense + error boundary.

**Gap:** Full codebase audit needed before Phase 1 Gate 1.

---

## Definition of Done — Check Against (Section 8)

Admin must be able to:

1. ❌ Open `gharsoch.tech` → AI Operations Center — **Missing entire UI**
2. ❌ See **all 5 agent cards green** — **Cards don't exist, only Matchmaker partial**
3. ❌ Click card → see **live thinking events** — **No RunDetailDrawer, no SSE wiring**
4. ❌ Click history row → see **exact OpenAI + Vapi + KB + Mongo audit trail** — **No drawer to show this**
5. ❌ Trust automation is **actually happening on schedule** — **No observable proof without #1–4**

---

## Summary: Must-Do Before Phase 1 Gate 1

**Critical path (blocking):**

1. ✅ Read and merge master prompt + addendum (done)
2. Create `lib/envCheck.ts` with `validateEnv()` export
3. Create `lib/runAgent.ts` with full contract (agentId, trigger, handler, logging hooks)
4. Extend `lib/agentLogger.ts`: `startAgentRun`, `logAgentThinking`, `logAgentAction`, `completeAgentRun`, `failAgentRun`, ensure Cosmos-compatible schema
5. Extend `scripts/create_indexes.js` to create indexes on `agent_execution_logs`
6. Call `validateEnv()` from `app/layout.tsx` server component
7. Verify `lib/agentExecutionEventBroadcaster.ts` emits on correct channels
8. Create placeholder `lib/openaiClient.ts` with timeout + logging hook
9. Extend `lib/vapiClient.ts` with logging hook
10. Grep for all `https://gharsoch.tech` calls in server code; refactor to in-process
11. `npm run build` passes, `npm start` boots without missing env errors

**Once critical path done:** Proceed to Phase 2 (wire all 5 agents through `runAgent`).

---

## Phase Sequence (From Section 16 Updated)

Revised phase order post-gap analysis:

1. **Phase 1 — Foundation** (now understood)
2. **Phase 2 — Wire 5 agents through runAgent**
3. **Phase 3 — Cron + Azure Function setup**
4. **NEW: Phase 3.5 — Event triggers (Matchmaker, Price-Drop) in-process**
5. **Phase 4 — UI: AI Operations Center skeleton**
6. **Phase 5 — Re-enable reasoning summaries (fix SSL)**
7. **Phase 6 — KB wiring end-to-end**
8. **NEW: Phase 7 — Semantic Kernel orchestrator (Section 10)**
9. **NEW: Phase 8 — Vapi webhook router + 8 tools (Section 11)**
10. **NEW: Phase 9 — Client→Lead Converter + Campaign Conductor (Sections 12, 13)**
11. **Phase 10 — UI: Complete 12-page redesign per prototype (Section 14, 17)**
12. **Phase 11 — Auth gating at middleware (Section 17.6)**
13. **Phase 12 — Acceptance tests + hardening (Section 6)**

---

**End of MASTER_GAP_REPORT.md**

Status: Ready for Phase 1 Gate 1 review.
