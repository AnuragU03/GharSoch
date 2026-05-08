# Agent Reasoning and Automation Log

**Last updated:** 2026-05-07

This document explains how the GharSoch agent system works today, what each automation is responsible for, how reasoning and execution traces are captured, and what has been completed so far. It is intentionally written as an operational log so future updates can extend it instead of starting over.

## 1. What This System Is Doing

GharSoch is not just a dashboard with a few API routes. It is a multi-agent execution system for real estate lead handling, call orchestration, follow-up automation, post-call analysis, and builder-aware property ranking.

The main goals are:

- make each AI decision traceable,
- make background automations visible in real time,
- keep call and lead state synchronized,
- use builder knowledge only from the knowledge base,
- avoid silent failures when one secondary feature breaks,
- keep the core response path fast and reliable.

The current architecture separates the system into three layers:

- **Agent execution layer** for reasoning, tool calls, and final outputs,
- **Automation layer** for cron jobs and call sync tasks,
- **Monitoring layer** for logs, event streaming, and dashboard visibility.

## 2. Core Execution Model

Every meaningful run follows the same pattern:

1. A request arrives at an agent or cron endpoint.
2. The run is registered in MongoDB through `agentLogger.startAgentRun()`.
3. Reasoning steps are logged as the run progresses.
4. Actions are logged when OpenAI, Vapi, MongoDB, or validation services are used.
5. Real-time events are broadcast through the event broadcaster.
6. The run is completed and stored with final output and status.
7. The frontend can read the run trace later or subscribe live to the event stream.

That means the platform has both:

- **durable trace storage** in MongoDB,
- **real-time execution visibility** through server-sent events.

## 3. How Agent Reasoning Is Captured

The execution trace is stored in `agent_execution_logs` and managed by `lib/agentLogger.ts`.

Each trace includes:

- the input payload,
- the agent identity,
- timestamps,
- reasoning steps,
- action records,
- errors,
- output data,
- execution metadata.

Reasoning is not treated as a black box. Instead, the system records the intermediate mental model in structured steps such as:

- evaluation,
- decision,
- constraint check,
- tool call,
- result analysis.

That structure matters because it allows the dashboard or admin tools to explain:

- what the agent considered,
- why it made a choice,
- what it queried,
- what it returned,
- where it failed if something broke.

## 4. Real-Time Event Broadcasting

`lib/agentExecutionEventBroadcaster.ts` is the real-time layer.

It emits execution events on three channels:

- `agent_event` for all listeners,
- `agent:{agentId}` for one specific agent,
- `run:{runId}` for one specific execution.

The event types currently supported are:

- `execution_started`,
- `thinking`,
- `action`,
- `execution_completed`,
- `execution_error`.

This is what makes the live monitor work. It does not need to poll the database for every update. It can subscribe to the active run and receive the events as they happen.

This layer is intentionally separate from the database logger. The logger is for persistence and auditability. The broadcaster is for live visibility.

## 5. Main Agent Endpoint

The main execution route is `app/api/agent/route.ts`.

This route does the following:

- validates the OpenAI key,
- loads the selected agent config from the registry,
- starts a run in the execution logger,
- broadcasts a started event,
- logs agent initialization,
- calls OpenAI for the response,
- logs the action and parses the result,
- optionally generates a human-readable reasoning summary,
- stores the final response,
- broadcasts completion or failure.

This route is the closest thing to the central “agent brain” entry point.

### Why it is written this way

The route needs to keep the core response path deterministic. That is why reasoning summaries are currently disabled in production when they interfere with connectivity or stability. The system should still return a valid agent response even if a secondary summary step fails.

## 6. Builder-Aware Property Refinement

The builder refiner route is `app/api/agent/builder-refiner/route.ts`.

Its job is to re-rank property matches using builder knowledge from the KB, not from memory or hardcoded assumptions.

The flow is:

1. Accept property matches and client profile input.
2. Collect all unique builders from the properties and client preferences.
3. Query builder data from the knowledge base through `lib/builderKBService.ts`.
4. Build a prompt that combines the matches, client constraints, and KB builder facts.
5. Ask OpenAI to produce a refined ranking.
6. Save the run trace and emit real-time events.
7. Return refined matches plus metadata.

### What builder knowledge is used

The KB data currently includes:

- builder reputation score,
- payment plans,
- delivery timelines,
- financing options,
- service locations.

### Why this matters

This is the part of the system that answers the user’s question about who is responsible for connecting property and client matching with builder knowledge.

The responsibility belongs to the **Builder Property Refiner** agent. It takes the raw property match list and adjusts the ranking using builder KB information so the result is not just financially plausible but also builder-aware.

## 7. Automation Layer: Cron Jobs and Sync Jobs

The automation layer is where background work happens without a user sitting on the screen.

### Follow-up cron

`app/api/cron/follow-up/route.ts` scans for leads that are due for follow-up.

It:

