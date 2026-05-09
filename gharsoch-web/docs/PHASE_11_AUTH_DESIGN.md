# Phase 11 — Authentication & Role Gating Design

> **Status**: Design review — do NOT implement until approved.
> **Author**: Opus design pass
> **Implements**: Master Prompt §3, §17.6, Addendum §14 (replacement)

---

## Deliverable 1 — Data Model Design

### models/User.ts

```ts
import { ObjectId } from 'mongodb'

export type UserRole = 'admin' | 'tech' | 'broker'
export type UserStatus = 'pending_approval' | 'active' | 'suspended'

export interface User {
  _id?: ObjectId
  email: string
  name: string
  image?: string | null
  role: UserRole
  status: UserStatus
  brokerage_id?: ObjectId | null     // null for admin/tech, required for broker
  created_at: Date
  last_login_at: Date
  promoted_by_user_id?: ObjectId | null
  promoted_at?: Date | null
}

export const HARDCODED_ADMIN_EMAIL = 'anurag.ugargol@gmail.com'
```

### models/Brokerage.ts

```ts
import { ObjectId } from 'mongodb'

export interface Brokerage {
  _id?: ObjectId
  name: string
  city: string
  vapi_assistant_id: string          // one of the 3 env assistant IDs
  primary_admin_email: string        // the broker who "owns" this brokerage
  created_at: Date
  notes?: string
}
```

### models/Session.ts (NextAuth-managed)

NextAuth JWT strategy means no `sessions` collection in Mongo. The JWT contains:

```ts
// Encoded in the JWT token (not persisted to DB)
interface JWTPayload {
  sub: string           // user._id as string
  email: string
  name: string
  image?: string
  role: UserRole
  status: UserStatus
  brokerage_id?: string // ObjectId as string, or null
  iat: number
  exp: number
}
```

### Mongo Indexes (Cosmos RU friendly — single-field only)

```js
// scripts/create_auth_indexes.js
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ status: 1 })
db.users.createIndex({ role: 1 })
db.users.createIndex({ brokerage_id: 1 })
db.brokerages.createIndex({ name: 1 })
```

---

## Deliverable 2 — NextAuth Configuration Design

### Session Strategy: JWT

**Justification**: JWT avoids a `sessions` collection entirely — zero extra RU cost on Cosmos per request. Session data (role, status, brokerage_id) is encoded in the token. Trade-off: revocation requires a check against the `users` collection on each request (handled in the `jwt` callback with a periodic revalidation window).

### File: `lib/auth.ts` (replaces current jose-based auth)

**Dependencies to install**: `next-auth@^4.24` + `@auth/mongodb-adapter@^2`

The adapter is used ONLY for the `users` collection write-on-first-login. We do NOT use it for sessions (JWT strategy).

