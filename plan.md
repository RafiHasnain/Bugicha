# Bugicha Core Supabase MVP Plan

## Summary

- Make the current app genuinely usable with the smallest durable backend: email/password Supabase Auth, protected dashboard routes, live ticket CRUD/workflow, comments, audit history, basic notifications, and role-gated PM/engineer views.
- Fix build/lint blockers first so backend work lands on a green base.
- Defer persistent attachments/storage for this pass; hide or disable the current upload UI so the app does not pretend files are saved.
- Do not change the current UI design. Keep existing pages, component structure, layout, typography, spacing, and styling unless a minimal build fix requires touching code.

## Key Changes

- Use Yarn v1 for dependency changes and verification. Commit/update `yarn.lock`; remove `package-lock.json` only if intentionally standardizing the repo on Yarn in the same implementation pass.
- Install `@supabase/supabase-js` and `@supabase/ssr`.
- Add Supabase clients:
  - Browser client with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - Server client with cookie-backed SSR auth.
  - Server-only admin client with `SUPABASE_SERVICE_ROLE_KEY`, never imported by Client Components.
- Add Next 16 `proxy.ts` for Supabase session refresh, using the current Proxy convention rather than old middleware naming.
- Replace `MockAuthProvider` with real auth/profile context populated from Supabase.
- Do not do a broad Tabler-to-HugeIcons migration in this MVP. Existing icons can stay; only touch icons when fixing a local compile/lint issue.
- Keep routes mostly intact:
  - Public: `/login`, `/signup`, `/auth/callback`.
  - Protected: `/dashboard/**`.
  - PM/admin only: `/dashboard/review`, `/dashboard/reports`, `/dashboard/users`.
  - Engineer/PM: `/dashboard/assigned`, `/dashboard/kanban`.

## Data Model And Interfaces

- Create `src/lib/types.ts` with shared unions:
  - `UserRole = "general" | "engineer" | "pm" | "admin"`
  - `TicketStatus = "submitted" | "in_review" | "approved" | "rejected" | "assigned" | "in_progress" | "resolved" | "closed"`
  - `TicketType = "bug" | "feature_request" | "task"`
  - `TicketSeverity = "critical" | "high" | "medium" | "low"`
- Create `supabase/schema.sql` because Supabase CLI and `psql` are not installed locally. Apply it through the Supabase SQL editor unless CLI tooling is added later.
- Schema: `profiles`, `tickets`, `ticket_comments`, `ticket_audit_log`, `notifications`; no attachment table/bucket in this pass.
- Use human references like `BUG-00001` as the visible ticket URL id while storing UUID primary keys internally.
- RLS:
  - General users read/create their own tickets.
  - Engineers read tickets assigned to them or reported by them; update only assigned workflow states.
  - PM/admin read all tickets and can assign, approve/reject, update role metadata, and view reports.
  - Comments and notifications follow the parent ticket/user visibility.
- Bootstrap PMs from `PM_EMAILS` on first authenticated server load.

## Implementation Order

- Repair current build health:
  - Fix malformed imports in `src/components/nav-projects.tsx` and `src/components/team-switcher.tsx`.
  - Clear unused imports/variables and React lint errors in `use-mobile`/carousel with the smallest local changes.
  - Preserve `Providers`/`TooltipProvider`, which already exists despite older `CLAUDE.md` text saying it was missing.
  - Avoid font, icon, color, layout, spacing, or component styling changes unless required for compile/lint correctness.
- Add Supabase auth:
  - Login/signup forms call server actions.
  - Signup stores `full_name`; email confirmation shows a check-email state if Supabase requires it.
  - Logout signs out and redirects to `/login`.
- Replace mock reads/mutations:
  - Dashboard/tickets/review/assigned/kanban/reports/users/profile read from Supabase.
  - New ticket inserts a real row and redirects to the ticket detail route.
  - Status changes, assignment, comments, role changes, notifications persist and survive refresh.
- Delete or quarantine mock auth/data once no app route imports them.

## Test Plan

- Run `yarn lint`.
- Run `yarn build`; network access may be required for Next font fetching.
- Run `yarn dev` for local manual verification.
- Manual acceptance:
  - Unauthenticated `/dashboard` redirects to `/login`.
  - Email/password signup creates a user and profile.
  - A `PM_EMAILS` user becomes PM.
  - General user creates a ticket and sees only their own tickets.
  - PM approves/rejects/assigns and sees reports/users.
  - Engineer sees assigned work and moves `assigned -> in_progress -> resolved`.
  - Comments and notifications persist after refresh.
  - Kanban drag persists status changes.
  - Non-PM users cannot access PM-only routes.

## Assumptions And References

- UI preservation wins over optional design-system cleanup for this MVP.
- Treat `CLAUDE.md` as partially stale: it says npm, but the user has used Yarn; it says some layout/dashboard pieces are placeholder, but the repo now has more complete dashboard routes. Its product model and role lifecycle remain useful context.
- Package-manager standardization should not become its own refactor; use Yarn because the user already did.
- Attachments/storage are deferred by choice; upload UI should not claim persistence.
- Google SSO, magic links, password reset, email/slack notifications, duplicate detection, upvotes, roadmap, custom statuses, Chrome extension work, and full icon migration are out of this first pass.
- Supabase guidance used: [SSR client setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [package choice](https://supabase.com/docs/guides/auth/choosing-a-server-package), [Next.js auth troubleshooting](https://supabase.com/docs/guides/troubleshooting/how-do-you-troubleshoot-nextjs---supabase-auth-issues-riMCZV).
- Next 16 local docs used: `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`, `07-mutating-data.md`, and `02-guides/authentication.md`.
