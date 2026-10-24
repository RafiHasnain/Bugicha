"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
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
import { Ticket, TicketStatus } from "@/lib/types"
import { SEVERITY_CONFIG, TYPE_CONFIG, KANBAN_COLUMNS } from "@/lib/ticket-config"
import { cn } from "@/lib/utils"
import { IconBug, IconStar, IconChecklist } from "@tabler/icons-react"

// ── Status color palette ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<TicketStatus, {
  header: string
  headerText: string
  dot: string
  dropzone: string
  dropzoneOver: string
}> = {
  submitted:   { header: "bg-slate-100",   headerText: "text-slate-700",   dot: "bg-slate-400",   dropzone: "border-slate-200 bg-slate-50/60",    dropzoneOver: "border-slate-400 bg-slate-100" },
  triage:      { header: "bg-blue-100",    headerText: "text-blue-700",    dot: "bg-blue-500",    dropzone: "border-blue-200 bg-blue-50/60",      dropzoneOver: "border-blue-400 bg-blue-100" },
  needs_info:  { header: "bg-slate-100",   headerText: "text-slate-700",   dot: "bg-slate-400",   dropzone: "border-slate-200 bg-slate-50/60",    dropzoneOver: "border-slate-400 bg-slate-100" },
  backlog:     { header: "bg-cyan-100",    headerText: "text-cyan-700",    dot: "bg-cyan-500",    dropzone: "border-cyan-200 bg-cyan-50/60",      dropzoneOver: "border-cyan-400 bg-cyan-100" },
  todo:        { header: "bg-cyan-100",    headerText: "text-cyan-700",    dot: "bg-cyan-500",    dropzone: "border-cyan-200 bg-cyan-50/60",      dropzoneOver: "border-cyan-400 bg-cyan-100" },
  assigned:    { header: "bg-violet-100",  headerText: "text-violet-700",  dot: "bg-violet-500",  dropzone: "border-violet-200 bg-violet-50/60",  dropzoneOver: "border-violet-400 bg-violet-100" },
  in_progress: { header: "bg-amber-100",   headerText: "text-amber-700",   dot: "bg-amber-500",   dropzone: "border-amber-200 bg-amber-50/60",    dropzoneOver: "border-amber-400 bg-amber-100" },
  merged:      { header: "bg-green-100",   headerText: "text-green-700",   dot: "bg-green-500",   dropzone: "border-green-200 bg-green-50/60",    dropzoneOver: "border-green-400 bg-green-100" },
  released:    { header: "bg-green-100",   headerText: "text-green-700",   dot: "bg-green-500",   dropzone: "border-green-200 bg-green-50/60",    dropzoneOver: "border-green-400 bg-green-100" },
  verified:    { header: "bg-green-100",   headerText: "text-green-700",   dot: "bg-green-500",   dropzone: "border-green-200 bg-green-50/60",    dropzoneOver: "border-green-400 bg-green-100" },
  closed:      { header: "bg-gray-100",    headerText: "text-gray-600",    dot: "bg-gray-400",    dropzone: "border-gray-200 bg-gray-50/60",      dropzoneOver: "border-gray-400 bg-gray-100" },
  rejected:    { header: "bg-red-100",     headerText: "text-red-700",     dot: "bg-red-500",     dropzone: "border-red-200 bg-red-50/60",        dropzoneOver: "border-red-400 bg-red-100" },
}

type KanbanState = Record<TicketStatus, Ticket[]>

function buildColumns(tickets: Ticket[]): KanbanState {
  const cols: Partial<KanbanState> = {}
  KANBAN_COLUMNS.forEach(({ status }) => (cols[status] = []))
  tickets.forEach((t) => {
    const col = cols[t.status]
    if (col) col.push(t)
  })
  return cols as KanbanState
}