```ts
import NextAuth, { type NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { MongoDBAdapter } from '@auth/mongodb-adapter'
import clientPromise from '@/lib/mongodb'
import { getCollection } from '@/lib/mongodb'
import { HARDCODED_ADMIN_EMAIL } from '@/models/User'
import type { UserRole, UserStatus } from '@/models/User'

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise, { databaseName: 'test' }),

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 }, // 24h

  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },

  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false
      const users = await getCollection('users')
      const existing = await users.findOne({ email: user.email })

      if (!existing) {
        // First-time signup
        const isHardcodedAdmin = user.email === HARDCODED_ADMIN_EMAIL
        await users.insertOne({
          email: user.email,
          name: user.name || '',
          image: user.image || null,
          role: isHardcodedAdmin ? 'admin' : 'broker' as UserRole,
          status: isHardcodedAdmin ? 'active' : 'pending_approval' as UserStatus,
          brokerage_id: null,
          created_at: new Date(),
          last_login_at: new Date(),
          promoted_by_user_id: null,
          promoted_at: null,
        })
      } else {
        // Existing user — update last_login + image
        if (existing.status === 'suspended') return false
        await users.updateOne(
          { email: user.email },
          { $set: { last_login_at: new Date(), image: user.image || existing.image } }
        )
      }
      return true
    },

    async jwt({ token, user, trigger }) {
      // On initial sign-in or token refresh, load role/status from DB
      if (user?.email || trigger === 'update') {
        const users = await getCollection('users')
        const dbUser = await users.findOne({ email: token.email })
        if (dbUser) {
          token.role = dbUser.role
          token.status = dbUser.status
          token.brokerage_id = dbUser.brokerage_id?.toString() || null
          token.dbId = dbUser._id.toString()
        }
      }
      return token
    },

    async session({ session, token }) {
      session.user.id = token.dbId as string
      session.user.role = token.role as UserRole
      session.user.status = token.status as UserStatus
      session.user.brokerage_id = (token.brokerage_id as string) || null
      return session
    },

    async redirect({ url, baseUrl }) {
      // After sign-in, redirect based on role (handled by middleware instead)
      if (url.startsWith(baseUrl)) return url
      return baseUrl
    },
  },
}

// Route handler
const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

### API Route: `app/api/auth/[...nextauth]/route.ts`

```ts
export { GET, POST } from '@/lib/auth'
```

### Edge Case: Mongo Unreachable During Admin First Login

If Cosmos is unreachable during Anurag's first login, the `signIn` callback throws, NextAuth returns `false`, and the user sees `/auth/signin?error=DatabaseError`. The app never auto-promotes without a successful DB write. Safe failure mode.

### Edge Case: Google OAuth Callback Fails Mid-Flow

NextAuth handles this natively — redirects to `/auth/signin?error=OAuthCallback`. No partial user state is created because our `signIn` callback hasn't executed yet.

---

## Deliverable 3 — Middleware Design

### File: `middleware.ts` (Next.js root)

```ts
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // 1. No token = unauthenticated (withAuth already redirects to signIn)
    if (!token) return NextResponse.redirect(new URL('/auth/signin', req.url))

    // 2. Suspended → force to signin with error
    if (token.status === 'suspended') {
      return NextResponse.redirect(new URL('/auth/signin?error=AccountSuspended', req.url))
    }

    // 3. Pending approval → force to /welcome
    if (token.status === 'pending_approval' && pathname !== '/welcome') {
      return NextResponse.redirect(new URL('/welcome', req.url))
    }

    // 4. Role-based route gating
    const role = token.role as string

    if (role === 'broker' && ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r))) {
      return NextResponse.redirect(new URL('/leads', req.url))
    }

    if (role === 'tech' && pathname.startsWith('/settings/users')) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: '/auth/signin' },
  }
)

const ADMIN_ONLY_ROUTES = ['/ai-operations', '/agent-activity', '/settings/users']

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - /api/auth/*      (NextAuth endpoints)
     * - /api/cron/*      (secured by x-cron-secret)
     * - /api/vapi/*      (secured by Vapi signature in Phase 12)
     * - /auth/*          (signin/signup pages)
     * - /_next/*         (Next.js internals)
     * - /favicon.ico, /robots.txt, etc.
     */
    '/((?!api/auth|api/cron|api/vapi|auth|_next|favicon.ico|robots.txt).*)',
  ],
}
```

### Route → Role Access Matrix

| Route | admin | tech | broker | pending |
|-------|-------|------|--------|---------|
| `/` (Dashboard) | ✅ | ✅ | ✅ | ❌→/welcome |
| `/leads` | ✅ | ✅ | ✅ | ❌ |
| `/clients` | ✅ | ✅ | ✅ | ❌ |
| `/properties` | ✅ | ✅ | ✅ | ❌ |
| `/campaigns` | ✅ | ✅ | ✅ | ❌ |
| `/appointments` | ✅ | ✅ | ✅ | ❌ |
| `/calls` | ✅ | ✅ | ✅ | ❌ |
| `/ai-operations` | ✅ | ✅ | ❌→/leads | ❌ |
| `/agent-activity` | ✅ | ✅ | ❌→/leads | ❌ |
| `/kb` | ✅ | ✅ | ✅ | ❌ |
| `/analytics` | ✅ | ✅ | ✅ | ❌ |
| `/settings` | ✅ | ✅ | ✅ | ❌ |
| `/settings/users` | ✅ | ❌→/ | ❌→/leads | ❌ |
| `/welcome` | N/A | N/A | N/A | ✅ |

### Default Landing After Login

| Role | Landing |
|------|---------|
| admin | `/` |
| tech | `/agent-activity` |
| broker | `/leads` |
| pending_approval | `/welcome` |

---

## Deliverable 4 — Visibility Map

### File: `lib/auth/roles.ts`

```ts
export type Role = 'admin' | 'tech' | 'broker'

