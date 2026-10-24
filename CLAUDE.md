# Bagicha — Bug Report & Ticket Management System

## What This Project Is

A support-ticket + lightweight project-management platform for a tech company. Three user roles, a Chrome Extension for bug capture, and a Next.js web dashboard for management.

### User Roles

| Role | Permissions |
|---|---|
| **General User** (business people) | Submit bug reports & feature requests. View own tickets. Cannot be assigned. |
| **Software Engineer** | Submit tickets + get assigned to tickets + view assigned work queue. |
| **PM / Admin** | Full control — approve/reject tickets, assign to engineers, manage Kanban board, manage users. |

### Ticket Lifecycle

```
Submitted → PM Review → Approved → Assigned → In Progress → Resolved → Closed
                         ↘ Rejected (closed)
```

Feature requests follow the same pipeline but are categorized differently.

### Chrome Extension (not yet built)

- Content script captures: `console.*` logs, uncaught errors, failed network requests (4xx/5xx), DOM snapshot, viewport screenshot, browser/OS info, current URL
- Popup: user fills in title, description, severity, type (bug/feature)
- Communicates directly with Supabase via `@supabase/supabase-js`

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.9 |
| UI | React | 19.2.4 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | ^4 |
| Components | shadcn/ui | ^4.11.0 (radix-vega style) |
| Icons | HugeIcons | ^4.2.1 (core-free) |
| Backend / DB | Supabase | (not yet integrated) |
| Charts | Recharts | ^3.8.0 |
| Calendar | react-day-picker | ^10.0.1 |
| Carousel | embla-carousel-react | ^8.6.0 |
| Forms | shadcn Field components + native form handling |
| Package manager | npm | — |
| Hosting target | Vercel (free tier) | — |

### shadcn/ui Configuration (`components.json`)

- Style: `radix-vega`
- RSC: enabled
- Icon library: `hugeicons`
- Base color: `neutral` with CSS variables
- Aliases: `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`

---

## Project Structure

```
bagicha/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (Geist + DM Sans fonts, NOT yet wrapped with TooltipProvider)
│   │   ├── page.tsx                # Home page (boilerplate)
│   │   ├── globals.css             # Tailwind v4 import + shadcn CSS variables
│   │   ├── dashboard/
│   │   │   └── page.tsx            # Dashboard block (sidebar-07) — sidebar layout with placeholder content
│   │   ├── login/
│   │   │   └── page.tsx            # Login page (login-02 block)
│   │   └── signup/
│   │       └── page.tsx            # Signup page (signup-02 block)
│   ├── components/
│   │   ├── app-sidebar.tsx         # Sidebar shell (collapsible, icon mode)
│   │   ├── nav-main.tsx            # Primary navigation items
│   │   ├── nav-projects.tsx        # Project switcher list
│   │   ├── nav-user.tsx            # User avatar + menu in sidebar footer
│   │   ├── team-switcher.tsx       # Team/org switcher dropdown
│   │   ├── login-form.tsx          # Login form (email + password + GitHub SSO)
│   │   ├── signup-form.tsx         # Signup form
│   │   └── ui/                     # 46 installed shadcn components (see below)
│   ├── hooks/
│   │   └── use-mobile.ts           # Mobile detection hook (from sidebar block)
│   └── lib/
│       └── utils.ts                # cn() utility (clsx + tailwind-merge)
├── components.json                 # shadcn config
├── package.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
└── AGENTS.md                       # Next.js 16 agent rules — DO NOT DELETE, read before writing code
```

### Installed shadcn Components (46 total)

All components EXCEPT `toast` and `sonner` (excluded — known issues):

`accordion alert alert-dialog aspect-ratio avatar badge breadcrumb button calendar card carousel chart checkbox collapsible combobox command context-menu dialog drawer dropdown-menu hover-card input input-otp label menubar navigation-menu pagination popover progress radio-group resizable scroll-area select separator sheet sidebar skeleton slider switch table tabs textarea toggle tooltip`

Plus `field` (installed automatically by the login-02 block).

### Components NOT installed (manual copy-paste patterns, not CLI packages)

`button-group input-group spinner typography toggle-group data-table date-picker direction empty item kbd native-select`

These are built by combining the installed components. Their code lives in the shadcn docs.

---

## What Already Works

- ✅ Next.js project runs (`npm run dev`)
- ✅ Dashboard layout with collapsible sidebar, breadcrumbs, header (at `/dashboard`)
- ✅ Login page with form (at `/login`)
- ✅ Signup page with form (at `/signup`)
- ✅ All 46 shadcn components available in `@/components/ui/`
- ✅ `cn()` utility in `@/lib/utils`
- ✅ Git repo initialized

## What's Placeholder / Needs Replacing

