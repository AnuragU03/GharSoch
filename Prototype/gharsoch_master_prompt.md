# GharSoch — Master Build Prompt for IDE Agent (Copilot / Cursor / Cline / Claude Code)

> **Read this entire file before writing any code.** Then execute the phases **in order**, do not skip phase verification gates, and do not ask me clarifying questions — the contract below is binding. If something is undefined, default to the **"Default Decisions"** section. Every change must be visible in the **AI Operations Center** UI and in the **MongoDB execution log**, otherwise the change is considered incomplete.

---

## 0. Identity & Mission

You are upgrading **GharSoch** (Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, MongoDB/Azure Cosmos DB v4.2+, Vapi.ai voice, OpenAI GPT-4o, Twilio telephony, deployed on Azure at `gharsoch.tech`).

GharSoch is **not a CRM with buttons**. It is a **multi-agent AI employee** for a real-estate broker. Your job is to make 5 background agents truly **autonomous, observable, and admin-informative** — triggered by cron, executing real OpenAI + Vapi + Mongo work, and streaming every reasoning step to the **AI Operations Center**.

The 5 agents are fixed:

| # | Agent | Trigger | Primary Action |
|---|-------|---------|----------------|
| 1 | **The Matchmaker** | New Property added OR new Client uploaded | Pair Clients ↔ Properties via GPT-4o, mark as Lead, trigger Vapi outbound |
| 2 | **The Follow-Up Agent** | Cron — every 1 hour | Find leads with `next_follow_up_date <= now`, trigger Arya outbound |
| 3 | **The Appointment Guardian** | Cron — daily 09:00 IST | Call leads with site visits in next 24h; confirm / reschedule / cancel |
| 4 | **The Dead Lead Re-engager** | Cron — daily 10:00 IST | Find leads `cold` or `not_interested` for 60+ days; re-engage with context from old transcript |
| 5 | **The Price Drop Negotiator** | Property `price` decreased | Find leads who rejected that property with objection = "price too high"; auto-call them |

Every agent **must** follow the same execution contract (Section 4). Anything that does not follow the contract is not done.

---

## 1. Why The Current State Is Broken (Ground Truth From Screenshot + Docs)

The IDE must internalize these specific gaps **before** writing code:

1. **Cron looks "successful" in Azure but UI is empty for 4/5 agents.**
   Root cause: cron handlers are not calling `agentLogger.startAgentRun()` + `executionEventBroadcaster.broadcastExecutionStarted()`. So the Mongo collection `agent_execution_logs` has no row, and `/api/agent/ws` has no event to push, so the card stays at *"Awaiting first CRON trigger"*.

2. **Only Matchmaker writes to `Live Activity Log`.** That means only Matchmaker's path is wired to `agentLogger`. The other four agent cron routes either don't exist, don't import `agentLogger`, or write to `console.log` instead of the log collection.

3. **OpenAI key wiring is fragile.** Phase 7 doc says reasoning summaries were disabled because of `ERR_SSL_WRONG_VERSION_NUMBER`. That was a symptom of internal HTTPS calls to the same host. The fix is **never call your own webhook/agent over `https://gharsoch.tech`** — call internal services in-process (function call), not over the network.

4. **Agent cards have no link to MongoDB KB or execution traces.** The card just shows a number. Clicking it must open a side panel with: latest run id, reasoning steps, OpenAI prompt+response, Vapi call ids, Mongo writes, builder KB lookups.

5. **VS Code auto-mode keeps drifting** because the spec was open-ended. The contract below removes that drift — every file path, env var, response shape, and acceptance test is fixed.

---

## 2. Default Decisions (Use These When Anything Is Ambiguous)

- **Runtime**: Next.js 14 App Router, Node 18, TypeScript strict.
- **DB**: Azure Cosmos DB MongoDB API v4.2+. All queries must be Cosmos-compatible (no `$expr` with `$function`, no MongoDB-specific operators).
- **LLM**: `gpt-4o` for agent reasoning, `gpt-4o-mini` for reasoning summaries.
- **Voice**: Vapi.ai. Three assistants — Outbound, Inbound, Reminder. Their IDs come from env.
- **Cron**: Azure App Service `WEBSITE_TIME_ZONE=India Standard Time` + Azure Function timer **OR** Vercel-style cron via `vercel.json` if deployed there. **Authoritative cron path is `/api/cron/<agent>`**, secured by `CRON_SECRET` header `x-cron-secret`.
- **Auth**: Existing `lib/auth.ts`. Admin only.
- **Logging**: Every agent run = 1 row in `agent_execution_logs` with `reasoning_steps[]`, `actions[]`, `output`, `error`, `started_at`, `completed_at`, `status`.
- **Streaming**: SSE via `/api/agent/ws?run_id=…` or `?agent_id=…`. No WebSockets.
- **Never** call your own host over HTTPS from a server route. Refactor to in-process function calls.

---

## 3. Required Environment Variables (Fail Fast If Missing)