const ALL_NAV = [
  '/', '/leads', '/clients', '/properties', '/campaigns',
  '/appointments', '/calls', '/ai-operations', '/agent-activity',
  '/kb', '/analytics', '/settings',
]

const BROKER_NAV = [
  '/', '/leads', '/clients', '/properties', '/campaigns',
  '/appointments', '/calls', '/kb', '/analytics', '/settings',
]
// Broker CANNOT see: /ai-operations, /agent-activity

export const VISIBILITY: Record<Role, {
  nav: string[]
  canForceRun: boolean
  canViewReasoning: boolean
  canViewCosts: boolean
  canManageUsers: boolean
  canManageSettings: boolean
}> = {
  admin: {
    nav: ALL_NAV,
    canForceRun: true,
    canViewReasoning: true,
    canViewCosts: true,
    canManageUsers: true,
    canManageSettings: true,
  },
  tech: {
    nav: ALL_NAV,
    canForceRun: true,
    canViewReasoning: true,
    canViewCosts: true,
    canManageUsers: false,
    canManageSettings: true,
  },
  broker: {
    nav: BROKER_NAV,
    canForceRun: false,
    canViewReasoning: false,
    canViewCosts: false,
    canManageUsers: false,
    canManageSettings: false,
  },
}

export function getDefaultLanding(role: Role): string {
  switch (role) {
    case 'admin': return '/'
    case 'tech': return '/agent-activity'
    case 'broker': return '/leads'
  }
}
```

---

## Deliverable 5 — Sidebar Role-Aware Rendering

### Current Architecture (from Task 2.5)

```
Sidebar.tsx (Server Component) → fetches counts → passes to SidebarClient.tsx (Client Component)
```

### Proposed Change

```
Sidebar.tsx (Server Component) → fetches counts + session → passes both to SidebarClient
```

```ts
// components/Sidebar.tsx (updated)
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSidebarCounts } from '@/lib/services/sidebarCountsService'
import { SidebarClient } from './SidebarClient'
import { VISIBILITY } from '@/lib/auth/roles'
import type { Role } from '@/lib/auth/roles'

export async function Sidebar() {
  const [session, counts] = await Promise.all([
    getServerSession(authOptions),
    getSidebarCounts(),
  ])

  const role = (session?.user?.role || 'broker') as Role
  const allowedNav = VISIBILITY[role].nav
  const user = session?.user || { name: 'User', email: '', image: null, role: 'broker' }

  return <SidebarClient counts={counts} allowedNav={allowedNav} user={user} />
}
```

### SidebarClient Changes

- Accept `allowedNav: string[]` prop
- Filter `WORK` and `INTELLIGENCE` arrays: `items.filter(item => allowedNav.includes(item.href))`
- Accept `user: { name, email, image, role }` prop
- User pill at bottom: render Google avatar via `<img>` if `user.image` exists, else initials
- Add dropdown menu (shadcn `DropdownMenu`) on user pill click:
  - "Account settings" (stub, toast "Coming in Phase 12")
  - Divider
  - "Sign out" → calls `signOut()` from `next-auth/react`

---

## Deliverable 6 — /welcome Page (Pending Approval)

### Route: `app/welcome/page.tsx`

This route is OUTSIDE the `(admin)` group — no sidebar, no shell.

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { WelcomeContent } from './WelcomeContent'

export default async function WelcomePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')
  if (session.user.status === 'active') redirect('/')

  return <WelcomeContent user={session.user} />
}
```

### Client Component: `app/welcome/WelcomeContent.tsx`

