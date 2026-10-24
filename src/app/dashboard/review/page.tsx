"use client"

import { useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/components/auth-provider"
import { useAppData } from "@/lib/data-store"
import { RejectionReason, TicketStatus } from "@/lib/types"
import { STATUS_CONFIG, SEVERITY_CONFIG, TYPE_CONFIG, ticketPriorityRank } from "@/lib/ticket-config"
import { IconAlertCircle, IconCircleCheck, IconInbox } from "@tabler/icons-react"

const REJECTION_REASONS: { value: RejectionReason; label: string }[] = [
  { value: "duplicate", label: "Duplicate" },
  { value: "works_as_designed", label: "Works as Designed" },
  { value: "cannot_reproduce", label: "Cannot Reproduce" },
  { value: "out_of_scope", label: "Out of Scope" },
  { value: "wont_fix_now", label: "Won't Fix Now" },
]

export default function ReviewQueuePage() {
  const { role } = useAuth()
  const isManager = role === "pm" || role === "admin"
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [projectId, setProjectId] = useState("all")
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<RejectionReason | "">("")
  const [rejectNote, setRejectNote] = useState("")
  const { projects, tickets, users, loading, error, getUserById, updateTicket, createComment } = useAppData()

  const engineers = users.filter((u) => u.role === "engineer")

  if (!isManager) {
    return (
      <>
        <DashboardHeader>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Review Queue</BreadcrumbPage>
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

  const queueTickets = tickets.filter((t) =>
    ["submitted", "triage", "needs_info"].includes(t.status) &&
    !t.duplicate_of &&
    (projectId === "all" || t.project_id === projectId)
  ).sort((a, b) => ticketPriorityRank(a.priority) - ticketPriorityRank(b.priority))

  async function approve(ticketId: string) {
    const cur = tickets.find((ticket) => ticket.id === ticketId)?.status
    const next: TicketStatus = cur === "submitted" ? "triage" : "backlog"
    await updateTicket(ticketId, { status: next })
  }

  async function reject(ticketId: string) {
    if (!rejectReason || !rejectNote.trim()) return
    await updateTicket(ticketId, {
      status: "rejected",
      rejection_reason: rejectReason,
      rejection_note: rejectNote.trim(),
    })
    await createComment(ticketId, rejectNote.trim(), false)
    setRejectDialogId(null)
    setRejectReason("")
    setRejectNote("")
  }

  async function approveSelected() {
    await Promise.all([...selectedIds].map((id) => approve(id)))
    setSelectedIds(new Set())
  }

  async function rejectSelected() {
    await Promise.all([...selectedIds].map((id) => updateTicket(id, {
      status: "rejected",
      rejection_reason: "wont_fix_now",
      rejection_note: "Rejected during bulk review.",
    })))
    setSelectedIds(new Set())
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === queueTickets.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(queueTickets.map((t) => t.id)))
    }
  }

  return (
    <>
      <DashboardHeader>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Review Queue</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DashboardHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IconInbox className="size-5" />
                Review Queue
              </CardTitle>
              <CardDescription>
                {loading ? "Loading review queue..." : `${queueTickets.length} ticket${queueTickets.length !== 1 ? "s" : ""} awaiting review · sorted by priority`}
              </CardDescription>
              {error && <p className="text-sm text-destructive mt-1">{error}</p>}
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                <Button size="sm" onClick={approveSelected}>
                  <IconCircleCheck className="size-4 mr-2" />
                  Approve All
                </Button>
                <Button size="sm" variant="destructive" onClick={rejectSelected}>
                  <IconAlertCircle className="size-4 mr-2" />
                  Reject All
                </Button>
              </div>
            )}
            <Select value={projectId} onValueChange={setProjectId}>
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
          </CardHeader>
          <CardContent className="p-0">
            {queueTickets.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <IconCircleCheck className="size-8" />
                <p className="text-sm">All caught up! No tickets in the queue.</p>
              </div>
            )}

            {queueTickets.length > 0 && (
              <div className="divide-y">
                {/* Select all header */}
                <div className="flex items-center gap-3 px-4 py-2 bg-muted/30">
                  <Checkbox
                    checked={selectedIds.size === queueTickets.length && queueTickets.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-xs text-muted-foreground">Select all</span>
                </div>

                {queueTickets.map((ticket) => {
                  const reporter = getUserById(ticket.reporter_id)
                  const severity = SEVERITY_CONFIG[ticket.severity]
                  const status = STATUS_CONFIG[ticket.status]
                  const isSelected = selectedIds.has(ticket.id)

                  return (
                    <div
                      key={ticket.id}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors ${isSelected ? "bg-accent/30" : "hover:bg-accent/20"}`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(ticket.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Link
                            href={`/dashboard/tickets/${ticket.id}`}
                            className="font-mono text-xs text-muted-foreground hover:text-foreground"
                          >
                            {ticket.id}
                          </Link>
                          <Badge variant={severity.variant} className="text-xs">{severity.label}</Badge>
                          <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                          <span className="text-xs text-muted-foreground">{TYPE_CONFIG[ticket.type].label}</span>
                        </div>
                        <Link
                          href={`/dashboard/tickets/${ticket.id}`}
                          className="font-medium text-sm hover:underline line-clamp-1"
                        >
                          {ticket.title}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {ticket.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          {reporter && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Avatar className="h-4 w-4 rounded">
                                <AvatarFallback className="rounded text-[9px]">{reporter.initials}</AvatarFallback>
                              </Avatar>
                              {reporter.name}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Assignee selector */}
                      <Select
                        value={ticket.assignee_id ?? "unassigned"}
                        onValueChange={(v) => updateTicket(ticket.id, { assignee_id: v === "unassigned" ? null : v })}
                      >
                        <SelectTrigger className="w-36 shrink-0 h-8 text-xs">
                          <SelectValue placeholder="Assign to…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {engineers.map((eng) => (
                            <SelectItem key={eng.id} value={eng.id}>
                              {eng.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => approve(ticket.id)}>
                          <IconCircleCheck className="size-3.5 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-destructive hover:text-destructive"
                          onClick={() => setRejectDialogId(ticket.id)}
                        >
                          <IconAlertCircle className="size-3.5 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reject dialog */}
      <Dialog open={!!rejectDialogId} onOpenChange={() => setRejectDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Ticket</DialogTitle>
            <DialogDescription>
              Provide a reason and note. The reporter will be notified in the thread.
            </DialogDescription>
          </DialogHeader>
          <Select value={rejectReason} onValueChange={(value) => setRejectReason(value as RejectionReason)}>
            <SelectTrigger>
              <SelectValue placeholder="Reason" />
            </SelectTrigger>
            <SelectContent>
              {REJECTION_REASONS.map((reason) => (
                <SelectItem key={reason.value} value={reason.value}>{reason.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Rejection note…"
            rows={4}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectReason || !rejectNote.trim()} onClick={() => rejectDialogId && reject(rejectDialogId)}>
              Reject Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
