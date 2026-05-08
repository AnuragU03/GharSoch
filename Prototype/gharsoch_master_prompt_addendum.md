# Addendum to `gharsoch_master_prompt.md`

> Apply this addendum on top of the existing master prompt.
> 1. **Replace** the entire `## 14. UI Redesign — Admin View vs Broker View` section with **Section 14 (replacement)** below.
> 2. **Append** the new **Section 17 — HTML → TSX Conversion Guide** after Section 16.
> 3. The "First Action" instruction in Section 16 still applies.

---

## 14. UI Redesign — Build To The Prototype  *(replacement)*

The current UI is stale. Rebuild the entire UI to match the HTML prototype shipped alongside this prompt: **`gharsoch_admin_prototype.html`**. Treat the prototype as the **visual contract** — colors, spacing, type, interactions, components, and behaviour all come from it.

> **Role-based gating is NOT a UI concern at this stage.** Build the full admin UI (every section, every button). Admin / tech / broker visibility will be wrapped at the auth layer later (Section 17.6). Do not build a "View as Broker" toggle. Do not gate routes prematurely.

### 14.1 Pages to build (one per nav item in the prototype)

| Section | Route | Source file (TSX) |
|---------|-------|-------------------|
| Dashboard | `/` | `app/sections/DashboardSection.tsx` |
| Leads Pipeline | `/leads` | `app/sections/LeadPipelineSection.tsx` |
| Clients | `/clients` | `app/sections/ClientsSection.tsx` |
| Properties | `/properties` | `app/sections/PropertiesSection.tsx` |
| Campaigns | `/campaigns` | `app/sections/CampaignsSection.tsx` |
| Appointments | `/appointments` | `app/sections/AppointmentsSection.tsx` |
| Call Logs | `/calls` | `app/sections/CallLogsSection.tsx` |
| AI Operations | `/ai-operations` | `app/sections/AIOperationsSection.tsx` |
| Agent Activity | `/agent-activity` | `app/sections/AgentActivitySection.tsx` |
| Knowledge Base | `/kb` | `app/sections/KnowledgeBaseSection.tsx` |
| Analytics | `/analytics` | `app/sections/AnalyticsSection.tsx` |
| Settings | `/settings` | `app/sections/SettingsSection.tsx` |

### 14.2 Visual contract (locked)

- Warm cream palette — see CSS variables in the prototype `:root`. Map them 1:1 into `tailwind.config.ts` and `app/globals.css` (Section 17.2).
- Single accent `#0066cc`. Single warm `#c2410c` for highlights. Never introduce a third accent.
- Hairline dividers `rgba(80,60,30,0.10)`. Never thick borders.
- Border radii: 8 / 12 / 16 / 20. One per element class, used consistently.
- Typography: `-apple-system, "SF Pro Display", "Inter"`. Sizes: 11 (label) · 12.5 (meta) · 13.5 (body) · 14.5 (card title) · 17 (modal) · 27 (page title). Weights: 400, 500, 600.
- Animations: 0.15–0.30 s cubic-bezier easing only. No bounce, no spring.
- Every interactive element gets a hover state, an active scale-down, and a focus ring `0 0 0 3px var(--accent-soft)`.

### 14.3 Components to build (one per recurring pattern in the prototype)

| Component | Purpose | shadcn primitives to compose |
|-----------|---------|------------------------------|
| `Sidebar` | Grouped nav (Work / Intelligence), mini footer icons, user pill | none — custom |
| `PageHeader` | crumb · title · sub · actions | none |
| `StatStrip` | 6-cell horizontal stats row | none |
| `Tabs` | underline tabs | shadcn `Tabs` |
| `AgentCard` | agent w/ counters, live dot, expanded matches | `Card`, `Badge`, custom |
| `Pill` | success/failed/running/idle/warm/violet/amber | `Badge` |
| `LivePulse` | pulsing green dot | custom |
| `KanbanColumn` + `LeadCard` | leads pipeline | `dnd-kit` later |
| `PropertyCard` | image + meta + price | `Card` |
| `CampaignRow` | progress + counters | `Progress` |
| `AppointmentRow` | time chip + meta + status | custom |
| `CallRow` | direction icon + transcript link | custom |
| `KBBuilderCard` | builder + reputation bar | `Card`, `Progress` |
| `AnalyticsLineChart` | SVG line chart | `recharts` (already installed) |
| `RunDetailDrawer` | side drawer with reasoning trace | `Sheet` |
| `EntityModal` | new client / property / campaign forms | `Dialog`, `Form`, `Input`, `Select` |
| `CommandPalette` | ⌘K palette | `cmdk` / shadcn `Command` |
| `Toast` | bottom toast | shadcn `Sonner` |