Add a startup validator in `lib/envCheck.ts` that throws on boot if any of these are missing:

```
OPENAI_API_KEY
DATABASE_URL                # Cosmos Mongo connection string
VAPI_API_KEY
VAPI_PHONE_NUMBER_ID
VAPI_ASSISTANT_OUTBOUND_ID
VAPI_ASSISTANT_INBOUND_ID
VAPI_ASSISTANT_REMINDER_ID
CRON_SECRET                 # required header for /api/cron/*
AZURE_STORAGE_CONNECTION_STRING
PUBLIC_APP_URL              # e.g. https://gharsoch.tech (used ONLY for Vapi server-url, never for self-fetch)
```

Call `validateEnv()` from `app/layout.tsx` server component so the app refuses to start with a missing key.

---

## 4. The Agent Execution Contract (NON-NEGOTIABLE)

Every cron route AND every agent route MUST follow this exact shape. Build a helper `lib/runAgent.ts` that wraps it so individual routes cannot forget a step.

```ts
// lib/runAgent.ts
export async function runAgent<T>(opts: {
  agentId: string;            // matches agentRegistry id
  agentName: string;          // human label, e.g. "The Matchmaker"
  trigger: 'cron' | 'event' | 'manual';
  input: Record<string, any>;
  handler: (ctx: AgentRunContext) => Promise<T>;
}): Promise<{ runId: string; output: T }> {
  const runId = await agentLogger.startAgentRun({ ... });
  executionEventBroadcaster.broadcastExecutionStarted(runId, opts.agentId, opts.agentName, opts.input);
  try {
    const ctx = buildCtx(runId, opts);   // ctx.think(), ctx.act(), ctx.kb.query(), ctx.openai.call(), ctx.vapi.call(), ctx.db.write()
    const output = await opts.handler(ctx);
    await agentLogger.completeAgentRun(runId, output, 'success');
    executionEventBroadcaster.broadcastExecutionCompleted(runId, opts.agentId, output, Date.now() - start);
    // Optional reasoning summary (gpt-4o-mini), failures here MUST NOT fail the run
    return { runId, output };
  } catch (err) {
    await agentLogger.failAgentRun(runId, err);
    executionEventBroadcaster.broadcastExecutionError(runId, opts.agentId, err);
    throw err;
  }
}
```

**Rules the IDE must enforce:**

1. No agent code path may call OpenAI / Vapi / Mongo directly. It must go through `ctx.openai`, `ctx.vapi`, `ctx.db`, `ctx.kb` so each call is auto-logged as a `reasoning_step` (kind=`tool_call`) and `action`.
2. Every meaningful decision must call `ctx.think({ kind, content, confidence })`. Minimum 3 thinking steps per run (evaluation → decision → result_analysis).
3. Reasoning summary uses `gpt-4o-mini`. Wrap in `try/catch` — never block the main response. Re-enable in production.
4. No `fetch('https://gharsoch.tech/...')` from server code. Import the function instead.

---

## 5. Phase Plan (Execute Strictly In Order — Each Phase Has A Verification Gate)

### Phase 1 — Foundation (no UI work yet)

Files to create / modify:

- `lib/envCheck.ts` — boot-time validation.
- `lib/runAgent.ts` — the wrapper above.
- `lib/agentLogger.ts` — ensure `startAgentRun`, `logAgentThinking`, `logAgentAction`, `completeAgentRun`, `failAgentRun` all persist to `agent_execution_logs` with a Cosmos-friendly schema, and ensure indexes on `agent_id`, `run_id`, `started_at desc` exist (extend `scripts/create_indexes.js`).
- `lib/agentExecutionEventBroadcaster.ts` — verify it emits on `agent_event`, `agent:{agentId}`, `run:{runId}`.
- `lib/openaiClient.ts` — single shared OpenAI client with timeout, retries, and structured logging hook.
- `lib/vapiClient.ts` — `triggerOutboundCall({ assistantId, phone, leadContext, metadata })` with logging hook.
- `lib/builderKBService.ts` — must already exist; verify it queries the correct Cosmos collection.

**Gate 1:** `npm run build` passes. `validateEnv()` throws cleanly when a key is missing. `scripts/create_indexes.js` runs against Cosmos with no error.

### Phase 2 — Wire All 5 Agents Through `runAgent`

Create / refactor these routes. Each one MUST be wrapped in `runAgent`:

