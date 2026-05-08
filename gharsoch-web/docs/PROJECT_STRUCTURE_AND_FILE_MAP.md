# Project Structure and File Map

**Last updated:** 2026-05-07

This file is a compact map of the GharSoch project: what each important file does, where the main logic lives, and how the files connect to each other.

The project is a Next.js 14 application with three main layers:

- **UI layer**: `app/`, `components/`, `hooks/`
- **Business logic layer**: `lib/`, `models/`, `data/`
- **Execution layer**: `app/api/`, cron jobs, agent routes, Vapi integration, MongoDB/Cosmos DB, OpenAI

## 1. Root Files

| File | What it does | Connected to |
| --- | --- | --- |
| `README.md` | Main project overview and feature summary | New contributors, setup, high-level product context |
| `PRD-2026-04-22 (1).md` | Product requirements and feature intent | UI, agents, automations, roadmap |
| `test_call.ps1` | PowerShell helper for testing call or agent flows | Local API testing, deployment validation |
| `.env` | Local environment secrets and runtime config | OpenAI, MongoDB, Vapi, Azure, auth |
| `.env.example` | Sample environment template | Setup guidance |
| `.eslintrc.json` | Lint rules for the app | `app/`, `components/`, `lib/` |
| `.gitignore` | Excludes temp files, build output, secrets, docs not meant for git | `PHASE_7_*`, `.next/`, `node_modules/`, `.env` |
| `components.json` | shadcn/ui configuration | `components/ui/*` |
| `Dockerfile` | Container build instructions | Deployment and Azure/App Service |
| `netlify.toml` | Netlify deploy config, if used | Hosting/build settings |
| `next-env.d.ts` | Next.js TypeScript declarations | TypeScript build support |
| `next.config.js` | Next.js runtime/build config | App routing, deployment behavior |
| `package.json` | Dependencies and scripts | Build, dev, lint, runtime dependencies |
| `package-lock.json` | Locked dependency tree | Reproducible installs |
| `postcss.config.js` | PostCSS/Tailwind pipeline config | Styling build |
| `tailwind.config.ts` | Tailwind theme/config | UI styling across app |
| `tsconfig.json` | TypeScript compiler config | Entire codebase |
| `publish_profile.xml` | Deployment profile artifact | Azure-style publishing |
| `workflow.json` | App workflow definition | UI flow / agent orchestration |
| `workflow_state.json` | Saved workflow state | Workflow resuming / debugging |
| `PHASE_7_IMPLEMENTATION.md` | Phase 7 implementation notes | Agent monitoring work |
| `PHASE_7_QUICK_START.md` | Quick start for Phase 7 features | Real-time monitoring setup |
| `PHASE_7_TESTING.ts` | Phase 7 test helper / scratch script | Testing agent monitoring |
| `CLAUDE.md` | Project rules and agent instructions | Development workflow |

## 2. Top-Level Folder Map

| Folder | What it contains | What it connects to |
| --- | --- | --- |
| `app/` | Next.js App Router pages and API routes | UI, backend endpoints, agent system |
| `components/` | Shared React components and UI primitives | Pages, dashboards, dialogs, monitoring panels |
| `hooks/` | Custom client hooks | Live monitoring, agent state, responsive behavior |
| `lib/` | Core utilities, services, and integrations | MongoDB, OpenAI, Vapi, Azure Blob, auth, scheduler |
| `models/` | Data models / Mongoose-like schema definitions | MongoDB collections, CRUD routes, validation |
| `data/` | Seed/demo data and fixture content | KB demo data, property seed data |
| `docs/` | Human-readable project documentation | Setup notes, architecture notes, this map |
| `pages/` | Legacy Next.js pages router files | Backward-compatible error/document behavior |
| `public/` | Static assets served directly | Images, icons, browser assets |
| `response_schemas/` | Expected JSON formats returned by agents | `lib/aiAgent.ts`, `app/api/agent/*` routes |
| `scripts/` | Maintenance scripts and utilities | Indexing, seeding, testing, migration helpers |