function KanbanCard({ ticket, isDragging }: { ticket: Ticket; isDragging?: boolean }) {
  const severity = SEVERITY_CONFIG[ticket.severity]
  const { getUserById } = useAppData()
  const assignee = getUserById(ticket.assignee_id)
  const colors = STATUS_COLORS[ticket.status]

  const TypeIcon = ticket.type === "bug"
    ? IconBug
    : ticket.type === "feature_request"
      ? IconStar
      : IconChecklist

  return (
    <Card
      className={cn(
        "cursor-grab active:cursor-grabbing select-none transition-shadow",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary"
      )}
    >
      <CardContent className="p-3 space-y-2">
        {/* ID row with status dot */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={cn("size-1.5 rounded-full shrink-0", colors.dot)} />
            <Link
              href={`/dashboard/tickets/${ticket.id}`}
              className="text-xs font-mono text-muted-foreground hover:text-foreground truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {ticket.id}
            </Link>
          </div>
          <Badge variant={severity.variant} className="text-[10px] shrink-0">
            {severity.label}
          </Badge>
        </div>

        {/* Title */}
        <p className="text-sm font-medium leading-snug line-clamp-2">{ticket.title}</p>

        {/* Footer: type + assignee */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TypeIcon className="size-3" />
            <span>{TYPE_CONFIG[ticket.type].label}</span>
          </div>
          {assignee && (
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[9px]">{assignee.initials}</AvatarFallback>
            </Avatar>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function DraggableCard({ ticket }: { ticket: Ticket }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ticket.id,
    data: { ticket },
  })

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}>
      <KanbanCard ticket={ticket} isDragging={isDragging} />
    </div>
  )
}

function KanbanColumn({ status, label, tickets }: { status: TicketStatus; label: string; tickets: Ticket[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const colors = STATUS_COLORS[status]

  return (
    <div className="flex flex-col gap-2 w-64 shrink-0">
      {/* Colored column header */}
      <div className={cn("flex items-center justify-between px-2.5 py-2 rounded-lg", colors.header)}>
        <div className="flex items-center gap-2">
          <div className={cn("size-2 rounded-full", colors.dot)} />
          <h3 className={cn("text-sm font-semibold", colors.headerText)}>{label}</h3>
        </div>
        <Badge variant="secondary" className="text-xs rounded-full h-5 min-w-5 px-1.5">
          {tickets.length}
        </Badge>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-2 min-h-32 rounded-lg p-2 transition-colors border-2 border-dashed",
          isOver ? colors.dropzoneOver : colors.dropzone
        )}
      >
        {tickets.map((ticket) => (
          <DraggableCard key={ticket.id} ticket={ticket} />
        ))}
        {tickets.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
            Drop here
          </div>
        )}
      </div>
    </div>
  )
}

export default function KanbanPage() {
  const { role } = useAuth()
  const { projects, tickets, loading, error, updateTicket } = useAppData()
  const [projectId, setProjectId] = useState("all")
  const boardTickets = tickets.filter((ticket) =>
    !ticket.duplicate_of &&
    ticket.status !== "rejected" &&
    (projectId === "all" || ticket.project_id === projectId)
  )
  const columns = useMemo(
    () => buildColumns(boardTickets),
    [boardTickets]
  )
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function findTicketColumn(ticketId: string): TicketStatus | null {
    for (const [status, tickets] of Object.entries(columns)) {
      if (tickets.some((t) => t.id === ticketId)) return status as TicketStatus
    }
    return null
  }

  function onDragStart(event: DragStartEvent) {
    setActiveTicket((event.active.data.current as { ticket: Ticket }).ticket)
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTicket(null)
    if (!over) return

    const ticketId = active.id as string
    const targetStatus = over.id as TicketStatus
    const sourceStatus = findTicketColumn(ticketId)
    if (!sourceStatus || sourceStatus === targetStatus) return

    void updateTicket(ticketId, { status: targetStatus })
  }

  const totalTickets = Object.values(columns).reduce((acc, col) => acc + col.length, 0)

  if (role === "general") {
    return (
      <>
        <DashboardHeader>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Kanban Board</BreadcrumbPage>
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

  return (
    <>
      <DashboardHeader>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Kanban Board</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DashboardHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading board..." : `${totalTickets} tickets across all columns`}
          </p>
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
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}

        <ScrollArea className="flex-1 pb-4">
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="flex gap-4 pb-4 h-full">
              {KANBAN_COLUMNS.map(({ status, label }) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  label={label}
                  tickets={columns[status] ?? []}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTicket && <KanbanCard ticket={activeTicket} />}
            </DragOverlay>
          </DndContext>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </>
  )
}