### 14.4 Definition of "professional" (the UI is not done if any of these is true)

- Any card shows a number with no way to drill into what produced it.
- Live Activity Log only shows one agent.
- Settings page contains anything unrelated to runtime behavior.
- The screen looks like a Tailwind starter template (rounded-xl + shadow-md + gray cards).
- An admin cannot answer "what did Matchmaker just match and why" in one click.
- Any visual deviates from the prototype's color, spacing, or radius scale without explicit reason.

---

## 17. HTML → TSX Conversion Guide  *(new section, append after Section 16)*

This section is the deterministic recipe for converting `gharsoch_admin_prototype.html` into production Next.js 14 App Router TSX. Follow the steps in order. Do not freelance.

### 17.1 Prerequisites (verify before converting)

- Next.js 14 App Router, TypeScript strict.
- Tailwind CSS configured.
- shadcn/ui installed (`npx shadcn-ui@latest init`).
- Already-installed deps confirmed in `package.json`: `recharts`, `cmdk`, `lucide-react`, `date-fns`, `swr` (or `@tanstack/react-query`).
- Run once: `npx shadcn-ui@latest add button card badge sheet dialog tabs input select textarea form sonner progress command tooltip`.

### 17.2 Step 1 — Move the design tokens to Tailwind

Copy every CSS variable from the prototype `:root` into `app/globals.css`. Then expose them in `tailwind.config.ts`:

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:        'hsl(var(--bg))',
        'bg-deep': 'hsl(var(--bg-deep))',
        surface:   'hsl(var(--surface))',
        'surface-2': 'hsl(var(--surface-2))',
        'surface-3': 'hsl(var(--surface-3))',
        ink:       'hsl(var(--ink))',
        'ink-2':   'hsl(var(--ink-2))',
        'ink-3':   'hsl(var(--ink-3))',
        'ink-4':   'hsl(var(--ink-4))',
        accent:    'hsl(var(--accent))',
        'accent-soft': 'hsl(var(--accent-soft) / <alpha-value>)',
        warm:      'hsl(var(--warm))',
        'warm-soft': 'hsl(var(--warm-soft) / <alpha-value>)',
        green:     'hsl(var(--green))',
        amber:     'hsl(var(--amber))',
        red:       'hsl(var(--red))',
        violet:    'hsl(var(--violet))',
      },
      borderColor: {
        hairline:        'hsl(var(--hairline))',
        'hairline-strong': 'hsl(var(--hairline-strong))',
      },
      borderRadius: { sm: '8px', md: '12px', lg: '16px', xl: '20px' },
      boxShadow: {
        'elev-1': '0 1px 2px rgba(60,40,10,0.04), 0 8px 24px rgba(60,40,10,0.05)',
        'elev-2': '0 1px 2px rgba(60,40,10,0.06), 0 16px 40px rgba(60,40,10,0.10)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'Inter', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
};
export default config;
```

Convert the variables to HSL (or keep as raw hex/rgba and skip the `hsl()` wrapping — pick one and stay consistent). The prototype uses raw hex/rgba; if that's easier, mirror it exactly.

Add a single global selection rule + smooth scroll to `app/globals.css`:

```css
::selection { background: hsl(var(--accent-soft)); }
html { scroll-behavior: smooth; }
body { background: hsl(var(--bg)); color: hsl(var(--ink)); -webkit-font-smoothing: antialiased; }
```

### 17.3 Step 2 — File-by-file conversion table

| Prototype HTML | Production TSX file | Notes |
|----------------|---------------------|-------|
| `<aside class="sidebar">` | `components/Sidebar.tsx` | Next.js `<Link>`, `usePathname()` for active state |
| `<section id="page-dashboard">` | `app/sections/DashboardSection.tsx` | Server component; data via `lib/dashboardService.ts` |
| `<section id="page-leads">` | `app/sections/LeadPipelineSection.tsx` | Client; later add `dnd-kit` for drag |
| `<section id="page-clients">` | `app/sections/ClientsSection.tsx` | Server; conversion-status badges |
| `<section id="page-properties">` | `app/sections/PropertiesSection.tsx` | Server; PropertyCard component |
| `<section id="page-campaigns">` | `app/sections/CampaignsSection.tsx` | Client; SSE progress via `useRealtimeAgentMonitoring` |
| `<section id="page-appointments">` | `app/sections/AppointmentsSection.tsx` | Server |
| `<section id="page-calls">` | `app/sections/CallLogsSection.tsx` | Server; transcript drawer client-side |
| `<section id="page-ops">` | `app/sections/AIOperationsSection.tsx` | Client; SSE-bound |
| `<section id="page-activity">` | `app/sections/AgentActivitySection.tsx` | Client; SSE-bound |
| `<section id="page-kb">` | `app/sections/KnowledgeBaseSection.tsx` | Server |
| `<section id="page-analytics">` | `app/sections/AnalyticsSection.tsx` | Server; recharts |
| `<section id="page-settings">` | `app/sections/SettingsSection.tsx` | Server actions for toggles |
| `<aside id="drawer">` | `components/RunDetailDrawer.tsx` | shadcn `Sheet`, `side="right"`, width 560 |
| `<div class="modal" id="modal-new-client">` | `components/modals/NewClientModal.tsx` | shadcn `Dialog` + `Form` + zod |
| `<div class="modal" id="modal-new-property">` | `components/modals/NewPropertyModal.tsx` | same pattern |
| `<div class="modal" id="modal-new-campaign">` | `components/modals/NewCampaignModal.tsx` | same pattern |
| `<div class="cmd-overlay">` | `components/CommandPalette.tsx` | shadcn `Command` (cmdk) inside `CommandDialog` |
| `<div class="toast">` | shadcn `Sonner` provider in root layout | replace `toast()` JS with `toast.success(...)` |

### 17.4 Step 3 — Routing & layout

The prototype uses JS `switchPage()` against `display:none` blocks. In production use Next.js App Router routes:

```
app/
  layout.tsx                  // <html><body>{children}</body></html> + ClientProviders
  (admin)/                    // route group
    layout.tsx                // Sidebar + main shell
    page.tsx                  // Dashboard
    leads/page.tsx
    clients/page.tsx
    properties/page.tsx
    campaigns/page.tsx
    appointments/page.tsx
    calls/page.tsx
    ai-operations/page.tsx
    agent-activity/page.tsx
    kb/page.tsx
    analytics/page.tsx
    settings/page.tsx