```tsx
'use client'
import { signOut } from 'next-auth/react'

export function WelcomeContent({ user }: { user: { name: string; email: string; image?: string } }) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="bg-surface rounded-xl border border-hairline shadow-elev-1 p-10 max-w-md text-center">
        {user.image && <img src={user.image} alt="" className="w-16 h-16 rounded-full mx-auto mb-4" />}
        <h1 className="text-xl font-semibold text-ink mb-1">Welcome, {user.name}</h1>
        <p className="text-sm text-ink-2 mb-1">{user.email}</p>
        <div className="bg-amber/10 text-amber rounded-md px-4 py-3 mt-6 text-sm">
          Your account is pending admin approval.
        </div>
        <p className="text-xs text-ink-3 mt-4">
          An admin reviews new requests within 24 hours.
          <br />
          Questions? <a href="mailto:anurag.ugargol@gmail.com" className="text-accent underline">Contact admin</a>
        </p>
        <button onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="btn ghost mt-6 text-sm">
          Sign out
        </button>
      </div>
    </div>
  )
}
```
# Phase 11 — Auth Design (Part 2: Deliverables 7–12)

---

## Deliverable 7 — Admin User Management UI at /settings/users

### Route: `app/(admin)/settings/users/page.tsx`

Only accessible to `role='admin'` (enforced by middleware + server-side guard).

### Component: `app/sections/UserManagementSection.tsx`

**Layout**: Three tabs using shadcn `Tabs`:
1. **Pending Approval** — users with `status='pending_approval'`
2. **Active Users** — users with `status='active'`
3. **Suspended** — users with `status='suspended'`

#### Pending Tab — Each Row

```
[Google Avatar] [Name] [Email] [Signup Date]
  [Promote to Broker] [Promote to Tech] [Promote to Admin] [Reject]
```

- **"Promote to Broker"** opens `BrokerageAssignmentModal`:
  - Fields: brokerage name (text, required), city (text, required), Vapi assistant (select from 3 env IDs: `VAPI_ASSISTANT_OUTBOUND_ID`, `VAPI_ASSISTANT_INBOUND_ID`, `VAPI_ASSISTANT_REMINDER_ID`), notes (textarea, optional)
  - On save → server action:
    1. Insert into `brokerages` collection
    2. Update user: `role='broker'`, `status='active'`, `brokerage_id=new_brokerage._id`, `promoted_by_user_id=admin._id`, `promoted_at=now`
  - Toast: "User promoted to broker"

- **"Promote to Tech/Admin"** → server action:
  - Update user: `role='tech'|'admin'`, `status='active'`, `promoted_by_user_id`, `promoted_at`
  - No brokerage needed

- **"Reject"** → server action:
  - Update user: `status='suspended'`

#### Active Tab — Each Row

```
[Avatar] [Name] [Email] [Role badge] [Brokerage name if broker] [Last login] [Suspend]
```

#### Suspended Tab — Each Row

```
[Avatar] [Name] [Email] [Role badge] [Reinstate button]
```

- **"Reinstate"** → sets `status='active'`, keeps existing role

### Server Actions: `app/actions/users.ts`

```ts
'use server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireRole } from '@/lib/auth/guards'

export async function promoteUserAction(userId: string, role: UserRole, brokerageData?: {...}) {
  const session = await getServerSession(authOptions)
  requireRole(session, ['admin'])
  // ... DB operations
}

export async function suspendUserAction(userId: string) { ... }
export async function reinstateUserAction(userId: string) { ... }
```

---

## Deliverable 8 — Component-Level Role Gating

### Pattern: `useSession()` from `next-auth/react`

Every component below reads the session directly. No role-prop drilling.

```ts
import { useSession } from 'next-auth/react'
import { VISIBILITY } from '@/lib/auth/roles'
import type { Role } from '@/lib/auth/roles'

function useVisibility() {
  const { data: session } = useSession()
  const role = (session?.user?.role || 'broker') as Role
  return VISIBILITY[role]
}
```

### Components to Modify

