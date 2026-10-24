export type TicketStatus =
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed"
export type TicketType = "bug" | "feature_request" | "task"
export type TicketSeverity = "critical" | "high" | "medium" | "low"
export type UserRole = "general" | "engineer" | "pm"

export interface MockUser {
  id: string
  name: string
  email: string
  role: UserRole
  initials: string
}

export interface Ticket {
  id: string
  title: string
  description: string
  type: TicketType
  severity: TicketSeverity
  status: TicketStatus
  reporter_id: string
  assignee_id: string | null
  source_url: string | null
  created_at: string
  updated_at: string
}

export interface TicketComment {
  id: string
  ticket_id: string
  author_id: string
  body: string
  is_internal: boolean
  created_at: string
}

export interface AuditEntry {
  id: string
  ticket_id: string
  changed_by: string
  old_status: TicketStatus | null
  new_status: TicketStatus
  changed_at: string
}

export const MOCK_USERS: MockUser[] = [
  { id: "u1", name: "Alex Chen", email: "alex@company.com", role: "general", initials: "AC" },
  { id: "u2", name: "Sam Rivera", email: "sam@company.com", role: "engineer", initials: "SR" },
  { id: "u3", name: "Jordan Lee", email: "jordan@company.com", role: "engineer", initials: "JL" },
  { id: "u4", name: "Morgan Kim", email: "morgan@company.com", role: "pm", initials: "MK" },
]