| Agent | Cron Route | Event Route | Logic |
|-------|------------|-------------|-------|
| Matchmaker | `app/api/cron/matchmaker/route.ts` (every 30 min sweep) | Already triggered from `app/api/clients/route.ts` and `app/api/properties/route.ts` POST hooks | Pull unmatched clients + available properties → GPT-4o pairing prompt → score ≥ 75 ⇒ create Lead + trigger Vapi |
| Follow-Up | `app/api/cron/follow-up/route.ts` (every 1 hour) | — | Query `leads` where `next_follow_up_date <= now()` AND `dnd_status=false` → trigger Vapi outbound, increment `follow_up_count`, push next date |
| Appointment Guardian | `app/api/cron/reminders/route.ts` (daily 09:00 IST) | — | Query `appointments` where `scheduled_at` between `now+0h` and `now+24h` AND `reminder_sent=false` → call Reminder assistant → on response, update appointment status |
| Dead Lead Re-engager | `app/api/cron/re-engage/route.ts` (daily 10:00 IST) | — | Query `leads` where `status in ['cold','not_interested']` AND `last_contacted_at <= now-60d` → fetch last call transcript → GPT-4o builds context → trigger Vapi |
| Price Drop Negotiator | `app/api/agent/price-drop/route.ts` | Triggered from `app/api/properties/route.ts` PATCH when `price` decreases | Find leads who visited that property with objection containing "price" → trigger Vapi with new price context |

**Each route signature is identical:**

```ts
export async function POST(req: Request) {
  // 1. Auth: x-cron-secret OR session admin
  // 2. const { runId, output } = await runAgent({ agentId, agentName, trigger, input, handler })
  // 3. return NextResponse.json({ success: true, runId, summary: output.summary, ... })
}
```

**Gate 2:** Hit each route manually with `curl -H "x-cron-secret: $CRON_SECRET"`. Verify in MongoDB:
- `agent_execution_logs` has 1 new row per call
- Row has ≥ 3 `reasoning_steps` and ≥ 1 `actions`
- `status` is `success` or `failed` (never missing)

### Phase 3 — Cron That Actually Fires Into Those Routes

You have two valid options. Pick the one matching the deployment target and document it in `docs/CRON_SETUP.md`:

- **Azure App Service + Azure Function (TimerTrigger)**: Function calls the route over HTTPS using `CRON_SECRET`. Function lives in `azure/functions/<agent>/index.ts`. Use `WEBSITE_TIME_ZONE=India Standard Time`.
- **Vercel `vercel.json` cron** if deployed there.

Schedules (IST):
```
matchmaker:           "*/30 * * * *"
follow-up:            "0 * * * *"
reminders (Guardian): "0 9 * * *"
re-engage:            "0 10 * * *"
```

Add `app/api/cron/_health/route.ts` that returns the last successful run timestamp per agent (read from `agent_execution_logs`). Azure should ping this URL — if any agent is silent for > 2× its cron interval, surface an alert in the UI.

**Gate 3:** Set the schedules to `*/2 * * * *` for one hour in staging. Confirm rows appear automatically in `agent_execution_logs` for **all five agents** without any manual curl.

### Phase 4 — Admin UI: Make The AI Operations Center Tell The Truth

Replace the current `AI Operations Center` view (the one in your screenshot) with this layout. The user is **the admin** — assume zero patience for guessing.

**Top bar**
- Production / Staging mode badge (read from `process.env.NODE_ENV`).
- Global health: green if all 5 agents ran within their expected window; amber if any is overdue; red if any failed last run.
- "Force Run" button (admin only) that POSTs to the agent route with `trigger=manual`.

**Agent Card (one per agent, 5 total)** — every card MUST show:

- Agent name + icon + 1-line purpose.
- **Schedule** (e.g. "Every hour" / "Daily 09:00 IST") and **next expected run** (computed client-side from cron).
- **Last run**: timestamp, duration, status pill, runId.
- **Counters**: total runs (24h / 7d / all-time), success %, leads acted on, calls triggered, OpenAI tokens spent, $ cost estimate.
- **KB linkage** badge — for Matchmaker / Re-engager / Price Drop / Builder Refiner: count of builders queried from KB on last run, with a click-through to the KB doc.
- **Live indicator** (pulsing green dot when `executionEventBroadcaster` is sending events for this agent).
- "View live trace" button → opens `LiveAgentMonitoring` modal subscribed to `agent_id`.
- "View history" → opens drawer listing last 50 runs with reasoning steps, OpenAI prompt/response, Vapi call ids, Mongo writes.

**Live Activity Log (bottom)** — must aggregate **all 5 agents**, not just Matchmaker. Each line: timestamp, agent badge, status icon, one-line summary, click → open run detail drawer.

**Run Detail Drawer** — the heart of admin observability. Must show:

```
1. Input payload
2. Reasoning steps (collapsible, color-coded by kind)
3. Actions:
   - openai_call → prompt, model, tokens, response (truncated, expandable)
   - vapi_call   → assistant id, phone, call id, recording url
   - mongo_write → collection, op, document delta
   - kb_query    → collection, filter, hits
4. Output
5. Reasoning summary (human-readable, gpt-4o-mini)
6. Errors with stack
7. Permalink: /admin/runs/{runId}
```

This is what removes the "I don't know what it's doing in the background" problem.

**Gate 4:** Open the Operations Center after a cron sweep. All 5 cards show non-zero counters. Live Activity Log shows all 5 agents. Click any card → live trace streams events as the next run fires. Click any line → drawer shows full reasoning.

