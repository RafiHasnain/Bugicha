# Bagicha — Feature List

> Bug report & ticket management system for tech companies.
> Three user roles: General User, Software Engineer, PM/Admin.

---

## Authentication & Onboarding

| # | Feature | Notes |
|---|---|---|
| A1 | Email + password signup / login | With email verification |
| A2 | Magic link login | Passwordless option |
| A3 | Google SSO | OAuth for company Google accounts |
| A4 | Role assignment on signup | Default to `general`; PM promotes users to `engineer`/`pm`/`admin` |
| A5 | Password reset flow | Forgot password → email reset link |
| A6 | Profile page | Name, avatar upload, change password |

---

## Role-Based Dashboards

| # | Feature | Who |
|---|---|---|
| D1 | **General User Dashboard** — "My Reports" list showing only their submitted tickets with status badges | General |
| D2 | **Engineer Dashboard** — "My Work" (assigned tickets) + "My Reports" (tickets they filed) in tabs | Engineer |
| D3 | **PM Dashboard** — overview widgets: tickets awaiting review, open by severity, assigned workload per engineer, unresolved count | PM/Admin |
| D4 | Global stat cards | Total tickets, open, resolved this week, average resolution time |

---

## Ticket Creation

| # | Feature | Notes |
|---|---|---|
| T1 | Create ticket form | Title, description (rich text or markdown), type (bug / feature request / task), severity (critical / high / medium / low) |
| T2 | Screenshot / file attachment upload | Drag-and-drop, stored in Supabase Storage |
| T3 | Source URL auto-fill | If created from Chrome Extension, the URL is pre-populated |
| T4 | Submit as draft | Save without sending to review |
| T5 | Ticket reference number | Auto-generated, human-readable (e.g., `BAG-00142`) |
| T6 | Duplicate detection | Warn if a similar open ticket exists (title fuzzy match) |

---

## Ticket Views

| # | Feature | Notes |
|---|---|---|
| V1 | **List / Table view** | Sortable columns: ID, title, type, severity, status, reporter, assignee, created date. Filter by type, severity, status, assignee |
| V2 | **Kanban board** | Columns = status stages. Drag-and-drop tickets between columns. Updates status in real-time |
| V3 | **Ticket detail page** | Full description, metadata, comment thread, activity/audit log, status change buttons |
| V4 | Quick filters | "My tickets", "Unassigned", "Critical only", "Updated today" |
| V5 | Search | Full-text search across title + description |

---

## PM Review & Assignment Flow

| # | Feature | Notes |
|---|---|---|
| P1 | **Review queue** | Inbox view of all `submitted` tickets, ordered by severity then date |
| P2 | Approve / Reject | Buttons with optional reason comment. Status changes to `approved` or `rejected` |
| P3 | Bulk approve / reject | Multi-select tickets, batch action |
| P4 | **Assign to engineer** | Dropdown of all engineers, shows current workload (ticket count) per engineer |
| P5 | Reassign | Transfer a ticket from one engineer to another |
| P6 | Change severity / type | PM can override reporter's severity or reclassify bug → feature request |
| P7 | Request more info | Send ticket back to reporter with a question (status: `needs_info`) |

---

## Engineer Workflow

| # | Feature | Notes |
|---|---|---|
| E1 | "Assigned to Me" view | Filtered list of all tickets assigned to the logged-in engineer |
| E2 | Status progression | Buttons: Start Work → Mark In Progress → Submit for Review → Mark Resolved |
| E3 | Time tracking (optional) | Log hours spent on a ticket |
| E4 | Link commits / PRs | Paste GitHub/GitLab links into ticket |
| E5 | Escalate to PM | Flag a ticket that needs PM attention (blockers, scope creep) |

---

## Comments & Collaboration

| # | Feature | Notes |
|---|---|---|
| C1 | Comment thread on each ticket | Rich text or markdown, @mention other users |
| C2 | @mention notifications | In-app notification bell + email digest |
| C3 | Activity / audit log | Every status change, assignment, comment — who did what, when |
| C4 | Internal notes | Comments visible only to engineers + PMs (not general users) |

---

## Feature Requests

| # | Feature | Notes |
|---|---|---|
| F1 | Separate category in ticket creation | Type: `feature_request` |
| F2 | Upvote system | Engineers and PMs can upvote feature requests |
| F3 | Feature request board | Sorted by votes, with PM priority override |
| F4 | Status tracking | Under Review → Planned → In Development → Shipped → Declined |
| F5 | Public roadmap view (optional) | Read-only page showing planned / in-progress / shipped features for general users |

---

## Admin / Settings

| # | Feature | Notes |
|---|---|---|
| AD1 | **User management** | Table of all users. Promote/demote roles (general ↔ engineer ↔ pm ↔ admin). Deactivate accounts |
| AD2 | Invite users | Send invite email, pre-set role |
| AD3 | Custom ticket statuses | Add/remove/reorder Kanban columns per project |
| AD4 | Custom severity labels | Rename or add severity levels |
| AD5 | Team / project creation | Group users into teams. Scope tickets to a project/team |

---

## Notifications

| # | Feature | Notes |
|---|---|---|
| N1 | In-app notification bell | Dropdown with recent notifications, unread count badge |
| N2 | Email notifications | Customizable: on assignment, on status change, on comment, on mention, daily digest |
| N3 | Slack / Discord webhooks (later) | Post to channel on new critical bug or ticket assignment |

---

## Reporting (PM/Admin)

| # | Feature | Notes |
|---|---|---|
| R1 | Tickets by status (pie / bar chart) | Visual breakdown |
| R2 | Tickets by engineer (workload chart) | Bar chart of open tickets per engineer |
| R3 | Resolution time trend | Average days from submit → resolved, over time |
| R4 | Tickets by severity over time | Line chart |
| R5 | Weekly / monthly summary email | Auto-generated report |

---

## Build Phases

| Phase | What | Core of MVP? |
|---|---|---|
| **Phase 1** | Auth + Ticket Creation + List View + PM Review Flow | ✅ MVP |
| **Phase 2** | Kanban Board + Comments + Engineer Workflow | ✅ MVP |
| **Phase 3** | Notifications + Search + Reporting | ✅ MVP |
| **Phase 4** | Feature Requests + Upvotes + Roadmap | Post-MVP |
| **Phase 5** | Admin/Teams + Custom Statuses + Integrations | Post-MVP |