## 3. App Shell Files

| File | What it does | Connected to |
| --- | --- | --- |
| `app/layout.tsx` | Root layout and shared shell | All app routes |
| `app/page.tsx` | Main entry page for the dashboard UI | `app/sections/*`, shared components |
| `app/globals.css` | Global styles and theme foundation | Tailwind, entire UI |
| `app/loading.tsx` | Route-level loading UI | App Router navigation states |
| `app/error.tsx` | App-level error boundary UI | Runtime route failures |
| `app/not-found.tsx` | 404 page | Invalid route handling |

### How the shell connects

- `app/layout.tsx` wraps the whole application.
- `app/page.tsx` usually composes the sections and dashboard surfaces.
- `app/globals.css` gives the visual system its base look.
- `app/error.tsx`, `app/loading.tsx`, and `app/not-found.tsx` keep navigation states clean.

## 4. UI Section Files

These files are the visible business screens. They are usually imported into the main page or dashboard composition layer.

| File | What it does | Connected to |
| --- | --- | --- |
| `app/sections/AppContent.tsx` | Main page composition and section switching | `app/page.tsx`, all sections |
| `app/sections/DashboardSection.tsx` | Overview dashboard metrics and summary cards | `app/api/dashboard/stats`, calls, leads |
| `app/sections/AnalyticsSection.tsx` | Analytics view for funnel and performance metrics | Dashboard data and charts |
| `app/sections/LeadsSection.tsx` | Lead list and lead management UI | `app/api/leads`, `models/Lead.ts` |
| `app/sections/LeadPipelineSection.tsx` | Lead pipeline / state flow view | Lead status, call outcomes, follow-ups |
| `app/sections/ClientsSection.tsx` | Client records and client-side relationship view | `app/api/clients`, client profile models |
| `app/sections/PropertiesSection.tsx` | Property inventory and listings view | `app/api/properties`, `models/Property.ts` |
| `app/sections/CampaignsSection.tsx` | Campaign management and outbound flow UI | `app/api/campaigns`, `app/api/campaigns/trigger` |
| `app/sections/CallLogsSection.tsx` | Call history and call summary UI | `app/api/calls`, `models/Call.ts`, archives |
| `app/sections/CallActivitySection.tsx` | Activity timeline for call events | Call logs, Vapi sync, agent events |
| `app/sections/CallCentreSection.tsx` | Call center style execution view | Calls, monitoring, Vapi integration |
| `app/sections/AppointmentsSection.tsx` | Appointment scheduling and review UI | `app/api/appointments`, reminders |
| `app/sections/AgentStatusSection.tsx` | Agent health/status overview | `app/api/agent/*`, execution logs |
| `app/sections/AgentActivitySection.tsx` | Agent activity timeline and trace summary | `agentLogger`, event broadcaster |
| `app/sections/AffordabilitySection.tsx` | Affordability calculator and advisory UI | Financial logic, OpenAI, property data |
| `app/sections/SettingsSection.tsx` | App settings and system configuration | `app/api/system-config`, auth, preferences |
| `app/sections/HomeTruthSection.tsx` | Home truth / real estate insight panel | Dashboard content and data exploration |
| `app/sections/Sidebar.tsx` | Main sidebar navigation | All section screens |
| `app/sections/VoiceCallPanel.tsx` | Voice call control and live call interaction panel | Vapi, voice session state |
| `app/sections/VoiceSessionProvider.tsx` | Context/provider for voice session state | `VoiceCallPanel`, call flow UI |

### How the section layer connects

- `AppContent.tsx` is the glue that switches between screens.
- Each section talks to backend routes in `app/api/`.
- Agent sections connect to the trace and monitoring system in `lib/agentLogger.ts`, `lib/agentExecutionEventBroadcaster.ts`, and `components/LiveAgentMonitoring.tsx`.

## 5. API Routes