### Phase 5 — Re-enable Reasoning Summaries Safely

The SSL issue in your doc was caused by internal self-fetch. Refactor `reasoningSummaryGenerator.ts` to be invoked **in-process** from `runAgent` after `completeAgentRun`. Wrap in `try/catch` with `setTimeout` deadline of 8 s. If it fails, log to the run as `summary_failed=true` and still return success. Re-enable in production.

**Gate 5:** Every run row in `agent_execution_logs` has a `reasoning_summary.summary` string within 10 s of completion, or an explicit `summary_failed=true` flag.

### Phase 6 — KB Wiring End-To-End

Verify and surface:

1. Builder KB collection is seeded (`scripts/seed_builder_kb.js`) with reputation, payment plans, delivery timelines, financing options, service locations.
2. `builderKBService.searchBuilders()` and `getBuilderData()` are called from Matchmaker AND Builder Refiner.
3. Each KB query is logged as an action `kb_query`.
4. The agent card shows "KB hits: N (last run)" with a tooltip listing builder names retrieved.

**Gate 6:** Run Matchmaker manually. The run drawer must show ≥ 1 `kb_query` action with retrieved builder docs.

---

## 6. Acceptance Tests (You Must Run These Before Declaring Done)

Add `scripts/e2e_agents.ts` that performs each test and prints PASS/FAIL.

1. **Cron-to-UI**: Force-run each of 5 agents → within 5 s, the corresponding card's runId, last run, and Live Activity Log line update without page reload.
2. **OpenAI**: Each Matchmaker run produces a JSON pairing with `score`, `client_id`, `property_id`, `rationale`. No mock data. Tokens recorded.
3. **Vapi**: When Matchmaker score ≥ 75, a real Vapi call is initiated and `vapi_call_id` appears in actions. (Use a test phone number behind a flag.)
4. **Mongo**: Lead status transitions are written to `lead_state_history`.
5. **KB**: At least 1 `kb_query` action per Matchmaker / Builder Refiner / Re-engager run.
6. **Resilience**: Kill the OpenAI key → run still creates a `failed` row with the error visible in the drawer. Restore key → next run succeeds. App never crashes.
7. **No self-HTTPS**: `grep -R "https://gharsoch.tech" app/ lib/` must return zero hits inside server code.
8. **Index health**: `scripts/create_indexes.js` is idempotent and exits 0.

---

## 7. Hard "Do Not" List (Your Past Drift Came From These)

- **Do NOT** invent new agents. There are exactly 5.
- **Do NOT** add mock data. Empty state is fine; fake data is not.
- **Do NOT** call your own domain over HTTPS from the server.
- **Do NOT** swallow errors silently. Every catch must `failAgentRun`.
- **Do NOT** log secrets. Mask `OPENAI_API_KEY`, `VAPI_API_KEY`, `CRON_SECRET` in any log line.
- **Do NOT** introduce a new state store. Mongo is the single source of truth.
- **Do NOT** change the data model fields documented in the README (Lead, Property, Appointment, Campaign, Call). You may **add** fields, never **rename** or **remove**.
- **Do NOT** ship a UI change without also updating `docs/PROJECT_STRUCTURE_AND_FILE_MAP.md`.
- **Do NOT** mark a phase complete unless its Gate above passes against real Cosmos + real Vapi sandbox.

---

## 8. Definition of Done

The build is done when, and only when, the admin can:

1. Open `gharsoch.tech` → AI Operations Center.
2. See **all 5 agent cards green** with non-zero counters and recent timestamps.
3. Click any card → see live thinking events streaming during the next cron sweep.
4. Click any history row → see exact OpenAI prompt + response, Vapi call id, KB hits, Mongo writes, and a plain-English summary of what the agent did and why.
5. Trust that what the brainstorm doc promised (Matchmaker → Lead → Vapi pitch; hourly follow-up; 9 AM reminder; 60-day re-engagement; price-drop negotiation) is actually happening on schedule, with full audit trail, with no human in the loop.

If any of those five statements is not true at the end of your work, you are not done — return to the failing Phase Gate and fix it before continuing.

---

## 9. Cron vs Event vs Orchestrator — Direct Answer to "Is the cron pattern right?"

**Short answer: partially right. Half of your agents must NOT be on a cron at all.**

Cron is a wall-clock timer. It is correct for **time-based** automations and wrong for **state-change** automations. Mixing the two on cron is why the IDE keeps drifting and the UI feels misaligned with the brainstorm.

| Agent | Correct Trigger | Why |
|-------|-----------------|-----|
| **Matchmaker** | **Event** (new client POST, new property POST, OR MongoDB change stream) | Should fire the moment data lands, not 30 min later |
| **Follow-Up** | **Cron hourly** | Time-based, scans `next_follow_up_date <= now()` |
| **Appointment Guardian** | **Cron daily 09:00 IST** | Time-based, looks at next 24h calendar |
| **Dead Lead Re-engager** | **Cron daily 10:00 IST** | Time-based, 60-day inactivity sweep |
| **Price Drop Negotiator** | **Event** (property PATCH where `price` decreased) | State-change, must be instantaneous |
| **Voice Conversation Orchestrator** | **Live, in-call** (Vapi tool-call → webhook) | Real-time, sub-second, NOT a cron |

