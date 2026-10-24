# Bugicha — Feedback on Core Supabase MVP Plan

**For:** implementation agent (Codex)
**Context:** Feedback on `plan.md`. Chrome extension does **not** exist yet — everything here is web-app only.
**Priority framing:** most of this is *schema shape*, not features. These are cheap to add before `schema.sql` is applied and expensive to migrate afterwards. Build the columns now even where the feature is Phase 2.

---

## 1. Schema additions — do these before running `schema.sql`

### 1.1 `project_id` on tickets — highest priority

The plan has no project or product concept. Fringecore has 2–4 codebases. Adding this later means touching every query, every RLS policy, every filter, plus backfilling existing rows with a guess.

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  key text not null,              -- 'WEB', 'MOB' — used in ticket refs
  name text not null,
  repo_url text,
  created_at timestamptz not null default now(),
  unique (org_id, key)
);

alter table tickets add column project_id uuid not null references projects(id);
create index on tickets (project_id, status);
```

Seed one project so existing rows have a home. Add a project selector to the ticket form and a project filter to all list views.

**Ticket references should carry the project key:** `WEB-BUG-00001`, not `BUG-00001`.

### 1.2 `org_id` on every table

Near-free today, and the difference between "we can sell this later" and "we rewrite the data layer to sell this."

```sql
create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
```

Add `org_id uuid not null references orgs(id)` to `profiles`, `projects`, `tickets`, `ticket_comments`, `ticket_audit_log`, `notifications`. Include `org_id` in every RLS policy. Seed a single Fringecore org.

### 1.3 `priority` — separate from `severity`

`severity` = reporter's impact claim. `priority` = PM's ordering decision. Without the split, every ticket is Critical within two weeks and the review queue becomes a wall of red.

```sql
create type ticket_priority as enum ('p0','p1','p2','p3');
alter table tickets add column priority ticket_priority;  -- null until triaged
```

- `severity` is writable by the reporter at creation, read-only afterwards.
- `priority` is writable by PM/admin only.
- **Sort all queues by `priority`, never by `severity`.**

Show these severity definitions inline on the submit form — vague labels are why everyone picks Critical:

| Level | Definition shown to reporter |
|---|---|
| Critical | Blocks all users, no workaround, data loss or security exposure |
| High | Blocks a core workflow, painful workaround exists |
| Medium | Degrades experience, easy workaround |
| Low | Cosmetic, or affects few users |

### 1.4 `capture` — versioned JSONB

The web app can collect most of the useful context today with zero extension work. Store it as a versioned blob so the extension can enrich it later without a migration.

```sql
alter table tickets
  add column capture jsonb,
  add column capture_schema_version int not null default 1;
```

Collected automatically by the web form on submit (v1 shape):

```json
{
  "url": "https://app.example.com/dashboard/reports",
  "route": "/dashboard/reports",
  "user_agent": "...",
  "browser": "Chrome 138",
  "os": "macOS 15.2",
  "viewport": { "w": 1512, "h": 856 },
  "device_pixel_ratio": 2,
  "environment": "production",
  "app_version": "unknown",
  "captured_at": "2026-07-28T09:14:22Z"
}
```

`app_version` / build SHA is the single most useful field for engineers — wire it in if the target apps expose it, otherwise leave the key present and null.

**Do not build a bespoke UI for each field.** Render `capture` as a collapsible key/value block on the ticket detail page.

### 1.5 Duplicate / incident structure — confirmed in scope

Build the *shape* now; the detection algorithm is Phase 2.

```sql
alter table tickets add column duplicate_of uuid references tickets(id);

create table ticket_reporters (
  ticket_id uuid not null references tickets(id) on delete cascade,
  user_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  primary key (ticket_id, user_id)
);
```

Rules:

- Keep `reported_by` on tickets as the **original** reporter for convenience, but treat `ticket_reporters` as the source of truth for notifications.
- On creation, insert one row into `ticket_reporters`.
- Marking B as duplicate of A sets `B.duplicate_of = A.id`, moves B's reporters into A's `ticket_reporters`, and closes B.
- **Every reporter on A is notified of A's status changes**, not just the original.
- Show reporter count on the ticket and in list views — it is a real priority signal.
- Duplicates are hidden from default list views; A shows "3 duplicates merged."

### 1.6 Miscellaneous columns — add now, populate later

```sql
alter table tickets
  add column sentry_issue_url text,
  add column branch_name text,
  add column pr_url text,
  add column released_in_version text,
  add column rejection_reason text,     -- enum below
  add column rejection_note text,
  add column verified_at timestamptz,
  add column verified_by uuid references profiles(id);
