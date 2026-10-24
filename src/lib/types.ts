export type TicketStatus =
  | "submitted"
  | "triage"
  | "needs_info"
  | "rejected"
  | "backlog"
  | "todo"
  | "assigned"
  | "in_progress"
  | "merged"
  | "released"
  | "verified"
  | "closed"

export type TicketType = "bug" | "feature_request" | "task"
export type TicketSeverity = "critical" | "high" | "medium" | "low"
export type TicketPriority = "p0" | "p1" | "p2" | "p3"
export type UserRole = "general" | "engineer" | "pm" | "admin"
export type RejectionReason =
  | "duplicate"
  | "works_as_designed"
  | "cannot_reproduce"
  | "out_of_scope"
  | "wont_fix_now"

export interface Org {
  id: string
  name: string
  created_at: string
}

export interface Project {
  id: string
  org_id: string
  key: string
  name: string
  repo_url: string | null
  created_at: string
}

export interface Profile {
  id: string
  org_id: string
  email: string
  full_name: string | null
  role: UserRole
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Ticket {
  uuid: string
  id: string
  org_id: string
  project_id: string
  project_key: string | null
  title: string
  description: string
  type: TicketType
  severity: TicketSeverity
  priority: TicketPriority | null
  status: TicketStatus
  reporter_id: string
  assignee_id: string | null
  source_url: string | null
  capture: Record<string, unknown> | null
  capture_schema_version: number
  duplicate_of: string | null
  reporter_count: number
  duplicates_count: number
  sentry_issue_url: string | null
  branch_name: string | null
  pr_url: string | null
  released_in_version: string | null
  rejection_reason: RejectionReason | null
  rejection_note: string | null
  verified_at: string | null
  verified_by: string | null
  created_at: string
  updated_at: string
}

export interface TicketComment {
  id: string
  org_id: string
  ticket_id: string
  author_id: string
  body: string
  is_internal: boolean
  created_at: string
}

export interface AuditEntry {
  id: string
  org_id: string
  ticket_id: string
  changed_by: string | null
  old_status: TicketStatus | null
  new_status: TicketStatus
  old_assignee_id: string | null
  new_assignee_id: string | null
  created_at: string
}

export type NotificationType = "assigned" | "comment" | "status" | "mention" | string

export interface Notification {
  id: string
  org_id: string
  user_id: string
  ticket_id: string | null
  type: NotificationType
  title: string
  body: string
  read: boolean
  created_at: string
}

export interface TicketAttachment {
  id: string
  org_id: string
  ticket_id: string
  kind: "screenshot" | "recording" | "file"
  storage_path: string
  mime_type: string
  size_bytes: number
  duration_ms: number | null
  created_by: string
  created_at: string
  signed_url?: string
}