Action: split the routing into two surfaces.
- `app/api/cron/*` → only Follow-Up, Reminders, Re-engage.
- `app/api/agent/<name>/route.ts` → invoked **in-process** by `app/api/clients/route.ts` (POST), `app/api/properties/route.ts` (POST + PATCH), and `app/api/vapi/webhook/route.ts` (tool-call). No self-HTTPS.

This is the answer to the "is cron right" question. Refactor before adding more cron jobs.

---

## 10. Multi-Agent Orchestration (Microsoft AutoGen / Semantic Kernel)

The brainstorm asks for **agents that stay responsible between calls and during calls**, not isolated cron handlers. That is a real orchestration problem and `runAgent` alone does not solve it. Add a thin orchestrator on top.

### 10.1 Recommended framework

Pick **one** of these. Do not roll your own state machine.

| Option | Use when | Notes |
|--------|----------|-------|
| **Microsoft AutoGen** (Python) — `pyautogen` | If you can stand up a small Python sidecar service on Azure App Service / Container App | Mature multi-agent conversation with handoffs, retries, tool routing. Best multi-agent ergonomics today. |
| **Microsoft Semantic Kernel** (TypeScript: `@microsoft/semantic-kernel`) | If you want everything in the existing Next.js Node runtime | Native TS, Azure-friendly, plugins map cleanly to your Vapi tools and KB service. **Pick this for GharSoch — keeps one codebase.** |
| **LangGraph** (TS) | Only if you already have LangChain elsewhere | Otherwise dependency overkill |

**Decision: use Semantic Kernel for TypeScript.** Reason: stays inside the Next.js process, no extra deployment unit, native Azure auth, and the "Plugins" model maps 1:1 to your Vapi tool list.

### 10.2 The Agent Roster (Semantic Kernel "Agents")

Build these as `ChatCompletionAgent` instances inside `lib/orchestrator/`:

| Agent | Responsibility | Owns Tools / Plugins |
|-------|----------------|----------------------|
| **Main Brain Orchestrator** | Routes tasks across other agents. Holds shared `ChatHistory` per lead (persisted to Mongo `agent_conversations`). | None directly — only delegation. |
| **Client→Lead Converter** | Decides when a Client becomes a Lead and with what initial score | `LeadPlugin` (create/update lead), `KBPlugin.searchBuilders` |
| **Matchmaker Agent** | Pairs clients to properties with rationale | `PropertyPlugin.search`, `KBPlugin.searchBuilders`, `MatchPlugin.score` |
| **Voice Conversation Orchestrator** | Live call coordinator. Receives Vapi tool-calls in `app/api/vapi/webhook` and routes to the right agent mid-call. | All 8 Vapi tools (Section 11) |
| **Lead Qualification & Objection Agent** | Captures preferences, classifies objections, raises hot/warm/cold | `LeadPlugin.qualify`, `KBPlugin.objectionPlaybook` |
| **Appointment Agent** | Books / confirms / reschedules / cancels site visits | `AppointmentPlugin.*`, `GoogleCalendarPlugin` |
| **Follow-Up Agent** | Decides who to call next and when | `LeadPlugin.list`, `VapiPlugin.outbound` |
| **Re-engagement Agent** | Crafts re-engagement context from old transcripts | `CallArchivePlugin.lastTranscript`, `VapiPlugin.outbound` |
| **Price-Drop Agent** | Reacts to property price decreases | `PropertyPlugin.delta`, `LeadPlugin.byObjection`, `VapiPlugin.outbound` |
| **Builder Property Refiner** | Re-ranks matches by builder KB facts | `KBPlugin.builders` |
| **Post-Call Sync / Validator Agent** | Reconciles Vapi transcript ↔ lead state ↔ appointment state | `CallPlugin.sync`, `LeadStateHistoryPlugin.write` |
| **Campaign Conductor** | Picks the right outbound assistant + script per lead in a campaign | `CampaignPlugin.next`, `VapiPlugin.outbound` |

### 10.3 Inter-call memory (the missing piece)

Persist per-lead conversation state in Mongo collection `agent_conversations`:

```ts
{
  lead_id,
  conversation_id,
  shared_context: { last_objection, last_property_shown, last_promise, last_callback_at },
  agent_history: [ { agent_name, summary, ts } ],
  vapi_call_ids: [...],
  updated_at
}
```

Every agent reads this **before** calling its handler, and writes back the delta after. That is what makes the orchestrator "responsible between calls" — the next call inherits memory, not a blank slate.

### 10.4 Mid-call routing