| Component | What Changes | Rule |
|-----------|-------------|------|
| **AgentCard.tsx** | "Force Run" button | Hide if `!visibility.canForceRun` |
| **RunDetailDrawer.tsx** | Reasoning steps + Actions sections | If `!visibility.canViewReasoning`: show ONLY the "Reasoning summary" section (the GPT-4o-mini plain-English summary). Hide Input, Reasoning steps, Actions, Output, Transcript sections entirely. |
| **AnalyticsSection.tsx** (StatStrip) | `cost_per_lead` and `revenue` KPI cards | Hide if `!visibility.canViewCosts` |
| **AIOperationsSection.tsx** (PageHeader) | "Force Run All" action button | Hide if `!visibility.canForceRun` |
| **SettingsSection.tsx** | "User Management" link/section | Hide if `!visibility.canManageUsers` |

### Implementation Detail for RunDetailDrawer

```tsx
// Inside RunDetailBody
const { canViewReasoning } = useVisibility()

return (
  <div className="drawer">
    {/* Summary always visible */}
    <div className="drawer-section">
      <h4>Summary</h4>
      <ReasoningSummarySection run={run} />
    </div>

    {/* Full trace only for admin/tech */}
    {canViewReasoning && (
      <>
        <div className="drawer-section"><h4>Input</h4>...</div>
        <div className="drawer-section"><h4>Reasoning steps</h4>...</div>
        <div className="drawer-section"><h4>Actions</h4>...</div>
        <div className="drawer-section"><h4>Output</h4>...</div>
      </>
    )}
  </div>
)
```

---

## Deliverable 9 — Server-Side Enforcement

### File: `lib/auth/guards.ts`

```ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { UserRole } from '@/models/User'

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

export async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new AuthError('Unauthorized', 401)
  if (session.user.status === 'suspended') throw new AuthError('Account suspended', 403)
  if (session.user.status === 'pending_approval') throw new AuthError('Account pending approval', 403)
  return session
}

export async function requireRole(allowedRoles: UserRole[]) {
  const session = await requireSession()
  if (!allowedRoles.includes(session.user.role)) {
    throw new AuthError('Insufficient permissions', 403)
  }
  return session
}
```

### Usage in API Routes

```ts
// Example: app/api/leads/route.ts
import { requireSession } from '@/lib/auth/guards'

export async function GET(req: NextRequest) {
  const session = await requireSession() // throws 401/403
  // ... existing logic
}
```

### Usage in Server Actions

```ts
// Example: app/actions/leads.ts
export async function moveLeadToStageAction(leadId: string, stage: string) {
  await requireSession() // throws if unauthenticated
  // ... existing logic
}
```

### Exempt Routes (no session check)

| Route | Auth mechanism |
|-------|---------------|
| `/api/auth/*` | NextAuth internal |
| `/api/cron/*` | `x-cron-secret` header (existing) |
| `/api/vapi/webhook` | Vapi signature (Phase 12) |
| `/api/health` | Public health check |

### Edge Case: Broker Suspended Mid-Session

- JWT has `status='active'` encoded. The middleware only reads the JWT.
- **Solution**: In the `jwt` callback, add a periodic DB revalidation. On every request where `Date.now() - token.iat > 30 * 60 * 1000` (30 min), re-fetch the user from DB and update the token fields. If the user is now `suspended`, the next middleware check catches it.
- This means a suspended broker can continue for up to 30 minutes max before being locked out. Acceptable for V1.

### Edge Case: Cron-Fired Agent Runs and Suspended Brokers

- Cron agents (Follow-Up, Reminders, Re-engage) operate on leads/appointments globally. They do NOT run "on behalf of" a broker.
- When a broker is suspended, their leads remain in the system. Agents continue processing those leads because the data belongs to the brokerage, not the user.
- In Phase 11.5 (multi-tenant), brokerage-level suspension will be a separate concept.

---

## Deliverable 10 — Migration Plan for Existing Data

### Current State

All existing data (leads, clients, properties, calls, appointments, campaigns) was created in single-tenant mode with no `owner_id` or `brokerage_id` field.

### Recommendation: Leave As-Is