- checks authorization through `CRON_SECRET`,
- loads leads and calls collections,
- starts a run for the Follow-Up Agent,
- logs the scan and each lead evaluation,
- triggers outbound Vapi calls for eligible leads,
- stores call records,
- updates lead state to avoid repeat calls,
- completes the run with a summary of how many calls were triggered.

This automation is important because it turns lead state into action. A lead that becomes due for follow-up is not just marked in the database; it can immediately trigger a call.

### Call sync

`app/api/calls/sync/route.ts` is the post-call reconciliation route.

It:

- fetches active or pending call records,
- pulls the latest Vapi call state,
- extracts transcript and recording data,
- runs transcript analysis when needed,
- updates the call record with disposition and summary,
- updates the related lead with the new state,
- calls the call state validator to catch inconsistencies,
- stores validator results on the call.

This is the bridge between voice execution and CRM state. It ensures the call transcript, lead state, and dashboard data stay aligned.

## 8. Agent Registry and Roles

`lib/agentRegistry.ts` is the central definition of the agent lineup.

It holds the system prompts, roles, and models for each agent. The registry is what keeps the system from turning into scattered one-off prompts.

The important agents in the current flow are:

- **Voice Conversation Orchestrator** for live call coordination,
- **Lead Qualification & Objection Agent** for preference capture and objection handling,
- **Post-Call Sync Agent** for transcript extraction and lead updates,
- **Property Re-engagement Agent** for matching and re-engagement logic,
- **Call State Validator** for consistency checking,
- **Builder Property Refiner** for builder-aware ranking.

The registry is also where the builder refiner prompt explicitly says the builder information must come from the KB.

## 9. Real-Time Monitoring Surface

`app/api/agent/ws/route.ts` provides the live event stream.

Despite the filename, the implementation currently uses server-sent events for browser compatibility.

That endpoint allows a client to subscribe by:

- `run_id`, or
- `agent_id`.

It sends:

- a connected message,
- the live event payloads,
- heartbeat messages to keep the connection alive.

This is how the monitoring panel can show:

- when a run starts,
- what the agent is thinking,
- what actions it takes,
- when it completes,
- when it fails.

## 10. What Has Been Built So Far

### Completed

- execution logging through MongoDB is in place,
- real-time event broadcasting is in place,
- live monitoring via SSE is in place,
- the main agent route broadcasts trace events,
- the builder refiner now uses KB-driven builder data,
- the follow-up automation logs its execution path,
- the call sync route updates call and lead records,
- the agent registry contains the builder refiner and validation agents,
- production deployment was pushed after the SSL-related stability work.

### Working but temporarily constrained

- reasoning summary generation exists, but is currently disabled in production because it was contributing to SSL-related failures during live execution.

### Still being expanded

- richer live monitoring in the dashboard,
- more visibility into cron job decision paths,
- better surfaced reasoning summaries after the SSL issue is resolved,
- tighter archive integration for summaries and trace metadata.

## 11. The SSL Problem and Why It Was Temporary Disabled

A production issue surfaced when internal route calls were made through the external domain and Node.js attempted to validate the SSL layer in a way that failed with `ERR_SSL_WRONG_VERSION_NUMBER`.

The important detail is that this was not the primary agent logic failing. It was a transport problem affecting internal requests and a secondary summary step.

To protect the system, the reasoning summary feature was disabled while the main execution and event streaming paths continued to work.

That decision preserves the important behavior:

- the user still gets the agent response,
- the monitoring stream still works,
- the run is still recorded,
- the system can be stabilized before re-enabling the summary generator.

## 12. Current Operational Status

### In production and stable

- agent execution logging,
- real-time event broadcasting,
- builder KB querying,
- agent registry prompts,
- follow-up cron execution,
- call sync analysis,
- call state validation integration.

### Under active refinement

- reasoning summary generation,
- additional live dashboard visibility,
- more explicit automation trace views,
- follow-up and call sync event broadcasting completeness.

## 13. Recommended Next Work

1. Re-enable reasoning summaries after the OpenAI transport issue is fully understood and verified in production.
2. Add event broadcasting to the remaining cron and sync paths where visibility is still partial.
3. Surface the run details more directly in the dashboard so clicking an agent shows what it is thinking, doing, and saving.
4. Add archive support for summaries and reasoning metadata so completed runs can be reviewed later.
5. Keep the builder refiner aligned with KB-only builder facts so ranking logic stays explainable.

## 14. How To Read This System Later

When you look at any new agent or automation, ask four questions:

- What run starts it?
- What gets logged as reasoning?
- What events are broadcast live?
- What is stored for later audit?

If those four pieces are present, the behavior is traceable. If one is missing, the gap will usually show up either in the dashboard or in the run history.

## 15. Short Version

The system is designed so that every agent and automation is both:

- **explainable** through execution logs and reasoning steps,
- **observable** through live event broadcasting,
- **recoverable** through final stored run data.

That is the working model behind the agents, the cron AI jobs, and the automation flows today.