In `app/api/vapi/webhook/route.ts`, on a `tool-calls` event from Vapi, do **not** branch on tool name with `if/else`. Instead:

```ts
const orchestrator = await getOrchestrator(leadId);
const result = await orchestrator.handleToolCall(toolName, toolArgs, callContext);
return NextResponse.json({ results: [{ toolCallId, result }] });
```

The orchestrator picks the right Semantic Kernel agent + plugin, executes, persists the conversation delta, and returns the tool result Vapi expects. This is what the brainstorm meant by "real multi-agent model".

---

## 11. Vapi Wiring (Locked to Your Existing Setup — Sunrise Property)

Your assistants are **Sunrise Property-outbound / -inbound / -reminder** with `gpt-4o`, ElevenLabs Rachel voice, server URL `https://gharsoch.tech/api/vapi/webhook`. Lock the env vars and tool routing exactly as below — do not invent new tool names.

### 11.1 Env (replace the placeholders in Section 3)

```
VAPI_ASSISTANT_OUTBOUND_ID   # Sunrise Property-outbound
VAPI_ASSISTANT_INBOUND_ID    # Sunrise Property-inbound
VAPI_ASSISTANT_REMINDER_ID   # Sunrise Property-reminder
```

### 11.2 Webhook tool router (`app/api/vapi/webhook/route.ts`)

Route the **exact 8 tools** from your Vapi setup — no more, no less:

| Vapi tool | Backend handler | Mongo collection | Owning agent |
|-----------|-----------------|------------------|--------------|
| `search_properties` | `PropertyPlugin.search(filters)` | `properties` | Matchmaker / Voice Orchestrator |
| `qualify_lead` | `LeadPlugin.qualify(payload)` | `leads` | Lead Qualification Agent |
| `book_appointment` | `AppointmentPlugin.book(payload)` | `appointments` + Google Calendar | Appointment Agent |
| `schedule_callback` | `LeadPlugin.scheduleCallback(payload)` | `leads.next_follow_up_date` | Follow-Up Agent |
| `mark_dnd` | `LeadPlugin.markDnd(phone, reason)` | `leads.dnd_status` + `dnc` collection | Voice Orchestrator |
| `calculate_affordability` | Pure function in `lib/affordability.ts` | — | Voice Orchestrator |
| `confirm_appointment` | `AppointmentPlugin.confirm(id)` | `appointments` | Appointment Agent |
| `reschedule_appointment` | `AppointmentPlugin.reschedule(id, date, time)` | `appointments` | Appointment Agent |
| `cancel_appointment` | `AppointmentPlugin.cancel(id, reason)` | `appointments` | Appointment Agent |

**Every tool-call must:**
1. Be wrapped in `runAgent` (Section 4) with `trigger='vapi_tool'`.
2. Read + write `agent_conversations` for the lead.
3. Return the JSON shape Vapi expects (`{ toolCallId, result }`).
4. Validate `assistantId` against the 3 known IDs — reject unknowns to prevent spoofed webhooks.
5. Verify Vapi webhook signature header (`x-vapi-secret` if you set one in Vapi dashboard).

### 11.3 `end-of-call-report` handler

When Vapi sends `end-of-call-report`, the webhook must:
1. Persist the full transcript + recording URL to `calls`.
2. Hand off to **Post-Call Sync Agent** for GPT-4o extraction (sentiment, objections, lead_score, next_steps).
3. Update `leads` and `agent_conversations.shared_context.last_*`.
4. Broadcast a `post_call_sync` event so the UI activity log updates in real time.

---

## 12. Client → Lead Conversion Automation (Brainstorm Item 1)

The brainstorm flow `Create Client → automation converts to Lead → Matchmaker → Vapi pitch` must be wired explicitly.

### 12.1 New collection `clients` (separate from `leads`)

```ts
// models/Client.ts
{
  name, phone, email,
  source,                  // 'manual', 'csv_upload', 'web_form'
  budget_range, location_pref, property_type,
  raw_notes,
  status: 'new' | 'converting' | 'converted_to_lead' | 'rejected',
  created_at, updated_at,
  converted_lead_id?: string
}
```

### 12.2 Conversion flow

`POST /api/clients` (single) and `POST /api/clients/bulk` (CSV) both:
1. Insert into `clients` with `status='new'`.
2. **In-process** call `clientLeadConverterAgent.run({ clientId })` (no HTTP fetch).
3. The agent decides: enough info to qualify → create `leads` row, set `qualification_status='qualified'`, `lead_score>=N`. Otherwise → mark `status='rejected'` with reason.
4. On qualified, **in-process** call `matchmakerAgent.run({ leadId })`.
5. If matches with `score>=75` exist, **in-process** call `vapiPlugin.outbound({ leadId, assistantId: VAPI_ASSISTANT_OUTBOUND_ID, context: matchPayload })`.
6. Every step is a `reasoning_step` and `action` in the parent `runAgent` trace — admin sees the full chain in one drawer.

### 12.3 UI surface

