"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/components/auth-provider"
import { useAppData } from "@/lib/data-store"
import { TicketStatus, TicketSeverity, TicketType } from "@/lib/types"
import { PRIORITY_CONFIG, STATUS_CONFIG, SEVERITY_CONFIG, TYPE_CONFIG } from "@/lib/ticket-config"
import { IconPlus, IconSearch } from "@tabler/icons-react"

export default function TicketsPage() {
  const { user, role } = useAuth()
  const { projects, tickets: allTickets, loading, error, getUserById, getProjectById, getTicketsByReporter } = useAppData()
  const [search, setSearch] = useState("")
  const [filterProject, setFilterProject] = useState("all")
  const [filterType, setFilterType] = useState<"all" | TicketType>("all")
  const [filterSeverity, setFilterSeverity] = useState<"all" | TicketSeverity>("all")
  const [filterStatus, setFilterStatus] = useState<"all" | TicketStatus>("all")

  const sourceTickets = useMemo(() => {
    const visible = allTickets.filter((ticket) => !ticket.duplicate_of)
    if (role === "general") return getTicketsByReporter(user.id).filter((ticket) => !ticket.duplicate_of)
    return visible
  }, [allTickets, getTicketsByReporter, role, user.id])

  const tickets = useMemo(() => {
    return sourceTickets.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.id.toLowerCase().includes(search.toLowerCase())) {
        return false
      }
      if (filterType !== "all" && t.type !== filterType) return false
      if (filterProject !== "all" && t.project_id !== filterProject) return false
      if (filterSeverity !== "all" && t.severity !== filterSeverity) return false
      if (filterStatus !== "all" && t.status !== filterStatus) return false
      return true
    })
  }, [sourceTickets, search, filterProject, filterType, filterSeverity, filterStatus])

  const pageTitle = role === "general" ? "My Tickets" : "All Tickets"

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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{pageTitle}</CardTitle>
              <CardDescription>
                {loading ? "Loading tickets..." : `${tickets.length} ticket${tickets.length !== 1 ? "s" : ""} found`}
              </CardDescription>
              {error && <p className="text-sm text-destructive mt-1">{error}</p>}
            </div>
            <Button size="sm" asChild>
              <Link href="/dashboard/tickets/new">
                <IconPlus className="size-4 mr-2" />
                Submit Ticket
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {/* Filter bar */}
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="relative flex-1 min-w-48">
                <IconSearch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as "all" | TicketType)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="feature_request">Feature Request</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterSeverity} onValueChange={(v) => setFilterSeverity(v as "all" | TicketSeverity)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | TicketStatus)}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="triage">Triage</SelectItem>
                  <SelectItem value="needs_info">Needs Info</SelectItem>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="todo">Todo</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="merged">Merged</SelectItem>
                  <SelectItem value="released">Released</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-24">Project</TableHead>
                    <TableHead className="w-32">Type</TableHead>
                    <TableHead className="w-24">Priority</TableHead>
                    <TableHead className="w-24">Severity</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-32 hidden md:table-cell">Reporter</TableHead>
                    <TableHead className="w-32 hidden lg:table-cell">Assignee</TableHead>
                    <TableHead className="w-28 hidden lg:table-cell">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                        No tickets match your filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {tickets.map((ticket) => {
                    const reporter = getUserById(ticket.reporter_id)
                    const assignee = getUserById(ticket.assignee_id)
                    const status = STATUS_CONFIG[ticket.status]
                    const severity = SEVERITY_CONFIG[ticket.severity]
                    const type = TYPE_CONFIG[ticket.type]
                    const project = getProjectById(ticket.project_id)
                    return (
                      <TableRow key={ticket.id} className="cursor-pointer hover:bg-accent/50" onClick={() => {}}>
                        <TableCell>
                          <Link
                            href={`/dashboard/tickets/${ticket.id}`}
                            className="font-mono text-xs text-muted-foreground hover:text-foreground"
                          >
                            {ticket.id}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/dashboard/tickets/${ticket.id}`}
                            className="font-medium hover:underline line-clamp-1"
                          >
                            {ticket.title}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{project?.key ?? ticket.project_key}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{type.label}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {ticket.priority ? PRIORITY_CONFIG[ticket.priority].label : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={severity.variant} className="text-xs">
                            {severity.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="text-xs">
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {reporter && (
                            <div className="flex items-center gap-1.5">
                              <Avatar className="h-5 w-5 rounded">
                                <AvatarFallback className="rounded text-[10px]">{reporter.initials}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm truncate">{reporter.name}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {assignee ? (
                            <div className="flex items-center gap-1.5">
                              <Avatar className="h-5 w-5 rounded">
                                <AvatarFallback className="rounded text-[10px]">{assignee.initials}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm truncate">{assignee.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