These are the backend entry points. They are the operational core of the app.

### Agent and monitoring routes

| File | What it does | Connected to |
| --- | --- | --- |
| `app/api/agent/route.ts` | Main AI agent execution endpoint | `agentRegistry`, `agentLogger`, OpenAI, broadcaster |
| `app/api/agent/run/route.ts` | Manual trigger router for specific agents and cron-like flows | Agent and cron endpoints |
| `app/api/agent/matchmaker/route.ts` | Matchmaking agent execution route | Property/client matching, KB, AI summaries |
| `app/api/agent/builder-refiner/route.ts` | Builder-aware property ranking route | `builderKBService`, agent logger, OpenAI |
| `app/api/agent/price-drop/route.ts` | Price-drop agent route | Property updates, match refresh, alerts |
| `app/api/agent/call-state-validator/route.ts` | Validates call state vs lead state consistency | Call sync, lead updates, validation output |
| `app/api/agent/ws/route.ts` | Live execution event stream using SSE | `executionEventBroadcaster`, monitoring UI |
| `app/api/agent/[agentId]/executions/route.ts` | Returns execution history for a specific agent | `agentLogger`, monitoring dashboards |

### Follow-up, cron, and automation routes

| File | What it does | Connected to |
| --- | --- | --- |
| `app/api/cron/follow-up/route.ts` | Scheduled follow-up automation | Leads, calls, Vapi, `agentLogger` |
| `app/api/cron/re-engage/route.ts` | Re-engagement automation | Lead and property matching flows |
| `app/api/cron/reminders/route.ts` | Appointment reminder automation | Appointments, reminders, Vapi |
| `app/api/cron/archive/route.ts` | Archive automation for finished records | Call archives, historical data |
| `app/api/cron/followups/route.ts` | Alternate follow-up cron route | Follow-up execution flow |
| `app/api/follow-ups/route.ts` | Follow-up CRUD / management endpoint | Follow-up screens and state |
| `app/api/follow-ups/execution-history/route.ts` | Execution history for follow-up operations | Monitoring and audit trail |

### Call routes

| File | What it does | Connected to |
| --- | --- | --- |
| `app/api/calls/route.ts` | Call record CRUD / listing | Call logs UI, sync flows |
| `app/api/calls/sync/route.ts` | Syncs Vapi calls into app state | `vapiClient`, leads, validator, OpenAI |
| `app/api/calls/lead/[id]/route.ts` | Returns or updates call data for a lead | Lead detail screens |
| `app/api/archive/calls/route.ts` | Archived calls history endpoint | Archived call logs |
| `app/api/_archive_call-logs/route.ts` | Older archive route for call logs | Historical records |

### Lead, property, client, campaign, appointment routes

| File | What it does | Connected to |
| --- | --- | --- |
| `app/api/leads/route.ts` | Lead CRUD and filtering | Lead dashboard and follow-up logic |
| `app/api/leads/webhook/route.ts` | Lead intake or webhook-style ingestion | External lead sources |
| `app/api/properties/route.ts` | Property CRUD and search | Matchmaking, rankings, property screens |
| `app/api/clients/route.ts` | Client creation and background matchmaker trigger | `agent/matchmaker`, client profiles |
| `app/api/campaigns/route.ts` | Campaign CRUD and management | Campaign screens, outbound operations |
| `app/api/campaigns/trigger/route.ts` | Triggers a campaign call or campaign flow | Vapi, scripts, property context |
| `app/api/appointments/route.ts` | Appointment CRUD and scheduling | Appointment screens, reminders |
| `app/api/builders/route.ts` | Builder lookup and builder records | Builder refiner, KB data, property ranking |

### Knowledge, files, and system routes