`Clients` section (already exists) gets a new column: **"Conversion status"** with badges `new` / `converting` / `qualified` / `called` / `rejected (reason)`. Clicking a row opens the same **Run Detail Drawer** from Section 5 Phase 4 — admin sees exactly which agent did what.

---

## 13. Campaign Automation (Brainstorm Item — Campaigns Need To Work With Automation)

Campaigns are just batched, scheduled outbound runs. Fix them properly:

1. `POST /api/campaigns/trigger` is wrapped in `runAgent` with `agentId='campaign_conductor'`.
2. The Campaign Conductor agent loops through `target_lead_ids`:
   - Skip if `dnd_status=true` or `last_contacted_at` within last 24h.
   - For each lead, call `matchmakerAgent.run({ leadId })` to refresh property context.
   - Call `vapiPlugin.outbound({ leadId, assistantId: VAPI_ASSISTANT_OUTBOUND_ID, context: { campaign, matches } })`.
   - Throttle: max 5 concurrent calls, 2 s between starts, full TRAI window check (no calls 21:00–09:00 IST).
3. Emit a `campaign_progress` event after each lead so UI shows `12 / 50 dialed, 3 booked, 2 DNC`.
4. Campaign card in UI shows live progress bar + per-lead status table.

---

## 14. UI Redesign — Admin View vs Broker View

The current UI is stale and merges admin and broker concerns. Split them.

### 14.1 Two personas, two surfaces

| Persona | Sees | Does not see |
|---------|------|--------------|
| **Admin / Operator** | AI Operations Center, full execution traces, OpenAI prompts/responses, KB hits, Vapi call ids, cost dashboard, system health, agent control panel | — (sees everything) |
| **Broker (default)** | Clean dashboard: leads, properties, calls, appointments, campaigns, analytics | Reasoning steps, prompt/response payloads, raw tool calls, cost numbers |

Toggle controlled by `user.role` in `lib/auth.ts`. Default = broker. Admin gets a **"View as Broker"** switcher.

### 14.2 Operations Center redesign (replaces the current screenshot)

Build to the HTML prototype shipped alongside this prompt (`gharsoch_ai_ops_prototype.html`). Specifically:

- Apple-grade visual language: warm off-white background `#fafaf7`, 1px hairline dividers, generous whitespace, single accent color `#0071e3`, SF / Inter system stack, no heavy borders.
- **Top strip**: global health pill, environment badge, OpenAI tokens today, Vapi minutes today, Mongo write count, "Force run" admin action.
- **Agent grid (5 cards)**: each card shows schedule, next expected run, last run pill (success/failed/running), runs in 24h, calls triggered, leads acted on, KB hits, live pulsing dot. Click → expands inline to show **the actual matched items** (e.g. "Matchmaker · 3 matches" expands to the 3 client→property pairs with score, builder, rationale, and the Vapi call link if dialed).
- **Live Activity stream**: full-width, all 5 agents combined, color-coded badges, click any row → side drawer with full reasoning steps, OpenAI request/response, Vapi call ids, Mongo deltas, KB hits.
- **System Map sub-tab**: a small live diagram showing `Cron / Event → Orchestrator → Agent → Plugin (OpenAI / Vapi / Mongo / KB) → Lead update`, with edges that flash when traffic is flowing.

### 14.3 Sidebar cleanup

