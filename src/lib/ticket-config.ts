import { TicketPriority, TicketStatus, TicketType, TicketSeverity } from "./types"

export const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  submitted: { label: "Submitted", variant: "secondary" },
  triage: { label: "Triage", variant: "default" },
  needs_info: { label: "Needs Info", variant: "secondary" },
  rejected: { label: "Rejected", variant: "destructive" },
  backlog: { label: "Backlog", variant: "secondary" },
  todo: { label: "Todo", variant: "default" },
  assigned: { label: "Assigned", variant: "default" },
  in_progress: { label: "In Progress", variant: "default" },
  merged: { label: "Merged", variant: "outline" },
  released: { label: "Released", variant: "outline" },
  verified: { label: "Verified", variant: "outline" },
  closed: { label: "Closed", variant: "outline" },
}

export const SEVERITY_CONFIG: Record<
  TicketSeverity,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  critical: { label: "Critical", variant: "destructive" },
  high: { label: "High", variant: "default" },
  medium: { label: "Medium", variant: "secondary" },
  low: { label: "Low", variant: "outline" },
}

export const TYPE_CONFIG: Record<TicketType, { label: string }> = {
  bug: { label: "Bug" },
  feature_request: { label: "Feature Request" },
  task: { label: "Task" },
}

export const PRIORITY_CONFIG: Record<TicketPriority, { label: string; rank: number }> = {
  p0: { label: "P0", rank: 0 },
  p1: { label: "P1", rank: 1 },
  p2: { label: "P2", rank: 2 },
  p3: { label: "P3", rank: 3 },
}

export function ticketPriorityRank(priority: TicketPriority | null) {
  return priority ? PRIORITY_CONFIG[priority].rank : 99
}

export const STATUS_ORDER: TicketStatus[] = [
  "submitted",
  "triage",
  "needs_info",
  "backlog",
  "todo",
  "assigned",
  "in_progress",
  "merged",
  "released",
  "verified",
  "closed",
]

export const KANBAN_COLUMNS: { status: TicketStatus; label: string }[] = [
  { status: "todo", label: "Todo" },
  { status: "assigned", label: "Assigned" },
  { status: "in_progress", label: "In Progress" },
  { status: "merged", label: "Merged" },
  { status: "released", label: "Released" },
  { status: "verified", label: "Verified" },
  { status: "closed", label: "Closed" },
]
