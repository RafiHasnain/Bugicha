"use client"

import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/components/auth-provider"
import { useAppData } from "@/lib/data-store"
import { Ticket, TicketStatus } from "@/lib/types"
import { STATUS_CONFIG, SEVERITY_CONFIG, TYPE_CONFIG } from "@/lib/ticket-config"
import { IconArrowRight, IconClipboardList, IconCircleCheck, IconClock } from "@tabler/icons-react"

const ENGINEER_TRANSITIONS: Partial<Record<TicketStatus, { label: string; next: TicketStatus }>> = {
  assigned: { label: "Start Work", next: "in_progress" },
  in_progress: { label: "Mark Merged", next: "merged" },
}

const DONE_STATUSES: TicketStatus[] = ["merged", "released", "verified", "closed"]
const STATUS_ORDER: TicketStatus[] = ["in_progress", "assigned", "merged", "released", "verified", "closed"]

export default function AssignedPage() {
  const { user, role } = useAuth()
  const { getTicketsByAssignee, getUserById, updateTicket, loading, error } = useAppData()

  const tickets = getTicketsByAssignee(user.id).sort((a, b) => {
    return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  })

  const active = tickets.filter((t) => !DONE_STATUSES.includes(t.status))
  const done = tickets.filter((t) => DONE_STATUSES.includes(t.status))

  async function advance(ticketId: string) {
    const cur = tickets.find((ticket) => ticket.id === ticketId)?.status
    if (!cur) return
    const next = ENGINEER_TRANSITIONS[cur]?.next
    if (next) await updateTicket(ticketId, { status: next })
  }

  if (role === "general") {
    return (
      <>
        <DashboardHeader>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Assigned to Me</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </DashboardHeader>
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
        </div>
      </>
    )
  }

  function TicketCard({ ticket }: { ticket: Ticket }) {
    const reporter = getUserById(ticket.reporter_id)
    const currentStatus = ticket.status
    const status = STATUS_CONFIG[currentStatus]
    const severity = SEVERITY_CONFIG[ticket.severity]
    const action = ENGINEER_TRANSITIONS[currentStatus]

    return (
      <div className="flex items-start gap-4 rounded-lg border p-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-xs text-muted-foreground">{ticket.id}</span>
            <Badge variant={severity.variant} className="text-xs">{severity.label}</Badge>
            <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
            <span className="text-xs text-muted-foreground">{TYPE_CONFIG[ticket.type].label}</span>
          </div>
          <Link href={`/dashboard/tickets/${ticket.id}`} className="font-medium hover:underline">
            {ticket.title}
          </Link>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ticket.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            {reporter && (
              <span className="flex items-center gap-1">
                <Avatar className="h-4 w-4 rounded">
                  <AvatarFallback className="rounded text-[9px]">{reporter.initials}</AvatarFallback>
                </Avatar>
                {reporter.name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <IconClock className="size-3" />
              {new Date(ticket.updated_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        {action && (
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => advance(ticket.id)}>
            <IconArrowRight className="size-4 mr-1" />
            {action.label}
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
      <DashboardHeader>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Assigned to Me</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DashboardHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <IconClipboardList className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{active.length}</div>
              <p className="text-xs text-muted-foreground">In queue</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <IconClock className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {active.filter((t) => t.status === "in_progress").length}
              </div>
              <p className="text-xs text-muted-foreground">Currently working</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <IconCircleCheck className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{done.length}</div>
              <p className="text-xs text-muted-foreground">Merged or later</p>
            </CardContent>
          </Card>
        </div>

        {/* Active tickets */}
        <Card>
          <CardHeader>
            <CardTitle>Active Tickets</CardTitle>
            <CardDescription>Tickets assigned to you that need attention</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {loading && <p className="text-sm text-muted-foreground">Loading assigned tickets...</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {active.length === 0 && (
              <div className="flex flex-col items-center py-10 text-muted-foreground gap-2">
                <IconCircleCheck className="size-8" />
                <p className="text-sm">No active tickets. Well done!</p>
              </div>
            )}
            {active.map((t) => <TicketCard key={t.id} ticket={t} />)}
          </CardContent>
        </Card>

        {/* Resolved tickets */}
        {done.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Done</CardTitle>
              <CardDescription>Tickets you have completed</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {done.map((t) => <TicketCard key={t.id} ticket={t} />)}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