```

`rejection_reason` values: `duplicate`, `works_as_designed`, `cannot_reproduce`, `out_of_scope`, `wont_fix_now`.
**`rejection_note` is required (non-empty) whenever a ticket is rejected.** Enforce in the server action, not only the UI.

---

## 2. Status model — revise before building

Current: `submitted → in_review → approved → rejected → assigned → in_progress → resolved → closed`

### 2.1 Rename `in_review` → `triage`

`in_review` means PM triage in the plan and code review to every engineer. This collides the day GitHub integration lands. Rename now.

### 2.2 Add `needs_info`

One of the most-used transitions in any real ticketing system. Without it, PMs reject reports that were merely unclear, and reporters learn that filing gets you rejected.

- PM moves to `needs_info` **with a required question**, posted into the ticket conversation thread (see §4).
- Reporter reply moves it back to `triage` automatically.
- Auto-close after 7 days of silence, with a notification at day 5.

### 2.3 Split `approved` into `backlog` and `todo`

Approved-but-unscheduled and approved-and-queued are different states — that difference is what a backlog *is*. Kanban's first column should be `todo`, with `backlog` off-board.

### 2.4 Split `resolved` into `merged` / `released` / `verified`

Reporters do not care that code merged. They care that it deployed and that it actually fixed their problem.

- `merged` — PR merged (manual for now, automated when GitHub integration lands)
- `released` — deployed; sets `released_in_version`
- `verified` — **the original reporter confirms the fix**
- `closed` — terminal

Verification is the cheapest thing you can build to keep reporting culture alive, and it catches "the engineer fixed the wrong thing." If a reporter does not verify within 7 days, auto-transition to `closed`.

### 2.5 Final enum

```sql
create type ticket_status as enum (
  'submitted','triage','needs_info','rejected',
  'backlog','todo','assigned','in_progress',
  'merged','released','verified','closed'
);
```

Transitions must be validated **server-side**. Client-side guards alone are not sufficient — kanban drag can produce any pair.

---

## 3. Screenshot and screen recording — scope change

**This un-defers storage.** The plan states no attachment table or bucket in this pass. Screenshots and recordings require both. Codex should treat storage as in scope.

### 3.1 Both are achievable without the extension

```js
// screen recording
const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });

// screenshot: capture one frame from the same stream to canvas, export as PNG
```

Note the constraint: `getDisplayMedia` requires the user to pick a window/tab in a browser dialog, so the reporter must **reproduce the bug while recording**. The extension will later remove this friction with a rolling buffer that captures the seconds *before* the click. Build the UI so that swap is invisible to the user.

### 3.2 Requirements

```sql
create table ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  ticket_id uuid not null references tickets(id) on delete cascade,
  kind text not null,              -- 'screenshot' | 'recording' | 'file'
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  duration_ms int,                 -- recordings only
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);
```

- Supabase Storage bucket, **private**, path `{org_id}/{project_id}/{ticket_id}/{uuid}.{ext}`
- Signed URLs with short expiry — never public URLs
- **Cap recordings at 60 seconds and ~25 MB.** Stop recording automatically at the limit. Uncapped screen recordings will consume the storage quota within weeks.
- Screenshots: PNG, downscale to max 1920px wide
- **Mandatory preview before submit** — reporter sees exactly what is being uploaded and can delete it. Screens contain customer data, open email, and internal dashboards. This is the redaction step for v1.
- Upload progress indicator; recordings are large enough that a silent 20-second wait reads as a broken form
- Retention: purge attachments 90 days after `closed`. Add a scheduled job or document it as a manual task.

### 3.3 Remove the fake upload UI

Per the plan's own instruction — if any upload control still implies persistence without a working backend, wire it up or hide it.

---

## 4. Notification loop — tie into the existing conversation page

You have a ticket conversation page already. Route everything through it rather than building a parallel notification-only channel.

Required notifications to the **reporter** (all reporters in `ticket_reporters`, not just the original):

| Event | Notification |
|---|---|
| Rejected | **Reason + full note**, posted into the thread. Never a bare "closed." |
| Needs info | The PM's specific question, posted into the thread |
| Assigned | Who is working on it |
| Released | "Fixed in `{released_in_version}`, deployed today" — with a **Confirm fix / Still broken** action |
| Comment added | Standard thread notification |

"Still broken" reopens the ticket to `triage` and preserves the history.

Required notifications to the **engineer**: assignment, reporter reply, reopened after failed verification.

**Why this matters more than it looks:** with roughly 10 engineers to 30–100 reporters, reporting culture is the input that determines whether this product has any value at all. Reporters who hear nothing stop filing, and bugs reach customers instead. Track reports-per-reporter weekly from launch.

---

## 5. RLS corrections

### 5.1 Engineers must read all tickets in their projects

The plan restricts engineers to tickets assigned to or reported by them. Ten engineers who cannot see each other's tickets cannot check for duplicates, cannot pick up unassigned work, cannot review each other's tickets, and cannot answer "is anyone already on this?"

- **Read:** all tickets in projects the engineer is a member of
- **Write:** only tickets assigned to them, and only the workflow transitions in §2

### 5.2 Restrict `task` creation

Tasks are PM/engineer-only. If general users can file tasks, they file feature requests as tasks and the review queue loses its shape. General users get `bug` and `feature_request` only. Enforce in RLS and in the server action.

### 5.3 Project membership

```sql
create table project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (project_id, user_id)
);
```

General users can report into any project in their org; visibility of *others'* tickets is project-scoped for engineers.

---

## 6. Additions to the test plan

The existing acceptance list covers CRUD and permissions well. Add the loop that determines adoption:

- [ ] Reporter sees a rejection **with its reason and note**, in the ticket thread. Not done: the UI posts the rejection note as a comment, but not the reason label.
- [x] Reporter is notified on `released` and can **Confirm fix**, moving the ticket to `verified`
- [x] "Still broken" reopens to `triage` with history intact
- [ ] `needs_info` posts the PM's question to the thread; reporter reply returns it to `triage`. Partially done: PM question is posted; reporter reply does not auto-return it to `triage`.
- [x] Marking B duplicate of A moves B's reporters to A; all of them are notified of A's next status change
- [ ] Screen recording uploads, plays back on the ticket page, and stops automatically at the 60s cap. Partially done: recording/upload/60s cap exist; ticket detail only links attachments instead of inline playback.
- [ ] Attachment URLs are signed and expire; a logged-out user cannot open one. Partially done: signed URLs expire after 10 minutes; logged-out access before expiry is still possible by signed URL design.
- [x] A general user cannot create a ticket of type `task`
- [x] An engineer can read a teammate's unassigned ticket in the same project but cannot edit it
- [x] An engineer cannot read tickets in a project they are not a member of
- [x] An invalid status transition rejected by the API returns an error even when forced client-side
- [ ] Every list view filters by project, and ticket refs render as `WEB-BUG-00001`. Partially done: ticket/review/kanban views filter by project and refs render with project keys; some dashboard/report/profile lists are not project-filtered.

---

## 7. Explicitly out of scope for this pass

Correctly deferred in the plan; keep them deferred:

- Chrome extension (network/console capture, rolling buffer, session replay)
- Duplicate **detection** algorithm — only the schema shape lands now
- Passive telemetry and ghost tickets
- Bounty / points system
- Google SSO, magic links, password reset
- Slack integration, email notifications
- GitHub status automation — columns exist, populated manually for now
- Roadmap, upvotes, custom statuses
- Tabler → HugeIcons migration
- WIP limits on kanban

---

## 8. Suggested order

1. Build health fixes (unchanged from plan)
2. `orgs`, `projects`, `project_members`, seed data
3. Full `schema.sql` including §1 columns and the §2.5 status enum
4. RLS with `org_id` + project scoping (§5)
5. Auth, replacing `MockAuthProvider` (unchanged from plan)
6. Ticket CRUD + `capture` collection + server-side transition validation
7. Storage bucket, screenshot and recording capture (§3)
8. Notification loop and verification through the conversation page (§4)
9. Duplicate merge action (§1.5) — manual PM action, no auto-detection
10. Delete mock data and auth

Items 3 and 4 are the ones that must be correct before real data exists. Everything after is migratable.

---

## 9. One framing note

This pass builds the workflow layer — the part Linear and Jira already do well. That is the right thing to build first, because everything else sits on it. But when it ships you will have a competent internal tracker, not yet the thing that makes this product distinct.

The differentiation starts at the extension: the repro packet, the failed-request capture, the console state, and eventually the rolling buffer that captures the seconds *before* the reporter noticed anything was wrong. **Keep this pass tight and get there fast.** The main risk is workflow polish expanding to fill the time before extension work begins.