- Do NOT add `brokerage_id` to existing collections in Phase 11.
- All existing data is implicitly owned by "GharSoch HQ" (Anurag's operation).
- All queries remain unfiltered by brokerage — same behavior as today.

### Phase 11.5 Migration Script (documented, not implemented now)

```js
// scripts/migrate_to_multi_tenant.js (Phase 11.5)
// 1. Create a "GharSoch HQ" brokerage record
// 2. For every doc in [leads, clients, properties, calls, appointments, campaigns]:
//    db.<collection>.updateMany({}, { $set: { brokerage_id: gharsochHQId } })
// 3. Add brokerage_id filter to every service query
// 4. Create compound indexes: { brokerage_id: 1, status: 1 }, etc.
```

---

## Deliverable 11 — Environment Variables

### Add to `.env.example`

```bash
# Auth (Phase 11)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_SECRET=your-nextauth-secret       # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000          # production: https://gharsoc-app-primary.azurewebsites.net
```

### Already Present in Local `.env`

From user's env scan:
- ✅ `GOOGLE_CLIENT_ID` (line 40)
- ✅ `GOOGLE_CLIENT_SECRET` (line 41)
- ✅ `NEXTAUTH_SECRET` (line 42)
- ⚠️ `NEXTAUTH_URL` (line 43) — currently `http://localhost:3000-f879-445a-9549-d367f6e898d8` — **THIS IS MALFORMED**. Must be exactly `http://localhost:3000` for dev.

### Azure App Service Configuration

Navigate to: Azure Portal → App Services → `gharsoc-app-primary` → Settings → Configuration → Application settings

| Setting | Value |
|---------|-------|
| `GOOGLE_CLIENT_ID` | `93880475157-39vs72ufhaefso69fb1v8tnki29n25v3.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | (from `.env`) |
| `NEXTAUTH_SECRET` | (from `.env`) |
| `NEXTAUTH_URL` | `https://gharsoc-app-primary.azurewebsites.net` |

### Google Cloud Console OAuth Setup

- Authorized JavaScript origins: `http://localhost:3000`, `https://gharsoc-app-primary.azurewebsites.net`
- Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`, `https://gharsoc-app-primary.azurewebsites.net/api/auth/callback/google`

---

## Deliverable 12 — Implementation Sequence

### Step 1: Foundation (1.5h) — HIGHEST RISK

- Install `next-auth`, `@auth/mongodb-adapter`
- Create `models/User.ts`, `models/Brokerage.ts`
- Create `lib/auth.ts` (NextAuth config with callbacks)
- Create `app/api/auth/[...nextauth]/route.ts`
- Create `lib/auth/roles.ts` (visibility map)
- Create `lib/auth/guards.ts` (requireSession, requireRole)
- Fix `NEXTAUTH_URL` in `.env`
- Run auth index creation script

**Gate 1**: `npm run build` passes. Visit `/api/auth/signin` → Google OAuth screen appears. Sign in with `anurag.ugargol@gmail.com` → user doc created in Mongo with `role='admin'`, `status='active'`. Session cookie set.

**Why highest risk**: This touches the auth foundation. A mistake here blocks all subsequent steps. The MongoDB adapter integration with Cosmos can have subtle issues (Cosmos doesn't support all MongoDB features). Test the adapter write path carefully.

---

### Step 2: Middleware + Route Protection (1h)

- Create `middleware.ts` at project root
- Create `app/auth/signin/page.tsx` (custom sign-in page)
- Create `app/welcome/page.tsx` + `WelcomeContent.tsx`
- Wrap `SessionProvider` in `ClientProviders.tsx`

**Gate 2**: Unauthenticated visit to `/` → redirects to `/auth/signin`. Sign in with a non-admin Google account → lands at `/welcome`. Sign in with Anurag → lands at `/`.

---

### Step 3: Sidebar + Session Integration (45m)

- Update `Sidebar.tsx` (server) to fetch session + filter nav
- Update `SidebarClient.tsx` to accept `allowedNav` + `user` props
- Replace hardcoded "Anurag Ugargol" user pill with real session data
- Add sign-out dropdown menu

**Gate 3**: Sign in as admin → see all 12 nav items. Create a test broker account → see only 10 nav items (no AI Ops, no Agent Activity). User pill shows Google avatar.

---

### Step 4: Server-Side Guards on API Routes + Server Actions (1.5h)

- Add `requireSession()` to every API route in `app/api/` (except exempt routes)
- Add `requireSession()` to every server action in `app/actions/`
- Add `requireRole(['admin'])` to admin-only endpoints

**Gate 4**: Call `GET /api/leads` without auth cookie → 401. Call with broker cookie → 200. Call `POST /api/system-config` with broker cookie → 403.

---

### Step 5: Component-Level Gating (1h)

- Add `useVisibility()` hook
- Modify `AgentCard.tsx` — hide Force Run for brokers
- Modify `RunDetailDrawer.tsx` — show summary-only for brokers
- Modify `AnalyticsSection.tsx` — hide cost KPIs for brokers
- Modify `AIOperationsSection.tsx` — hide Force Run All for brokers

**Gate 5**: Sign in as broker → navigate to `/analytics` → cost_per_lead and revenue cards are not rendered. Sign in as admin → all cards visible.

---

### Step 6: User Management UI (1.5h)

- Create `app/(admin)/settings/users/page.tsx`
- Create `UserManagementSection.tsx` with 3 tabs
- Create `BrokerageAssignmentModal.tsx`
- Create server actions in `app/actions/users.ts`

**Gate 6**: Sign in as admin → `/settings/users` → see pending tab. Promote a pending user to broker (fill brokerage form) → user doc updated, brokerage doc created. Sign in as the promoted user → lands at `/leads` with broker nav.

---

### Total Estimated Effort: ~7.5 hours

| Step | Effort | Risk |
|------|--------|------|
| 1. Foundation | 1.5h | 🔴 HIGH — auth + adapter |
| 2. Middleware | 1h | 🟡 MEDIUM — redirect logic |
| 3. Sidebar | 45m | 🟢 LOW |
| 4. Server guards | 1.5h | 🟡 MEDIUM — many files |
| 5. Component gating | 1h | 🟢 LOW |
| 6. User management UI | 1.5h | 🟡 MEDIUM — modal + DB ops |

---

## Open Questions

> [!IMPORTANT]
> **Q1: NextAuth v4 or v5?**
> This design uses NextAuth v4 (`next-auth@^4.24`) which is stable and well-documented. Auth.js v5 (`next-auth@^5.0.0-beta`) has a different API surface. Your original request says "Auth.js" which implies v5, but v5 is still in beta. **Recommendation: Use v4 for stability.** Confirm?

> [!IMPORTANT]
> **Q2: NEXTAUTH_URL is malformed in your `.env`.**
> Line 43 currently reads `NEXTAUTH_URL=http://localhost:3000-f879-445a-9549-d367f6e898d8`. This has a UUID appended — likely a paste error. Must be fixed to `http://localhost:3000` before Step 1. Acknowledged?

> [!WARNING]
> **Q3: Google OAuth redirect URI for Azure.**
> The production callback URL is `https://gharsoc-app-primary.azurewebsites.net/api/auth/callback/google`. This must be added to the Google Cloud Console OAuth consent screen BEFORE deploying. Have you verified access to the Google Cloud project? The client ID `93880475157-*` maps to a specific GCP project.

> [!NOTE]
> **Q4: Session refresh window.**
> Design uses 24h JWT expiry with a 30-minute DB revalidation window in the `jwt` callback. This means:
> - A user stays logged in for 24h without re-authenticating
> - Role/status changes propagate within 30 minutes
> - If you want faster propagation (e.g., instant suspension), we'd need a `revoked_tokens` collection check on every request (adds 1 RU per page load). Worth it?

> [!NOTE]
> **Q5: MongoDB adapter vs custom user creation.**
> The `@auth/mongodb-adapter` creates its own `users`, `accounts`, and `verification_tokens` collections. Since we handle user creation manually in the `signIn` callback, we may not need the adapter at all — just use the `signIn` + `jwt` + `session` callbacks with our own `getCollection('users')` calls. This avoids the adapter creating duplicate records. **Recommendation: Skip the adapter entirely, handle user lifecycle manually.** This is simpler and avoids Cosmos compatibility issues with the adapter's `ObjectId` handling. Confirm?