```

Each `page.tsx` is a one-line server component that imports the corresponding section:

```tsx
// app/(admin)/leads/page.tsx
import { LeadPipelineSection } from '@/app/sections/LeadPipelineSection';
export default function Page() { return <LeadPipelineSection />; }
```

`app/(admin)/layout.tsx` is the only place that renders `<Sidebar>` and `<main>` — sections render only their own content (no shell).

### 17.5 Step 4 — Data fetching pattern (do not deviate)

| Concern | Pattern |
|---------|---------|
| Read static-ish data (leads list, properties, campaigns, KB) | Server component using `lib/<service>.ts` directly. No client fetch. |
| Read live data (agent activity, in-flight campaign, in-call orchestrator) | Client component using `useRealtimeAgentMonitoring` (SSE) on top of an initial server payload. |
| Write data (create client, add property, force-run agent) | Server action in `app/actions/<entity>.ts`. Form uses `useFormState` + `useFormStatus`. |
| Mutation that triggers an agent run | Server action calls the in-process agent runner from Section 4 — never `fetch('/api/...')` from server code. |
| Listing with optimistic updates | `@tanstack/react-query` with mutation `onMutate` rollback, hydrated from server props via `dehydrate/Hydrate`. |

Every server action that triggers an agent must invalidate the relevant query keys: `['agent-runs']`, `['leads']`, `['campaigns']`, etc.

### 17.6 Step 5 — Auth gating (apply at the END, not during build)

After the UI is fully built per the prototype, wrap visibility at the auth layer **only** — never hide nav items inside the section components themselves.

Add `lib/auth/roles.ts`:

```ts
export type Role = 'admin' | 'tech' | 'broker';

