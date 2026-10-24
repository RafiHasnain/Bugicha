"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { DashboardHeader } from "@/components/dashboard-header"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/components/auth-provider"
import { useAppData } from "@/lib/data-store"
import { TicketPriority, TicketStatus } from "@/lib/types"
import { PRIORITY_CONFIG, STATUS_CONFIG, SEVERITY_CONFIG, TYPE_CONFIG } from "@/lib/ticket-config"
import { IconAlertCircle, IconArrowRight, IconMessage, IconCircleCheck, IconClock, IconFlag, IconLink, IconUser } from "@tabler/icons-react"

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function TicketDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { user, role } = useAuth()
  const {
    tickets,
    users,
    loading,
    error,
    getTicketById,
    getCommentsByTicketId,
    getAuditByTicketId,
    getAttachmentsByTicketId,
    getProjectById,
    getUserById,
    updateTicket,
    mergeDuplicate,
    createComment,
  } = useAppData()

  const ticket = getTicketById(id)
  const isManager = role === "pm" || role === "admin"
  const [commentBody, setCommentBody] = useState("")
  const [duplicateTargetId, setDuplicateTargetId] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const comments = getCommentsByTicketId(id)
  const audit = getAuditByTicketId(id)
  const attachments = getAttachmentsByTicketId(id)
  const engineers = users.filter((u) => u.role === "engineer")

  async function persistTicket(patch: { status?: TicketStatus; assignee_id?: string | null; priority?: TicketPriority | null; rejection_reason?: "wont_fix_now"; rejection_note?: string }) {
    if (!ticket) return
    setSaving(true)
    setSaveError(null)
    try {
      await updateTicket(ticket.id, patch)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save ticket.")
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(next: TicketStatus) {
    await persistTicket({ status: next })
  }

  async function changeAssignee(next: string) {
    const assigneeId = next === "unassigned" ? null : next
    const nextStatus = assigneeId && ticket?.status === "todo" ? "assigned" : ticket?.status
    if (!nextStatus) return
    await persistTicket({ assignee_id: assigneeId, status: nextStatus })
  }

  async function rejectTicket() {
    const note = window.prompt("Rejection note")
    if (!note?.trim()) return
    await persistTicket({
      status: "rejected",
      rejection_reason: "wont_fix_now",
      rejection_note: note.trim(),
    })
    await createComment(id, note.trim())
  }

  async function askForInfo() {
    const question = window.prompt("Question for the reporter")
    if (!question?.trim()) return
    await createComment(id, question.trim())
    await changeStatus("needs_info")
  }

  async function mergeIntoDuplicate() {
    if (!ticket || !duplicateTargetId) return
    setSaving(true)
    setSaveError(null)
    try {
      await mergeDuplicate(ticket.id, duplicateTargetId)
      setDuplicateTargetId("")
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not merge duplicate.")
    } finally {
      setSaving(false)
    }
  }

  async function submitComment() {
    const body = commentBody.trim()
    if (!body) return
    setSaving(true)
    setSaveError(null)
    try {
      await createComment(id, body)
      setCommentBody("")
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not add comment.")
    } finally {
      setSaving(false)
    }
  }

  if (!ticket) {
    return (
      <>
        <DashboardHeader>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/tickets">Tickets</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>Not Found</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </DashboardHeader>
        <div className="flex flex-1 items-center justify-center p-4">
          <p className={error ? "text-destructive" : "text-muted-foreground"}>
            {loading ? "Loading ticket..." : error || "Ticket not found."}
          </p>
        </div>
      </>
    )
  }

  const reporter = getUserById(ticket.reporter_id)
  const assignee = getUserById(ticket.assignee_id)
  const project = getProjectById(ticket.project_id)
  const status = STATUS_CONFIG[ticket.status]
  const severity = SEVERITY_CONFIG[ticket.severity]
  const priority = ticket.priority ? PRIORITY_CONFIG[ticket.priority] : null

  const ENGINEER_ACTIONS: Partial<Record<TicketStatus, { label: string; next: TicketStatus }>> = {
    assigned:    { label: "Start Work",     next: "in_progress" },
    in_progress: { label: "Mark Merged",    next: "merged" },
  }

  const PM_STATUS_ACTIONS: Partial<Record<TicketStatus, { approve?: TicketStatus; reject?: TicketStatus }>> = {
    submitted: { approve: "triage", reject: "rejected" },
    triage: { approve: "backlog", reject: "rejected" },
    needs_info: { approve: "triage", reject: "rejected" },
    backlog: { approve: "todo", reject: "rejected" },
    todo: { approve: "assigned", reject: "rejected" },
    merged: { approve: "released" },
    verified: { approve: "closed" },
  }

  const pmActions = PM_STATUS_ACTIONS[ticket.status]
  const engineerAction = role === "engineer" && ticket.assignee_id === user.id
    ? ENGINEER_ACTIONS[ticket.status]
    : undefined

  const isReporter = ticket.reporter_id === user.id
  const showTopRight = (isManager && pmActions) || isManager || engineerAction || (isReporter && ticket.status === "released")

  return (
    <>
      <DashboardHeader>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/dashboard/tickets">Tickets</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem><BreadcrumbPage>{ticket.id}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DashboardHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">

        {/* ── Header row: ticket identity (left) + actions/assignee (right) ── */}
        <div className="flex items-start gap-6">
          {/* Left: identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground">{ticket.id}</span>
              <Badge variant={status.variant}>{status.label}</Badge>
              <Badge variant={severity.variant}>{severity.label}</Badge>
              <Badge variant="outline">{TYPE_CONFIG[ticket.type].label}</Badge>
            </div>
            <h1 className="text-2xl font-bold mt-1 leading-tight">{ticket.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Reported by {reporter?.name} · {formatDate(ticket.created_at)}
            </p>
          </div>

          {/* Right: bare actions + assignee */}
          {showTopRight && (
            <div className="shrink-0 flex items-center gap-2">
              {/* PM: assignee selector */}
              {isManager && (
                <Select value={ticket.assignee_id ?? "unassigned"} onValueChange={changeAssignee}>
                  <SelectTrigger className="w-44 h-8 text-sm">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {engineers.map((eng) => (
                      <SelectItem key={eng.id} value={eng.id}>{eng.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* PM approve / reject */}
              {isManager && pmActions && (
                <>
                  {ticket.status !== "needs_info" && ticket.status !== "rejected" && (
                    <Button size="sm" variant="outline" disabled={saving} onClick={askForInfo}>
                      Needs Info
                    </Button>
                  )}
                  {pmActions.approve && (
                    <Button size="sm" disabled={saving} onClick={() => changeStatus(pmActions.approve!)}>
                      <IconCircleCheck className="size-4 mr-1.5" />
                      {ticket.status === "submitted" || ticket.status === "triage" ? "Approve" : "Move Forward"}
                    </Button>
                  )}
                  {pmActions.reject && (
                    <Button size="sm" variant="destructive" disabled={saving} onClick={rejectTicket}>
                      <IconAlertCircle className="size-4 mr-1.5" />
                      Reject
                    </Button>
                  )}
                </>
              )}

              {/* Engineer action */}
              {engineerAction && (
                <Button size="sm" disabled={saving} onClick={() => changeStatus(engineerAction.next)}>
                  <IconArrowRight className="size-4 mr-1.5" />
                  {engineerAction.label}
                </Button>
              )}

              {isReporter && ticket.status === "released" && (
                <>
                  <Button size="sm" disabled={saving} onClick={() => changeStatus("verified")}>
                    Confirm fix
                  </Button>
                  <Button size="sm" variant="outline" disabled={saving} onClick={() => changeStatus("triage")}>
                    Still broken
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {saveError && <p className="text-sm text-destructive">{saveError}</p>}

        {/* ── Main content grid ── */}
        <div className="grid gap-4 lg:grid-cols-3">

          {/* Left: description + comments */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Description */}
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
                {ticket.source_url && (
                  <div className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <IconLink className="size-3.5" />
                    <a href={ticket.source_url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                      {ticket.source_url}
                    </a>
                  </div>
                )}
                {attachments.length > 0 && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={attachment.signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border p-2 text-sm hover:bg-accent"
                      >
                        {attachment.kind} · {(attachment.size_bytes / 1024 / 1024).toFixed(1)} MB
                      </a>
                    ))}
                  </div>
                )}
                {ticket.capture && (
                  <details className="mt-4 rounded-md border p-3 text-sm">
                    <summary className="cursor-pointer font-medium">Capture</summary>
                    <dl className="mt-3 grid gap-2">
                      {Object.entries(ticket.capture).map(([key, value]) => (
                        <div key={key} className="grid gap-1 sm:grid-cols-3">
                          <dt className="text-muted-foreground">{key}</dt>
                          <dd className="sm:col-span-2 break-all">
                            {typeof value === "object" ? JSON.stringify(value) : String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
              </CardContent>
            </Card>

            {/* Comments */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <IconMessage className="size-4" />
                  Comments
                  {comments.length > 0 && (
                    <Badge variant="secondary" className="text-xs rounded-full h-5 min-w-5 px-1.5">
                      {comments.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {comments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
                )}
                {comments.map((comment) => {
                  const author = getUserById(comment.author_id)
                  return (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="h-7 w-7 rounded-lg shrink-0 mt-0.5">
                        <AvatarFallback className="rounded-lg text-xs">{author?.initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{author?.name}</span>
                          {comment.is_internal && (
                            <Badge variant="outline" className="text-xs">Internal</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{comment.body}</p>
                      </div>
                    </div>
                  )
                })}

                <Separator />

                {/* Add comment */}
                <div className="flex gap-3">
                  <Avatar className="h-7 w-7 rounded-lg shrink-0 mt-1">
                    <AvatarFallback className="rounded-lg text-xs">{user.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 flex flex-col gap-2">
                    <Textarea
                      placeholder="Add a comment…"
                      rows={3}
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <Button size="sm" disabled={saving} onClick={submitComment}>
                        <IconMessage className="size-4 mr-2" />
                        Comment
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Right: details + activity */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Project</span>
                  <span>{project?.key ?? "WEB"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Priority</span>
                  {isManager ? (
                    <Select
                      value={ticket.priority ?? "none"}
                      onValueChange={(value) => persistTicket({ priority: value === "none" ? null : value as TicketPriority })}
                    >
                      <SelectTrigger className="h-8 w-24">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="p0">P0</SelectItem>
                        <SelectItem value="p1">P1</SelectItem>
                        <SelectItem value="p2">P2</SelectItem>
                        <SelectItem value="p3">P3</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span>{priority?.label ?? "None"}</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Reporters</span>
                  <span>{ticket.reporter_count}</span>
                </div>
                {ticket.duplicates_count > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Duplicates</span>
                    <span>{ticket.duplicates_count} merged</span>
                  </div>
                )}
                {isManager && !ticket.duplicate_of && (
                  <div className="space-y-2">
                    <span className="text-muted-foreground">Duplicate</span>
                    <div className="flex gap-2">
                      <Select value={duplicateTargetId} onValueChange={setDuplicateTargetId}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Merge into…" />
                        </SelectTrigger>
                        <SelectContent>
                          {tickets
                            .filter((item) => item.uuid !== ticket.uuid && !item.duplicate_of)
                            .map((item) => (
                              <SelectItem key={item.uuid} value={item.id}>
                                {item.id}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" disabled={saving || !duplicateTargetId} onClick={mergeIntoDuplicate}>
                        Merge
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <IconFlag className="size-3.5" />
                    Status
                  </span>
                  <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <IconAlertCircle className="size-3.5" />
                    Severity
                  </span>
                  <Badge variant={severity.variant} className="text-xs">{severity.label}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span>{TYPE_CONFIG[ticket.type].label}</span>
                </div>
                {reporter && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <IconUser className="size-3.5" />
                      Reporter
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px]">{reporter.initials}</AvatarFallback>
                      </Avatar>
                      <span>{reporter.name}</span>
                    </div>
                  </div>
                )}
                {assignee && !isManager && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Assignee</span>
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px]">{assignee.initials}</AvatarFallback>
                      </Avatar>
                      <span>{assignee.name}</span>
                    </div>
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Created</span>
                  <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Updated</span>
                  <span>{new Date(ticket.updated_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Activity */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <IconClock className="size-4" />
                  Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {audit.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No activity yet.</p>
                )}
                {audit.map((entry) => {
                  const actor = getUserById(entry.changed_by)
                  return (
                    <div key={entry.id} className="flex items-start gap-2 text-sm">
                      <Avatar className="h-6 w-6 rounded shrink-0 mt-0.5">
                        <AvatarFallback className="rounded text-[10px]">{actor?.initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-sm leading-relaxed">
                        <span className="font-medium">{actor?.name}</span>{" "}
                        {entry.old_status ? (
                          <>
                            moved from{" "}
                            <Badge variant="outline" className="text-xs">{STATUS_CONFIG[entry.old_status].label}</Badge>
                            {" "}to{" "}
                            <Badge variant={STATUS_CONFIG[entry.new_status].variant} className="text-xs">{STATUS_CONFIG[entry.new_status].label}</Badge>
                          </>
                        ) : (
                          <>submitted this ticket</>
                        )}
                        <div className="text-muted-foreground text-xs mt-0.5">{formatDate(entry.created_at)}</div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