export const MOCK_TICKETS: Ticket[] = [
  {
    id: "BUG-00001",
    title: "Login button unresponsive on Firefox",
    description:
      "When using Firefox 124+, clicking the login button does nothing. No console errors. Reproduced on macOS and Windows.\n\nSteps to reproduce:\n1. Open Firefox 124+\n2. Navigate to /login\n3. Fill in valid credentials\n4. Click Login button\n\nExpected: User is authenticated\nActual: Nothing happens",
    type: "bug",
    severity: "critical",
    status: "in_progress",
    reporter_id: "u1",
    assignee_id: "u2",
    source_url: "https://app.company.com/login",
    created_at: "2026-06-20T09:15:00Z",
    updated_at: "2026-06-21T14:30:00Z",
  },
  {
    id: "BUG-00002",
    title: "Dark mode toggle not saving preference",
    description:
      "The dark/light mode toggle resets to light mode on every page refresh. The preference should be persisted in localStorage but it seems like it's not being saved.",
    type: "bug",
    severity: "medium",
    status: "submitted",
    reporter_id: "u1",
    assignee_id: null,
    source_url: null,
    created_at: "2026-06-21T11:00:00Z",
    updated_at: "2026-06-21T11:00:00Z",
  },
  {
    id: "BUG-00003",
    title: "Add bulk export for reports to CSV",
    description:
      "PMs need the ability to export all ticket reports to CSV format for monthly reporting. Currently the data can only be viewed in the dashboard.\n\nAcceptance criteria:\n- Export button on the Reports page\n- Download includes all visible columns\n- Date range filter is respected",
    type: "feature_request",
    severity: "low",
    status: "approved",
    reporter_id: "u2",
    assignee_id: null,
    source_url: null,
    created_at: "2026-06-19T16:00:00Z",
    updated_at: "2026-06-20T10:00:00Z",
  },
  {
    id: "BUG-00004",
    title: "API timeout on large dataset queries",
    description:
      "Queries with more than 500 results time out after 30 seconds. The API endpoint /api/tickets needs pagination or a higher timeout limit. This is causing issues for PM reporting workflows.",
    type: "bug",
    severity: "high",
    status: "assigned",
    reporter_id: "u1",
    assignee_id: "u3",
    source_url: "https://app.company.com/dashboard",
    created_at: "2026-06-18T08:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
  },
  {
    id: "BUG-00005",
    title: "User avatar not displaying on profile page",
    description:
      "After uploading a new avatar, the old image continues to display on the profile page until a hard refresh. This is a caching issue.",
    type: "bug",
    severity: "low",
    status: "resolved",
    reporter_id: "u2",
    assignee_id: "u2",
    source_url: "https://app.company.com/profile",
    created_at: "2026-06-17T13:00:00Z",
    updated_at: "2026-06-20T15:00:00Z",
  },
  {
    id: "BUG-00006",
    title: "Add keyboard shortcuts for common actions",
    description:
      "Power users would benefit from keyboard shortcuts: create ticket (Ctrl+N), search (Ctrl+K), navigate views (Ctrl+1-5).",
    type: "feature_request",
    severity: "low",
    status: "submitted",
    reporter_id: "u1",
    assignee_id: null,
    source_url: null,
    created_at: "2026-06-21T15:30:00Z",
    updated_at: "2026-06-21T15:30:00Z",
  },
  {
    id: "BUG-00007",
    title: "Dashboard charts not rendering on Safari",
    description:
      "All Recharts components fail to render on Safari 17. The page shows blank areas where charts should appear. No JavaScript errors in the console.",
    type: "bug",
    severity: "high",
    status: "submitted",
    reporter_id: "u1",
    assignee_id: null,
    source_url: "https://app.company.com/dashboard",
    created_at: "2026-06-22T08:00:00Z",
    updated_at: "2026-06-22T08:00:00Z",
  },
  {
    id: "BUG-00008",
    title: "Email notifications delayed by 10+ minutes",
    description:
      "Assignment and status change email notifications are being delivered 10-15 minutes late. SLA requires delivery within 2 minutes.",
    type: "bug",
    severity: "medium",
    status: "in_review",
    reporter_id: "u2",
    assignee_id: null,
    source_url: null,
    created_at: "2026-06-20T10:00:00Z",
    updated_at: "2026-06-21T09:00:00Z",
  },
  {
    id: "BUG-00009",
    title: "Improve search with fuzzy matching",
    description:
      "The current search requires exact matches. Fuzzy matching would improve discoverability. Consider using Fuse.js or a backend full-text search.",
    type: "feature_request",
    severity: "medium",
    status: "assigned",
    reporter_id: "u1",
    assignee_id: "u3",
    source_url: null,
    created_at: "2026-06-15T14:00:00Z",
    updated_at: "2026-06-18T11:00:00Z",
  },
  {
    id: "BUG-00010",
    title: "Session expires without warning",
    description:
      "Users are logged out abruptly after 30 minutes with no warning. Should show a 'session expiring' modal at the 25-minute mark.",
    type: "bug",
    severity: "critical",
    status: "closed",
    reporter_id: "u1",
    assignee_id: "u2",
    source_url: null,
    created_at: "2026-06-10T09:00:00Z",
    updated_at: "2026-06-15T16:00:00Z",
  },
  {
    id: "BUG-00011",
    title: "File upload fails for PDFs over 5MB",
    description:
      "The screenshot/attachment upload silently fails for files over 5MB. No error message is shown to the user. The limit should be raised to 20MB or an appropriate error displayed.",
    type: "bug",
    severity: "high",
    status: "in_progress",
    reporter_id: "u1",
    assignee_id: "u3",
    source_url: null,
    created_at: "2026-06-21T07:00:00Z",
    updated_at: "2026-06-22T08:00:00Z",
  },
  {
    id: "BUG-00012",
    title: "Integrate Slack notifications",
    description:
      "Post to a configurable Slack channel when a critical bug is submitted or when a ticket is assigned.",
    type: "feature_request",
    severity: "medium",
    status: "rejected",
    reporter_id: "u2",
    assignee_id: null,
    source_url: null,
    created_at: "2026-06-14T10:00:00Z",
    updated_at: "2026-06-16T14:00:00Z",
  },
]