| File | What it does | Connected to |
| --- | --- | --- |
| `app/api/kb/search/route.ts` | Searches the knowledge base | KB UI, builder/property assistance |
| `app/api/rag/route.ts` | RAG content operations | Knowledge base ingestion and retrieval |
| `app/api/upload/route.ts` | File upload endpoint | KB uploads, document ingestion |
| `app/api/system-config/route.ts` | System settings storage and retrieval | Settings UI and app behavior |
| `app/api/dashboard/stats/route.ts` | Dashboard metrics API | Home dashboard and analytics |
| `app/api/health/route.ts` | Health check endpoint | Monitoring and deploy readiness |
| `app/api/seed/route.ts` | Seed/reset helper for data setup | Local/dev data initialization |
| `app/api/dnc/route.ts` | Do-not-call list management | Lead qualification and compliance |
| `app/api/activities/route.ts` | Generic activity feed endpoint | Activity timelines and dashboards |
| `app/api/agent-activities/route.ts` | Agent activity feed endpoint | Agent activity UI |
| `app/api/vapi/webhook/route.ts` | Vapi webhook receiver | Call updates, transcripts, sync |
| `app/api/auth/login/route.ts` | Login endpoint | `lib/auth.ts`, user sessions |
| `app/api/auth/logout/route.ts` | Logout endpoint | Session clearing |
| `app/api/auth/me/route.ts` | Returns current user info | Session state and protected UI |
| `app/api/auth/register/route.ts` | User registration endpoint | Auth flows |

### Archive routes

| File | What it does | Connected to |
| --- | --- | --- |
| `app/api/_archive_client-profiles/route.ts` | Old client profile archive route | Historical data |
| `app/api/_archive_property-assessments/route.ts` | Old property assessment archive route | Historical scoring data |
| `app/api/_archive_property-matches/route.ts` | Old property match archive route | Historical match data |
| `app/api/_archive_scheduled-meetings/route.ts` | Old scheduled meeting archive route | Historical appointment data |
| `app/api/archive/calls/route.ts` | Archived call browsing route | Call history and reports |

### How the API layer connects

- Agent routes call `lib/agentLogger.ts` for trace storage.
- Agent routes call `lib/agentExecutionEventBroadcaster.ts` for live monitoring.
- Calls and cron routes connect to `lib/vapiClient.ts` and `lib/googleCalendar.ts` for external automation.
- Matching and refinement routes use `lib/builderKBService.ts`, `lib/ragKnowledgeBase.ts`, and `lib/aiAgent.ts`.
- Authentication routes use `lib/auth.ts` and `lib/mongodb.ts`.

## 6. Library Files

| File | What it does | Connected to |
| --- | --- | --- |
| `lib/mongodb.ts` | Database connection helper and collection access | All CRUD and agent routes |
| `lib/auth.ts` | Auth helpers and session logic | Login, logout, protected endpoints |
| `lib/aiAgent.ts` | Client-side agent call helper | `app/page.tsx`, dashboards, forms |
| `lib/agentRegistry.ts` | Central registry of agent IDs, prompts, and models | All agent routes |
| `lib/agentLogger.ts` | Stores execution traces, reasoning steps, actions, and errors | Agent routes, cron jobs, monitoring |
| `lib/agentExecutionEventBroadcaster.ts` | Emits live execution events for monitoring | SSE route, dashboard monitor |
| `lib/reasoningSummaryGenerator.ts` | Creates human-readable reasoning summaries | Agent routes, currently disabled in prod |
| `lib/builderKBService.ts` | Reads builder knowledge from the KB collection | Builder refiner route |
| `lib/ragKnowledgeBase.ts` | RAG document operations and KB helpers | KB UI and knowledge flows |
| `lib/vapiClient.ts` | Vapi call trigger and call helpers | Follow-up cron, outbound call flows |
| `lib/googleCalendar.ts` | Calendar integration for scheduling | Appointment and scheduling flows |
| `lib/scheduler.ts` | Scheduler utilities and schedule management | `app/api/scheduler`, reminder systems |
| `lib/fetchWrapper.ts` | Shared fetch wrapper with app defaults | Internal API calls and client utilities |
| `lib/jsonParser.ts` | Safe JSON parsing helpers | Agent output parsing, schema handling |
| `lib/download.ts` | File download helper | Export or artifact actions |
| `lib/clipboard.ts` | Clipboard helpers | UI copy actions |
| `lib/iframeLogger.ts` | Logging bridge for iframe or embedded contexts | Embedded UI, tracing tools |
| `lib/azureBlob.ts` | Azure Blob Storage helper | Call recordings, archive files |
| `lib/demoKb.ts` | Demo knowledge base content | Sample KB data and fallback state |
| `lib/crudHandler.ts` | Generic CRUD route helper | Archive routes and reusable CRUD endpoints |
| `lib/utils.ts` | General utility helpers | Shared across UI and backend |
| `lib/callArchiveService.ts` | Call archive storage and retrieval service | Call archive routes and reports |