- **`app-sidebar.tsx`**: All `data` is sample (Acme Inc, playground, models, etc.). Replace with actual ticket-management nav items.
- **`dashboard/page.tsx`**: Content area has 3 empty stat cards and a big empty div. Replace with actual ticket views (Kanban, table, etc.).
- **`login-form.tsx` / `signup-form.tsx`**: Pure UI, no auth logic. Wire to Supabase Auth.
- **`layout.tsx`**: Missing `TooltipProvider` wrapper (required by sidebar block). Fonts are Geist + DM Sans but DM Sans is set as `--font-sans` — may want to consolidate.

## Known Issues / Gotchas

1. **`TooltipProvider` is missing** from `layout.tsx`. The sidebar block needs it. Add:
   ```tsx
   import { TooltipProvider } from "@/components/ui/tooltip"
   // wrap <body> children with <TooltipProvider>
   ```

2. **`sonner` and `toast` are NOT installed** (excluded intentionally). If you need toasts, install `sonner` manually or use a different approach.

3. **Next.js 16 has breaking changes** — read `node_modules/next/dist/docs/` before writing any Next.js-specific code. The `AGENTS.md` file has the auto-generated rules.

4. **No Supabase client initialized yet** — no `@supabase/supabase-js` in package.json, no `.env.local` with Supabase keys.

---

## Planned Database Schema (Supabase PostgreSQL)

```sql
-- Extended user profile (triggered from auth.users)
profiles (
  id uuid PK REFERENCES auth.users,
  email text,
  full_name text,
  role text CHECK (role IN ('general', 'engineer', 'pm', 'admin')),
  avatar_url text,
  created_at timestamptz DEFAULT now()
)

-- Tickets (bugs, feature requests, tasks)
tickets (
  id uuid PK DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text CHECK (type IN ('bug', 'feature_request', 'task')) DEFAULT 'bug',
  severity text CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status text CHECK (status IN ('submitted', 'in_review', 'approved', 'rejected', 'assigned', 'in_progress', 'resolved', 'closed')) DEFAULT 'submitted',
  reporter_id uuid REFERENCES profiles(id),
  assignee_id uuid REFERENCES profiles(id),
  source_url text,           -- URL where bug was captured
  browser_info jsonb,        -- { userAgent, os, browser, version, viewport }
  console_logs jsonb,        -- captured console output
  network_errors jsonb,      -- failed fetch/XHR entries
  dom_snapshot jsonb,        -- title, route, visible error messages
  screenshot_url text,       -- Supabase Storage URL
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- Comments / discussion on tickets
ticket_comments (
  id uuid PK DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id),
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
)

-- Audit log for status changes
ticket_audit_log (
  id uuid PK DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES profiles(id),
  old_status text,
  new_status text,
  changed_at timestamptz DEFAULT now()
)
```

### RLS Strategy

- **General users**: INSERT tickets, SELECT own tickets only
- **Engineers**: SELECT own + assigned tickets, UPDATE tickets assigned to them
- **PMs/Admins**: full SELECT/UPDATE/DELETE on all tickets, plus role management

RLS policies read `role` from `profiles` table via a subquery.

---

## What Needs to Be Built (rough order)

1. **Supabase setup** — create project, get API keys, add `@supabase/supabase-js`, create `.env.local`
2. **Auth** — wire login/signup forms to Supabase Auth, create `profiles` table trigger, set up RLS
3. **Fix layout** — add `TooltipProvider`, clean up font config
4. **Dashboard routes & nav** — replace sample sidebar data with: My Tickets, Review Queue, Kanban Board, Assigned to Me, Feature Requests, Admin (PM only)
5. **Ticket creation form** — modal or page with title, description, type, severity, screenshot upload
6. **Ticket list/table view** — filterable, sortable table with status badges
7. **Kanban board** — drag-and-drop columns by status, real-time updates
8. **PM review flow** — approve/reject buttons, assignee dropdown
9. **Chrome Extension** — manifest v3, content script for capture, popup for submit, supabase-js client
10. **Role-based route protection** — middleware or layout-level auth checks

---

## Commands

```bash
npm run dev        # Start dev server (usually on localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npx shadcn@latest add <component>   # Add shadcn components
```

## Key Project Rules

- **Tailwind v4** — uses CSS-first config (`@import "tailwindcss"` in globals.css), NOT `tailwind.config.js`
- **shadcn radix-vega style** — uses `Field`, `FieldGroup`, `FieldLabel` instead of traditional `FormField`/`FormItem` wrappers
- **Icons** — always use `HugeiconsIcon` from `@hugeicons/react` with icons from `@hugeicons/core-free-icons`
- **Next.js 16** — read `node_modules/next/dist/docs/` for APIs. This version has breaking changes from Next.js 14/15.
- **Fonts** — Geist Sans, Geist Mono, and DM Sans are loaded in layout.tsx. DM Sans is set as `--font-sans` via CSS variable.