- Group nav into `Work` (Dashboard, Leads Pipeline, Clients, Properties, Campaigns, Appointments, Call Logs) and `Intelligence` (AI Operations, Analytics, Knowledge Base, Agent Activity).
- Move Settings to a small icon at the bottom; remove unrelated settings (anything that doesn't change runtime behavior moves to a `Profile` modal).
- Add a global Command Palette (`⌘K`) with shortcuts to "Force-run agent", "Open run", "Find lead by phone", "View KB doc".

### 14.4 Definition of "professional"

If any of the following is true, the UI is not done:
- Any card shows a number with no way to drill into what produced it.
- Live Activity Log only shows one agent.
- Settings page contains anything unrelated to runtime behavior.
- The screen looks like a Tailwind starter template (rounded-xl + shadow-md + gray cards).
- An admin cannot answer "what did Matchmaker just match and why" in one click.

---

## 15. Azure Cron README (paste this into `docs/AZURE_CRON_SETUP.md` verbatim)

This is the canonical setup for the **time-based half** of the system (Follow-Up, Reminders, Re-engage). Event-based agents do NOT use this — they are triggered in-process from API routes (Section 9 / 12 / 13).

### 15.1 Choose ONE of two patterns

**Pattern A — Azure Function TimerTrigger calling your Next.js route (recommended).**
Keeps Next.js stateless. Function lives in a separate Function App, fires on schedule, POSTs to your route with `x-cron-secret`.

**Pattern B — Azure WebJobs in the same App Service.**
Simpler but less observable. Use only if you cannot deploy a Function App.

### 15.2 Pattern A — Function App layout

```
azure/functions/
  ├── host.json
  ├── local.settings.json
  ├── package.json
  ├── follow-up/
  │     ├── function.json
  │     └── index.ts
  ├── reminders/
  │     ├── function.json
  │     └── index.ts
  └── re-engage/
        ├── function.json
        └── index.ts
```

`host.json` (timezone is critical):

```json
{
  "version": "2.0",
  "extensions": { "http": { "routePrefix": "" } },
  "logging": { "applicationInsights": { "samplingSettings": { "isEnabled": true } } }
}
```

App Setting on the Function App: `WEBSITE_TIME_ZONE = India Standard Time`. Without it, all NCRONTAB schedules run in UTC and the 09:00 IST Reminder will fire at 14:30 IST.

`follow-up/function.json`:

```json
{
  "bindings": [
    { "name": "myTimer", "type": "timerTrigger", "direction": "in", "schedule": "0 0 * * * *" }
  ],
  "scriptFile": "index.js"
}
```

NCRONTAB is **6-field** (`{second} {minute} {hour} {day} {month} {dow}`), not standard cron. Use:
- Follow-Up: `0 0 * * * *`            (every hour, on the hour)
- Reminders: `0 0 9 * * *`            (daily 09:00)
- Re-engage: `0 0 10 * * *`           (daily 10:00)

`follow-up/index.ts`:

```ts
import { AzureFunction, Context } from "@azure/functions";

const fn: AzureFunction = async (ctx: Context, _myTimer: any) => {
  const url = `${process.env.PUBLIC_APP_URL}/api/cron/follow-up`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-cron-secret": process.env.CRON_SECRET!,
      "content-type": "application/json"
    },
    body: JSON.stringify({ trigger: "azure_timer", invocationId: ctx.invocationId })
  });
  const body = await res.text();
  ctx.log(`follow-up: ${res.status} ${body.slice(0, 200)}`);
  if (!res.ok) throw new Error(`follow-up cron failed: ${res.status}`);
};
export default fn;
```

Same shape for `reminders/index.ts` and `re-engage/index.ts`, swapping the path.

### 15.3 Required App Settings (Function App)

```
PUBLIC_APP_URL              = https://gharsoch.tech
CRON_SECRET                 = <same value as Next.js app>
WEBSITE_TIME_ZONE           = India Standard Time
APPLICATIONINSIGHTS_CONNECTION_STRING = <from App Insights>
```

### 15.4 Verifying it actually fires (the screenshot problem)

Right now your screenshot shows "200 successful" but the UI is empty. Run this checklist:

1. In Azure Portal → Function App → `follow-up` → Monitor: confirm `success` invocations at the right wall-clock time **in IST**.
2. In Application Insights → `traces`: confirm the Function logged `follow-up: 200`.
3. In MongoDB → `agent_execution_logs`: confirm a new row with `agent_id='follow_up_agent'` and `started_at` matching the invocation.
4. In the Operations Center UI: confirm the Follow-Up card moved off "Awaiting first CRON trigger" within 5 s.

If steps 1–2 pass but 3 fails → the Next.js route is not wrapped in `runAgent`. Fix Section 4.
If steps 1–3 pass but 4 fails → the `executionEventBroadcaster` is not being called. Fix Section 4.
If step 1 fails → wrong NCRONTAB or missing `WEBSITE_TIME_ZONE`. Fix Section 15.2.

### 15.5 Local development

Run the Function host locally with the Azure Functions Core Tools:

```bash
cd azure/functions
npm install
func start
```

Set `PUBLIC_APP_URL=http://localhost:3333` in `local.settings.json` to hit the local Next.js dev server.

### 15.6 Failure handling

- Function retries: configure `maxRetryCount: 3` with exponential backoff in `host.json` `extensions.functions`.
- If the route returns 5xx, the Function fails; Azure raises an alert (configure Application Insights alert rule → "follow-up failures > 0 in 10 min").
- Each cron run has a **deterministic idempotency key** = `agentId:date:hour`. The Next.js route checks `agent_execution_logs` for that key in the last hour and refuses duplicate runs. This protects against double invocation during retries.

---

## 16. First Action You Must Take Right Now

1. Generate a written **gap report** comparing the existing repo against Sections 3, 4, 5, 9, 10, 11, 12, 13, 14, and 15. List every missing file, every missing env var, every cron route that is not wrapped in `runAgent`, every event-trigger that is wrongly on cron, every agent card that does not have a KB / live-trace link, every place a server route self-fetches `https://gharsoch.tech`, and every Vapi tool that does not flow through the orchestrator.
2. Print the gap report as `docs/MASTER_GAP_REPORT.md`.
3. Then begin Phase 1. Do not begin Phase 2 until Gate 1 passes. Add new Phases 7 (Orchestrator), 8 (Client→Lead + Campaign automation), 9 (UI redesign to match the prototype) — same Gate discipline.

You will iterate phase by phase, posting the result of each Gate before moving on.

— End of master prompt —