## 7. Model Files

| File | What it does | Connected to |
| --- | --- | --- |
| `models/Lead.ts` | Lead schema / model | Leads API, follow-up logic, call updates |
| `models/Property.ts` | Property schema / model | Matchmaker, property screens, ranking |
| `models/Call.ts` | Call schema / model | Call logs, sync, Vapi updates |
| `models/Builder.ts` | Builder schema / model | Builder refiner, KB lookup |
| `models/Appointment.ts` | Appointment schema / model | Scheduling and reminders |
| `models/Campaign.ts` | Campaign schema / model | Campaign management and triggers |
| `models/clientProfile.ts` | Client profile schema / model | Matchmaking and refinement |
| `models/propertyMatch.ts` | Property match schema / model | Matchmaker and re-ranking |
| `models/propertyAssessment.ts` | Property assessment schema / model | Advisory and scoring |
| `models/scheduledMeeting.ts` | Scheduled meeting schema / model | Appointments and reminders |
| `models/callLog.ts` | Legacy or detailed call log schema | Call history and reporting |
| `models/systemConfig.ts` | System configuration schema | App settings and feature flags |
| `models/LeadStateHistory.ts` | Lead state history tracking | Call sync, audits, state transitions |
| `models/CallArchive.ts` | Archived call schema | Archive routes and long-term storage |
| `models/AgentExecutionLog.ts` | Agent execution trace schema | Monitoring and execution history |

## 8. Components

### Project-specific components

| File | What it does | Connected to |
| --- | --- | --- |
| `components/ClientProviders.tsx` | Wraps client-side providers | Theme, auth, app-wide client context |
| `components/ErrorBoundary.tsx` | Client error boundary | UI resilience |
| `components/HydrationGuard.tsx` | Prevents hydration mismatch problems | Next.js client rendering |
| `components/IframeLoggerInit.tsx` | Initializes logging in embedded contexts | `lib/iframeLogger.ts` |
| `components/KnowledgeBaseUpload.tsx` | KB upload UI | `app/api/upload`, `app/api/rag` |
| `components/LeadDetailsSheet.tsx` | Slide-over lead details panel | Leads, calls, actions |
| `components/LiveAgentMonitoring.tsx` | Live agent event viewer | `hooks/useRealtimeAgentMonitoring.ts`, SSE route |
| `components/AgentExecutionViewer.tsx` | Shows agent run traces and reasoning | `agentLogger`, execution history endpoints |
| `components/CallStateTransitionViewer.tsx` | Shows call state changes over time | Call sync and validation flows |
| `components/FollowupReasoningDashboard.tsx` | Shows follow-up decision reasoning | Follow-up cron and agent history |

### UI primitives

Everything in `components/ui/` is a reusable design-system primitive. These files are mostly shadcn-style building blocks such as buttons, dialogs, cards, tabs, tables, forms, sheets, drawers, tooltips, badges, alerts, and sidebars.

They connect upward into:

- `app/page.tsx`
- `app/sections/*`
- `components/LiveAgentMonitoring.tsx`
- `components/LeadDetailsSheet.tsx`
- the other dashboard and monitoring components

