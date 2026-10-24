"use client"

import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/components/auth-provider"
import { useAppData } from "@/lib/data-store"
import { STATUS_CONFIG, SEVERITY_CONFIG } from "@/lib/ticket-config"
import { UserRole } from "@/lib/types"
import { IconBug, IconCircleCheck, IconClock, IconMail, IconUserCircle } from "@tabler/icons-react"

const DONE_STATUSES = ["merged", "released", "verified", "closed"]

const ROLE_LABELS: Record<UserRole, string> = {
  general: "General User",
  engineer: "Engineer",
  pm: "PM / Admin",
  admin: "PM / Admin",
}

const ROLE_BADGE_VARIANT: Record<UserRole, "default" | "secondary" | "outline"> = {
  pm: "default",
  admin: "default",
  engineer: "secondary",
  general: "outline",
}

export default function ProfilePage() {
  const { user, role } = useAuth()
  const isManager = role === "pm" || role === "admin"
  const { tickets, loading, error } = useAppData()

  const reported = tickets.filter((t) => t.reporter_id === user.id && !t.duplicate_of)
  const assigned = tickets.filter((t) => t.assignee_id === user.id && !t.duplicate_of)
  const resolved = assigned.filter((t) => DONE_STATUSES.includes(t.status))
  const open = assigned.filter((t) => !DONE_STATUSES.includes(t.status) && t.status !== "rejected")

  const recentTickets = [...reported]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5)

  return (
    <>
      <DashboardHeader>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Profile</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DashboardHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0 max-w-3xl">
        {loading && <p className="text-sm text-muted-foreground">Loading profile...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Identity card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 rounded-xl">
                <AvatarFallback className="rounded-xl text-xl font-semibold">{user.initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold">{user.name}</h1>
                  <Badge variant={ROLE_BADGE_VARIANT[role]}>{ROLE_LABELS[role]}</Badge>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                  <IconMail className="size-3.5" />
                  {user.email}
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{reported.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Reported</div>
              </div>
              {role === "engineer" || isManager ? (
                <>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{assigned.length}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Assigned</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{open.length}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Open</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{resolved.length}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Resolved</div>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {reported.filter((t) => DONE_STATUSES.includes(t.status)).length}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Resolved</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IconUserCircle className="size-4" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Full name</span>
              <span className="font-medium">{user.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Role</span>
              <Badge variant={ROLE_BADGE_VARIANT[role]} className="text-xs">{ROLE_LABELS[role]}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">User ID</span>
              <span className="font-mono text-xs text-muted-foreground">{user.id}</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent tickets */}
        {recentTickets.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <IconClock className="size-4" />
                Recent Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Ticket</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead className="pr-6 text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTickets.map((ticket) => {
                    const status = STATUS_CONFIG[ticket.status]
                    const severity = SEVERITY_CONFIG[ticket.severity]
                    return (
                      <TableRow key={ticket.id}>
                        <TableCell className="pl-6">
                          <Link
                            href={`/dashboard/tickets/${ticket.id}`}
                            className="group flex flex-col"
                          >
                            <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                              {ticket.id}
                            </span>
                            <span className="text-sm font-medium line-clamp-1">{ticket.title}</span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={severity.variant} className="text-xs">{severity.label}</Badge>
                        </TableCell>
                        <TableCell className="pr-6 text-right text-xs text-muted-foreground">
                          {new Date(ticket.updated_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Assigned tickets — engineers/PMs only */}
        {(role === "engineer" || isManager) && assigned.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <IconBug className="size-4" />
                Assigned to Me
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Ticket</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead className="pr-6 text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assigned.map((ticket) => {
                    const status = STATUS_CONFIG[ticket.status]
                    const severity = SEVERITY_CONFIG[ticket.severity]
                    return (
                      <TableRow key={ticket.id}>
                        <TableCell className="pl-6">
                          <Link
                            href={`/dashboard/tickets/${ticket.id}`}
                            className="group flex flex-col"
                          >
                            <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                              {ticket.id}
                            </span>
                            <span className="text-sm font-medium line-clamp-1">{ticket.title}</span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={severity.variant} className="text-xs">{severity.label}</Badge>
                        </TableCell>
                        <TableCell className="pr-6 text-right text-xs text-muted-foreground">
                          {new Date(ticket.updated_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Empty state for general users with no tickets */}
        {reported.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <IconCircleCheck className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No tickets submitted yet.</p>
              <Link
                href="/dashboard/tickets/new"
                className="text-sm text-primary hover:underline"
              >
                Submit your first ticket
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