export const MOCK_COMMENTS: TicketComment[] = [
  {
    id: "c1",
    ticket_id: "BUG-00001",
    author_id: "u4",
    body: "This is blocking our enterprise customer demo next Thursday. Marking as critical and assigning to Sam immediately.",
    is_internal: false,
    created_at: "2026-06-20T09:30:00Z",
  },
  {
    id: "c2",
    ticket_id: "BUG-00001",
    author_id: "u2",
    body: "Looking into it. The issue seems to be related to our Content Security Policy blocking inline event handlers. Will have a fix by EOD.",
    is_internal: false,
    created_at: "2026-06-20T10:15:00Z",
  },
  {
    id: "c3",
    ticket_id: "BUG-00001",
    author_id: "u2",
    body: "Root cause confirmed: Firefox strict mode is blocking our event delegation pattern. PR #847 is up for review.",
    is_internal: true,
    created_at: "2026-06-21T14:30:00Z",
  },
  {
    id: "c4",
    ticket_id: "BUG-00004",
    author_id: "u4",
    body: "Assigned to Jordan. Please add pagination to the endpoint — page size of 50 should be fine.",
    is_internal: false,
    created_at: "2026-06-19T09:00:00Z",
  },
]

export const MOCK_AUDIT: AuditEntry[] = [
  { id: "a1", ticket_id: "BUG-00001", changed_by: "u4", old_status: null, new_status: "submitted", changed_at: "2026-06-20T09:15:00Z" },
  { id: "a2", ticket_id: "BUG-00001", changed_by: "u4", old_status: "submitted", new_status: "in_review", changed_at: "2026-06-20T09:25:00Z" },
  { id: "a3", ticket_id: "BUG-00001", changed_by: "u4", old_status: "in_review", new_status: "approved", changed_at: "2026-06-20T09:28:00Z" },
  { id: "a4", ticket_id: "BUG-00001", changed_by: "u4", old_status: "approved", new_status: "assigned", changed_at: "2026-06-20T09:30:00Z" },
  { id: "a5", ticket_id: "BUG-00001", changed_by: "u2", old_status: "assigned", new_status: "in_progress", changed_at: "2026-06-20T10:00:00Z" },
]

export type NotificationType = "assignment" | "status_change" | "comment" | "mention"

export interface Notification {
  id: string
  title: string
  body: string
  read: boolean
  created_at: string
  ticket_id?: string
  type: NotificationType
}

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    title: "New assignment",
    body: "BUG-00011 was assigned to you by Morgan Kim",
    read: false,
    created_at: "2026-06-22T08:10:00Z",
    ticket_id: "BUG-00011",
    type: "assignment",
  },
  {
    id: "n2",
    title: "Status updated",
    body: "BUG-00001 moved to In Progress by Sam Rivera",
    read: false,
    created_at: "2026-06-21T14:30:00Z",
    ticket_id: "BUG-00001",
    type: "status_change",
  },
  {
    id: "n3",
    title: "New comment",
    body: "Sam Rivera commented on BUG-00001: \"Root cause confirmed...\"",
    read: true,
    created_at: "2026-06-20T10:15:00Z",
    ticket_id: "BUG-00001",
    type: "comment",
  },
  {
    id: "n4",
    title: "Ticket approved",
    body: "BUG-00003 was approved by Morgan Kim",
    read: true,
    created_at: "2026-06-20T10:00:00Z",
    ticket_id: "BUG-00003",
    type: "status_change",
  },
  {
    id: "n5",
    title: "New assignment",
    body: "BUG-00004 was assigned to you by Morgan Kim",
    read: true,
    created_at: "2026-06-19T09:00:00Z",
    ticket_id: "BUG-00004",
    type: "assignment",
  },
]

export function getUserById(id: string | null): MockUser | undefined {
  if (!id) return undefined
  return MOCK_USERS.find((u) => u.id === id)
}

export function getTicketById(id: string): Ticket | undefined {
  return MOCK_TICKETS.find((t) => t.id === id)
}

export function getCommentsByTicketId(ticketId: string): TicketComment[] {
  return MOCK_COMMENTS.filter((c) => c.ticket_id === ticketId)
}

export function getAuditByTicketId(ticketId: string): AuditEntry[] {
  return MOCK_AUDIT.filter((a) => a.ticket_id === ticketId)
}

export function getTicketsByReporter(userId: string): Ticket[] {
  return MOCK_TICKETS.filter((t) => t.reporter_id === userId)
}

export function getTicketsByAssignee(userId: string): Ticket[] {
  return MOCK_TICKETS.filter((t) => t.assignee_id === userId)
}
