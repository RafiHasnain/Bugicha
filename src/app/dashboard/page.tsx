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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/components/auth-provider"
import { useAppData } from "@/lib/data-store"
import { Ticket } from "@/lib/types"
import { STATUS_CONFIG, SEVERITY_CONFIG } from "@/lib/ticket-config"
import { IconPlus, IconAlertCircle, IconClipboardList, IconBug, IconCircleCheck, IconClock, IconInbox } from "@tabler/icons-react"

const DONE_STATUSES = ["merged", "released", "verified", "closed"]
const REVIEW_STATUSES = ["submitted", "triage", "needs_info"]

function TicketRow({ ticket }: { ticket: Ticket }) {
  const status = STATUS_CONFIG[ticket.status]
  const severity = SEVERITY_CONFIG[ticket.severity]
  return (
    <Link
      href={`/dashboard/tickets/${ticket.id}`}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-accent transition-colors"
    >
      <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">{ticket.id}</span>
      <span className="flex-1 truncate font-medium">{ticket.title}</span>
      <Badge variant={severity.variant} className="shrink-0 text-xs">
        {severity.label}
      </Badge>
      <Badge variant={status.variant} className="shrink-0 text-xs">
        {status.label}
      </Badge>
      <span className="text-xs text-muted-foreground shrink-0 hidden md:block">
        {new Date(ticket.created_at).toLocaleDateString()}
      </span>
    </Link>
  )
}

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string
  value: string | number
  description?: string
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  )
}

function GeneralDashboard({ userId }: { userId: string }) {
  const { getTicketsByReporter } = useAppData()
  const myTickets = getTicketsByReporter(userId).filter((t) => !t.duplicate_of)
  const open = myTickets.filter((t) => !DONE_STATUSES.includes(t.status) && t.status !== "rejected")
  const resolved = myTickets.filter((t) => DONE_STATUSES.includes(t.status))
  return (
    <>
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <StatCard
          title="Total Submitted"
          value={myTickets.length}
          description="All time"
          icon={<IconBug className="size-4" />}
        />
        <StatCard
          title="Open"
          value={open.length}
          description="Awaiting resolution"
          icon={<IconClock className="size-4" />}
        />
        <StatCard
          title="Resolved"
          value={resolved.length}
          description="Closed tickets"
          icon={<IconCircleCheck className="size-4" />}
        />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>My Tickets</CardTitle>
            <CardDescription>Tickets you have submitted</CardDescription>
          </div>
          <Button size="sm" asChild>
            <Link href="/dashboard/tickets/new">
              <IconPlus className="size-4 mr-2" />
              Submit Ticket
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {myTickets.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No tickets submitted yet.</p>
            )}
            {myTickets.slice(0, 8).map((t) => (
              <TicketRow key={t.id} ticket={t} />
            ))}
          </div>
          {myTickets.length > 8 && (
            <div className="p-3 border-t">
              <Link href="/dashboard/tickets" className="text-sm text-primary hover:underline">
                View all {myTickets.length} tickets →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function EngineerDashboard({ userId }: { userId: string }) {
  const { getTicketsByAssignee, getTicketsByReporter } = useAppData()
  const assigned = getTicketsByAssignee(userId).filter((t) => !t.duplicate_of)
  const myTickets = getTicketsByReporter(userId).filter((t) => !t.duplicate_of)
  const inProgress = assigned.filter((t) => t.status === "in_progress")
  const resolved = assigned.filter((t) => DONE_STATUSES.includes(t.status))

  return (
    <>
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <StatCard
          title="Assigned to Me"
          value={assigned.length}
          description="Tickets in your queue"
          icon={<IconClipboardList className="size-4" />}
        />
        <StatCard
          title="In Progress"
          value={inProgress.length}
          description="Currently working on"
          icon={<IconClock className="size-4" />}
        />
        <StatCard
          title="Resolved"
          value={resolved.length}
          description="Tickets you closed"
          icon={<IconCircleCheck className="size-4" />}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>My Work</CardTitle>
          <CardDescription>Assigned tickets and your submissions</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="assigned">
            <TabsList className="mx-4 mb-2">
              <TabsTrigger value="assigned">Assigned to Me</TabsTrigger>
              <TabsTrigger value="mine">My Submissions</TabsTrigger>
            </TabsList>
            <TabsContent value="assigned" className="divide-y mt-0">
              {assigned.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8 px-4">No tickets assigned to you.</p>
              )}
              {assigned.map((t) => (
                <TicketRow key={t.id} ticket={t} />
              ))}
            </TabsContent>
            <TabsContent value="mine" className="divide-y mt-0">
              {myTickets.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8 px-4">No tickets submitted.</p>
              )}
              {myTickets.map((t) => (
                <TicketRow key={t.id} ticket={t} />
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  )
}

function PMDashboard() {
  const { tickets, users } = useAppData()
  const all = tickets.filter((t) => !t.duplicate_of)
  const awaiting = all.filter((t) => REVIEW_STATUSES.includes(t.status))
  const open = all.filter((t) => !DONE_STATUSES.includes(t.status) && t.status !== "rejected")
  const resolved = all.filter((t) => DONE_STATUSES.includes(t.status))
  const critical = all.filter((t) => t.severity === "critical" && !["closed", "rejected"].includes(t.status))

  const engineers = users.filter((u) => u.role === "engineer")

  return (
    <>
      <div className="grid auto-rows-min gap-4 md:grid-cols-4">
        <StatCard
          title="Awaiting Review"
          value={awaiting.length}
          description="Need your attention"
          icon={<IconInbox className="size-4" />}
        />
        <StatCard
          title="Total Open"
          value={open.length}
          description="Unresolved tickets"
          icon={<IconBug className="size-4" />}
        />
        <StatCard
          title="Resolved"
          value={resolved.length}
          description="Closed tickets"
          icon={<IconCircleCheck className="size-4" />}
        />
        <StatCard
          title="Critical Open"
          value={critical.length}
          description="Needs immediate attention"
          icon={<IconAlertCircle className="size-4" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Review Queue</CardTitle>
              <CardDescription>Tickets awaiting your review</CardDescription>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/review">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {awaiting.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No tickets awaiting review.</p>
              )}
              {awaiting.slice(0, 5).map((t) => (
                <TicketRow key={t.id} ticket={t} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Engineer Workload</CardTitle>
            <CardDescription>Assigned tickets per engineer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {engineers.map((eng) => {
              const count = all.filter(
                (t) => t.assignee_id === eng.id && !DONE_STATUSES.includes(t.status)
              ).length
              return (
                <div key={eng.id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 rounded-lg shrink-0">
                    <AvatarFallback className="rounded-lg text-xs">{eng.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{eng.name}</p>
                    <p className="text-xs text-muted-foreground">{count} open tickets</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {count}
                  </Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default function DashboardPage() {
  const { user, role } = useAuth()
  const { loading, error } = useAppData()
  const isManager = role === "pm" || role === "admin"

  const pageTitle =
    role === "general" ? "My Reports" : role === "engineer" ? "My Workspace" : "Overview"

  return (
    <>
      <DashboardHeader>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DashboardHeader>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {loading && <p className="text-sm text-muted-foreground">Loading dashboard...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {role === "general" && <GeneralDashboard userId={user.id} />}
        {role === "engineer" && <EngineerDashboard userId={user.id} />}
        {isManager && <PMDashboard />}
      </div>
    </>
  )
}