export const VISIBILITY: Record<Role, { nav: string[]; canForceRun: boolean; canViewReasoning: boolean; canViewCosts: boolean }> = {
  admin:  { nav: ALL_NAV,                        canForceRun: true,  canViewReasoning: true,  canViewCosts: true  },
  tech:   { nav: ALL_NAV,                        canForceRun: true,  canViewReasoning: true,  canViewCosts: true  },
  broker: { nav: BROKER_NAV /* no AI Ops, etc */, canForceRun: false, canViewReasoning: false, canViewCosts: false },
};
```

Then:
- `Sidebar` filters `nav` items by `VISIBILITY[role].nav`.
- `(admin)/layout.tsx` calls `getServerSession()` and redirects brokers away from `/ai-operations`, `/agent-activity`.
- `RunDetailDrawer` checks `canViewReasoning` — for brokers it shows a 1-line summary instead of the full trace.
- "Force run" buttons render conditionally on `canForceRun`.

This is the **only** place role logic lives. Do not sprinkle `if (role === ...)` into section components.

### 17.7 Step 6 — Component conversion patterns

#### Sidebar (active state from URL, not local state)

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const WORK = [
  { href: '/',             label: 'Dashboard',      icon: '▦' },
  { href: '/leads',        label: 'Leads Pipeline', icon: '⌗', badge: 52 },
  { href: '/clients',      label: 'Clients',        icon: '○', badge: 14 },
  { href: '/properties',   label: 'Properties',     icon: '⌂' },
  { href: '/campaigns',    label: 'Campaigns',      icon: '▷' },
  { href: '/appointments', label: 'Appointments',   icon: '◷', badge: 4 },
  { href: '/calls',        label: 'Call Logs',      icon: '≡' },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 h-screen w-60 border-r border-hairline bg-surface p-3">
      {/* brand */}
      {/* groups */}
      <NavGroup label="Work" items={WORK} active={path} />
      {/* ... */}
    </aside>
  );
}
```

#### AgentCard (data in, expand state local)

```tsx
'use client';
import { useState } from 'react';
import type { AgentRun } from '@/types';

export function AgentCard({ agent, lastRun, matches }: { agent: Agent; lastRun: AgentRun; matches?: Match[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      onClick={(e) => { if ((e.target as HTMLElement).closest('.match-row,.vapi-link')) return; setExpanded(v => !v); }}
      className={cn(
        'rounded-lg border border-hairline bg-surface p-[18px] cursor-pointer transition-colors',
        'hover:border-hairline-strong hover:shadow-elev-1',
        expanded && 'border-accent shadow-[0_0_0_3px_hsl(var(--accent-soft))]'
      )}
    >
      {/* head, counters, row */}
      {expanded && <ExpandedMatches matches={matches} />}
    </div>
  );
}
```

#### RunDetailDrawer (shadcn Sheet)

```tsx
'use client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
export function RunDetailDrawer({ open, onClose, run }: Props) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[560px] sm:max-w-[92vw] overflow-y-auto">
        <SheetHeader><SheetTitle>{run.title}</SheetTitle></SheetHeader>
        {/* sections: input, reasoning steps, actions, summary, transcript */}
      </SheetContent>
    </Sheet>
  );
}
```

#### CommandPalette (cmdk)

```tsx
'use client';
import { CommandDialog, CommandInput, CommandList, CommandItem, CommandGroup } from '@/components/ui/command';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(o => !o); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => { router.push('/ai-operations'); setOpen(false); }}>Open · AI Operations</CommandItem>
          {/* ... */}
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => forceRun('matchmaker')}>⚡ Force run · Matchmaker</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

#### EntityModal (Dialog + Form + zod)

```tsx
'use client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/app/actions/client';

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().regex(/^\+91\s?\d{5}\s?\d{5}$/),
  email: z.string().email().optional(),
  budget_range: z.string(),
  location_pref: z.string(),
  property_type: z.enum(['1BHK','2BHK','3BHK','4BHK','Villa']),
});
type Values = z.infer<typeof schema>;