## 9. Hooks

| File | What it does | Connected to |
| --- | --- | --- |
| `hooks/useAgent.ts` | Client hook for agent interactions and state | Agent calls, dashboards, UI actions |
| `hooks/useRealtimeAgentMonitoring.ts` | Consumes SSE live agent events | `app/api/agent/ws/route.ts`, live monitor UI |
| `hooks/use-mobile.tsx` | Responsive breakpoint helper | Mobile-friendly UI rendering |

## 10. Data, Schemas, and Scripts

| File / Folder | What it does | Connected to |
| --- | --- | --- |
| `data/demokb.json` | Demo KB content | Knowledge base demo and testing |
| `data/propertySeed.ts` | Seed data for properties | Local data setup, initial demos |
| `response_schemas/kb_assistant_response.json` | Expected KB assistant response shape | `lib/aiAgent.ts`, KB UI |
| `response_schemas/voice_conversation_orchestrator_response.json` | Expected voice orchestrator response shape | Voice agent execution and parsing |
| `scripts/bulk_upload_leads.js` | Bulk lead import helper | Lead ingestion and migration |
| `scripts/create_indexes.js` | Database index creation helper | MongoDB/Cosmos DB tuning |
| `scripts/init_collections.js` | Collection bootstrap helper | Local and prod setup |
| `scripts/test_cosmos.js` | Cosmos DB connectivity test | Database diagnostics |
| `scripts/vapi_mock_test.js` | Mock Vapi test helper | Voice call testing without production Vapi |

## 11. Pages Router Files

| File | What it does | Connected to |
| --- | --- | --- |
| `pages/_document.tsx` | Custom document wrapper | HTML shell, fonts, scripts |
| `pages/_error.tsx` | Legacy error page | Fallback error handling |

## 12. How the Main Pieces Connect

### User-facing flow

1. `app/page.tsx` loads `AppContent.tsx`.
2. `AppContent.tsx` switches between `app/sections/*` screens.
3. Sections call backend endpoints in `app/api/*`.
4. Backend routes call services in `lib/*`.
5. Services read/write MongoDB through `lib/mongodb.ts` and models in `models/*`.
6. Agent routes broadcast live events through `lib/agentExecutionEventBroadcaster.ts`.
7. `components/LiveAgentMonitoring.tsx` listens through `hooks/useRealtimeAgentMonitoring.ts`.

### Agent and automation flow

1. A user or cron route triggers an agent.
2. `app/api/agent/*` or `app/api/cron/*` starts a run in `lib/agentLogger.ts`.
3. The route logs reasoning steps and actions.
4. The route may call OpenAI, Vapi, Google Calendar, or KB services.
5. The route stores the result in MongoDB.
6. The broadcaster emits live progress events.
7. The UI can show the run live or read it later from history.

### Matching flow

1. Properties and client data are collected in the UI.
2. Matching routes or agent routes use KB and lead data.
3. Builder refinement uses `builderKBService.ts` and the builder refiner agent.
4. Final ranking is sent back to the dashboard.
5. Monitoring can show why the ranking changed.

### Call sync flow

1. Vapi updates or the sync route fetches the latest call state.
2. `app/api/calls/sync/route.ts` extracts transcript and outcome data.
3. The call record is updated.
4. The related lead is updated.
5. `app/api/agent/call-state-validator/route.ts` checks for mismatches.
6. The result is stored for audit and analytics.

## 13. Short Summary

If you want the fastest mental model of the repository:

- `app/` is the app shell and API surface.
- `components/` is the shared UI and monitoring layer.
- `hooks/` is the client-side state and SSE consumer layer.
- `lib/` is the actual business logic and integration layer.
- `models/` is the data shape layer.
- `docs/` is the project memory.
- `scripts/` is operational tooling.

The main technical spine is:

`UI -> API routes -> lib services -> models/MongoDB -> agent logger + event broadcaster -> monitoring UI`