export function NewClientModal({ open, onClose }: Props) {
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const onSubmit = async (v: Values) => { await createClient(v); onClose(); toast.success('Client created · Converter agent dispatched'); };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-xl bg-surface">
        <DialogHeader><DialogTitle>New client</DialogTitle></DialogHeader>
        {/* fields */}
        <DialogFooter>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={form.handleSubmit(onSubmit)}>Create &amp; dispatch</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 17.8 Step 7 — Pull data into each section (no mock data)

For every section, replace the prototype's hard-coded values with real Mongo queries. Map per the table below:

| Section | Data sources |
|---------|--------------|
| Dashboard | `dashboardService.getKpis()`, `agentLogger.getRecentRuns(8)`, `appointmentService.getToday()` |
| Leads Pipeline | `leadService.listByStage()` |
| Clients | `clientService.list({ withConversion: true })` |
| Properties | `propertyService.list({ status: ['available','negotiation','sold'] })` |
| Campaigns | `campaignService.listActive()`, SSE `agent:campaign_conductor` |
| Appointments | `appointmentService.range({ from: today, to: today+7d })` |
| Call Logs | `callService.list({ limit: 50, withTranscript: false })` |
| AI Operations | `agentLogger.getAgentSummaries()`, SSE `agent_event` |
| Agent Activity | `agentLogger.streamRuns()` via SSE |
| Knowledge Base | `builderKBService.listAll()`, query stats from `agent_execution_logs` |
| Analytics | `analyticsService.funnel(7d)`, `analyticsService.callsPerAgent(7d)` |
| Settings | `systemConfigService.getAll()` + server actions to flip toggles |

Every server component awaits these in parallel with `Promise.all`. Loading goes through `app/loading.tsx` plus per-section Suspense boundaries.

### 17.9 Step 8 — Acceptance gates for the UI conversion

**Gate UI-1**: Storybook (or a `/ui-kit` route) renders every component in isolation with no props errors.
**Gate UI-2**: Lighthouse on each page: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95.
**Gate UI-3**: A11y: every interactive element has a focus ring, every modal traps focus, every drawer is closeable with `Escape`.
**Gate UI-4**: Keyboard: `⌘K` opens palette; `↑↓` navigates; `Esc` closes any overlay.
**Gate UI-5**: Visual diff vs prototype (Percy / Chromatic): zero unexpected pixel deltas on Dashboard, AI Operations, Leads Pipeline.
**Gate UI-6**: Auth: brokers logging in cannot reach `/ai-operations` or `/agent-activity` (server redirect, not just hidden links).
**Gate UI-7**: Server actions wired — submitting `NewClientModal` actually creates a `clients` row and you see the corresponding `agent_execution_logs` row from the Converter agent within 5 s.

### 17.10 Hard rules during the conversion

- Do **not** copy the inline `<style>` block from the prototype — port it to Tailwind classes / `globals.css` only.
- Do **not** keep the prototype's JS routing (`switchPage`, `display:none`). Use Next.js routes.
- Do **not** use any `<a>` tag where Next.js `<Link>` belongs.
- Do **not** introduce a UI library outside shadcn/Tailwind/recharts/cmdk/sonner.
- Do **not** add icons via Unicode glyphs in production code — replace each with `lucide-react` icons. The prototype uses glyphs only because it is a static demo.
- Do **not** keep the prototype's mock numbers in production. Empty state is fine; fake data is not.
- Do **not** ship a section without its corresponding loading state and error boundary.

### 17.11 Done criterion for the UI

The UI conversion is done when:
1. Visiting any URL listed in 14.1 renders the same layout, color, spacing, and behaviour as the prototype.
2. All seven UI gates above pass.
3. Real Mongo data flows in — no hard-coded values left.
4. Brokers, tech and admin see the correct subset of nav and content per `VISIBILITY` (Section 17.6).
5. The whole admin app feels like one product, not twelve loose pages.

— End of addendum —
