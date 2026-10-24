"use client"

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { createClient } from "@/lib/supabase/client"
import type {
  AuditEntry,
  Notification,
  Profile,
  Project,
  Ticket,
  TicketAttachment,
  TicketPriority,
  TicketComment,
  TicketSeverity,
  TicketStatus,
  TicketType,
  RejectionReason,
  UserRole,
} from "@/lib/types"
import { useAuth } from "@/components/auth-provider"

export interface AppUser {
  id: string
  name: string
  email: string
  role: UserRole
  initials: string
}

type CreateTicketInput = {
  project_id: string
  title: string
  description: string
  type: TicketType
  severity: TicketSeverity
  source_url: string | null
  capture: Record<string, unknown> | null
  attachments?: File[]
}

type CreateProjectInput = {
  key: string
  name: string
  repo_url: string | null
}

type ProjectPatch = Partial<{
  name: string
  repo_url: string | null
}>

type TicketPatch = Partial<{
  status: TicketStatus
  assignee_id: string | null
  type: TicketType
  severity: TicketSeverity
  priority: TicketPriority | null
  rejection_reason: RejectionReason | null
  rejection_note: string | null
  released_in_version: string | null
  duplicate_of: string | null
}>

interface DataStore {
  loading: boolean
  error: string | null
  projects: Project[]
  users: AppUser[]
  tickets: Ticket[]
  comments: TicketComment[]
  audit: AuditEntry[]
  attachments: TicketAttachment[]
  notifications: Notification[]
  reload: () => Promise<void>
  getUserById: (id: string | null) => AppUser | undefined
  getProjectById: (id: string | null) => Project | undefined
  getTicketById: (id: string) => Ticket | undefined
  getCommentsByTicketId: (id: string) => TicketComment[]
  getAuditByTicketId: (id: string) => AuditEntry[]
  getAttachmentsByTicketId: (id: string) => TicketAttachment[]
  getTicketsByReporter: (userId: string) => Ticket[]
  getTicketsByAssignee: (userId: string) => Ticket[]
  createProject: (input: CreateProjectInput) => Promise<void>
  updateProject: (id: string, patch: ProjectPatch) => Promise<void>
  createTicket: (input: CreateTicketInput) => Promise<Ticket>
  updateTicket: (id: string, patch: TicketPatch) => Promise<void>
  mergeDuplicate: (duplicateId: string, canonicalId: string) => Promise<void>
  createComment: (ticketId: string, body: string, isInternal?: boolean) => Promise<void>
  updateUserRole: (userId: string, role: UserRole) => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
}

const DataContext = createContext<DataStore | null>(null)

function initials(name: string, email: string) {
  return (name || email)
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U"
}

function userFromProfile(profile: Profile): AppUser {
  const name = profile.full_name || profile.email.split("@")[0] || "User"
  return {
    id: profile.id,
    name,
    email: profile.email,
    role: profile.role,
    initials: initials(name, profile.email),
  }
}

function normalizeStatus(status: unknown): TicketStatus {
  if (status === "in_review") return "triage"
  if (status === "approved") return "backlog"
  if (status === "resolved") return "merged"
  return status as TicketStatus
}

function normalizeTicket(
  row: Record<string, unknown>,
  projectKeyById: Map<string, string>,
  reporterCountByTicketId: Map<string, number>,
  duplicateCountByTicketId: Map<string, number>
): Ticket {
  return {
    uuid: String(row.id),
    id: String(row.reference ?? row.id),
    org_id: String(row.org_id),
    project_id: String(row.project_id),
    project_key: projectKeyById.get(String(row.project_id)) ?? null,
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    type: row.type as TicketType,
    severity: row.severity as TicketSeverity,
    priority: row.priority ? (row.priority as TicketPriority) : null,
    status: normalizeStatus(row.status),
    reporter_id: String(row.reporter_id),
    assignee_id: row.assignee_id ? String(row.assignee_id) : null,
    source_url: row.source_url ? String(row.source_url) : null,
    capture: row.capture ? (row.capture as Record<string, unknown>) : null,
    capture_schema_version: Number(row.capture_schema_version ?? 1),
    duplicate_of: row.duplicate_of ? String(row.duplicate_of) : null,
    reporter_count: reporterCountByTicketId.get(String(row.id)) ?? 1,
    duplicates_count: duplicateCountByTicketId.get(String(row.id)) ?? 0,
    sentry_issue_url: row.sentry_issue_url ? String(row.sentry_issue_url) : null,
    branch_name: row.branch_name ? String(row.branch_name) : null,
    pr_url: row.pr_url ? String(row.pr_url) : null,
    released_in_version: row.released_in_version ? String(row.released_in_version) : null,
    rejection_reason: row.rejection_reason ? (row.rejection_reason as RejectionReason) : null,
    rejection_note: row.rejection_note ? String(row.rejection_note) : null,
    verified_at: row.verified_at ? String(row.verified_at) : null,
    verified_by: row.verified_by ? String(row.verified_by) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function normalizeComment(row: Record<string, unknown>, ticketRefByUuid: Map<string, string>): TicketComment {
  return {
    id: String(row.id),
    org_id: String(row.org_id),
    ticket_id: ticketRefByUuid.get(String(row.ticket_id)) ?? String(row.ticket_id),
    author_id: String(row.author_id),
    body: String(row.body ?? ""),
    is_internal: Boolean(row.is_internal),
    created_at: String(row.created_at),
  }
}

function normalizeAudit(row: Record<string, unknown>, ticketRefByUuid: Map<string, string>): AuditEntry {
  return {
    id: String(row.id),
    org_id: String(row.org_id),
    ticket_id: ticketRefByUuid.get(String(row.ticket_id)) ?? String(row.ticket_id),
    changed_by: row.changed_by ? String(row.changed_by) : null,
    old_status: row.old_status ? normalizeStatus(row.old_status) : null,
    new_status: normalizeStatus(row.new_status),
    old_assignee_id: row.old_assignee_id ? String(row.old_assignee_id) : null,
    new_assignee_id: row.new_assignee_id ? String(row.new_assignee_id) : null,
    created_at: String(row.created_at),
  }
}

function normalizeAttachment(row: Record<string, unknown>, ticketRefByUuid: Map<string, string>): TicketAttachment {
  return {
    id: String(row.id),
    org_id: String(row.org_id),
    ticket_id: ticketRefByUuid.get(String(row.ticket_id)) ?? String(row.ticket_id),
    kind: row.kind as TicketAttachment["kind"],
    storage_path: String(row.storage_path),
    mime_type: String(row.mime_type),
    size_bytes: Number(row.size_bytes),
    duration_ms: row.duration_ms == null ? null : Number(row.duration_ms),
    created_by: String(row.created_by),
    created_at: String(row.created_at),
  }
}

function extensionFor(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext) return ext.replace(/[^a-z0-9]/g, "")
  if (file.type === "image/png") return "png"
  if (file.type === "image/jpeg") return "jpg"
  if (file.type === "image/webp") return "webp"
  if (file.type === "video/webm") return "webm"
  if (file.type === "video/mp4") return "mp4"
  return "bin"
}

export function DataProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const { profile, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [comments, setComments] = useState<TicketComment[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [attachments, setAttachments] = useState<TicketAttachment[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [projectsResult, profilesResult, ticketsResult, notificationsResult] = await Promise.all([
      supabase.from("projects").select("*").order("key", { ascending: true }),
      supabase.from("profiles").select("*").order("full_name", { ascending: true }),
      supabase.from("tickets").select("*").order("created_at", { ascending: false }),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }),
    ])

    if (projectsResult.error || profilesResult.error || ticketsResult.error || notificationsResult.error) {
      setError(
        projectsResult.error?.message ||
          profilesResult.error?.message ||
          ticketsResult.error?.message ||
          notificationsResult.error?.message ||
          "Could not load data."
      )
      setLoading(false)
      return
    }

    const nextProjects = (projectsResult.data ?? []) as Project[]
    const projectKeyById = new Map(nextProjects.map((project) => [project.id, project.key]))
    const rawTickets = ticketsResult.data ?? []
    const duplicateCountByTicketId = new Map<string, number>()
    rawTickets.forEach((row) => {
      if (row.duplicate_of) {
        duplicateCountByTicketId.set(
          String(row.duplicate_of),
          (duplicateCountByTicketId.get(String(row.duplicate_of)) ?? 0) + 1
        )
      }
    })
    const ticketUuids = rawTickets.map((ticket) => String(ticket.id))
    const reportersResult = ticketUuids.length
      ? await supabase.from("ticket_reporters").select("*").in("ticket_id", ticketUuids)
      : { data: [], error: null }

    if (reportersResult.error) {
      setError(reportersResult.error.message)
      setLoading(false)
      return
    }

    const reporterCountByTicketId = new Map<string, number>()
    ;(reportersResult.data ?? []).forEach((row) => {
      reporterCountByTicketId.set(String(row.ticket_id), (reporterCountByTicketId.get(String(row.ticket_id)) ?? 0) + 1)
    })

    const nextTickets = rawTickets.map((row) =>
      normalizeTicket(row, projectKeyById, reporterCountByTicketId, duplicateCountByTicketId)
    )
    const ticketRefByUuid = new Map(nextTickets.map((ticket) => [ticket.uuid, ticket.id]))

    const [commentsResult, auditResult, attachmentsResult] = ticketUuids.length
      ? await Promise.all([
          supabase
            .from("ticket_comments")
            .select("*")
            .in("ticket_id", ticketUuids)
            .order("created_at", { ascending: true }),
          supabase
            .from("ticket_audit_log")
            .select("*")
            .in("ticket_id", ticketUuids)
            .order("created_at", { ascending: true }),
          supabase
            .from("ticket_attachments")
            .select("*")
            .in("ticket_id", ticketUuids)
            .order("created_at", { ascending: true }),
        ])
      : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }]

    if (commentsResult.error || auditResult.error || attachmentsResult.error) {
      setError(
        commentsResult.error?.message ||
          auditResult.error?.message ||
          attachmentsResult.error?.message ||
          "Could not load ticket history."
      )
      setLoading(false)
      return
    }

    const nextAttachments = await Promise.all(
      (attachmentsResult.data ?? []).map(async (row) => {
        const attachment = normalizeAttachment(row, ticketRefByUuid)
        const { data } = await supabase
          .storage
          .from("ticket-attachments")
          .createSignedUrl(attachment.storage_path, 600)
        return { ...attachment, signed_url: data?.signedUrl }
      })
    )

    setProjects(nextProjects)
    setUsers(((profilesResult.data ?? []) as Profile[]).map(userFromProfile))
    setTickets(nextTickets)
    setComments((commentsResult.data ?? []).map((row) => normalizeComment(row, ticketRefByUuid)))
    setAudit((auditResult.data ?? []).map((row) => normalizeAudit(row, ticketRefByUuid)))
    setAttachments(nextAttachments)
    setNotifications((notificationsResult.data ?? []) as Notification[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    queueMicrotask(() => void reload())
  }, [reload])

  const getTicketById = useCallback(
    (id: string) => tickets.find((ticket) => ticket.id === id || ticket.uuid === id),
    [tickets]
  )

  const value: DataStore = {
    loading,
    error,
    projects,
    users,
    tickets,
    comments,
    audit,
    attachments,
    notifications,
    reload,
    getUserById: (id) => users.find((item) => item.id === id),
    getProjectById: (id) => projects.find((item) => item.id === id),
    getTicketById,
    getCommentsByTicketId: (id) => comments.filter((comment) => comment.ticket_id === id),
    getAuditByTicketId: (id) => audit.filter((entry) => entry.ticket_id === id),
    getAttachmentsByTicketId: (id) => attachments.filter((attachment) => attachment.ticket_id === id),
    getTicketsByReporter: (userId) => tickets.filter((ticket) => ticket.reporter_id === userId),
    getTicketsByAssignee: (userId) => tickets.filter((ticket) => ticket.assignee_id === userId),
    createProject: async (input) => {
      const key = input.key.trim().toUpperCase()
      const name = input.name.trim()
      const repoUrl = input.repo_url?.trim() || null

      if (!/^[A-Z0-9]{2,10}$/.test(key)) {
        throw new Error("Project key must be 2-10 letters or numbers.")
      }
      if (!name) throw new Error("Project name is required.")

      const { error: insertError } = await supabase.from("projects").insert({
        org_id: profile.org_id,
        key,
        name,
        repo_url: repoUrl,
      })
      if (insertError) throw new Error(insertError.message)
      await reload()
    },
    updateProject: async (id, patch) => {
      const name = patch.name?.trim()
      const repoUrl = patch.repo_url?.trim() || null
      if (!name) throw new Error("Project name is required.")

      const { error: updateError } = await supabase
        .from("projects")
        .update({ name, repo_url: repoUrl })
        .eq("id", id)

      if (updateError) throw new Error(updateError.message)
      await reload()
    },
    createTicket: async (input) => {
      const files = input.attachments ?? []
      const tooLarge = files.find((file) => file.size > 25 * 1024 * 1024)
      if (tooLarge) throw new Error(`${tooLarge.name} is over the 25 MB limit.`)

      const { data, error: insertError } = await supabase
        .from("tickets")
        .insert({
          project_id: input.project_id,
          title: input.title,
          description: input.description,
          type: input.type,
          severity: input.severity,
          source_url: input.source_url,
          capture: input.capture,
          reporter_id: user.id,
        })
        .select("*")
        .single()

      if (insertError) throw new Error(insertError.message)
      const ticket = normalizeTicket(
        data,
        new Map(projects.map((project) => [project.id, project.key])),
        new Map([[String(data.id), 1]]),
        new Map()
      )

      for (const file of files) {
        const path = `${ticket.org_id}/${ticket.project_id}/${ticket.uuid}/${crypto.randomUUID()}.${extensionFor(file)}`
        const kind: TicketAttachment["kind"] = file.type.startsWith("video/") ? "recording" : "screenshot"
        const { error: uploadError } = await supabase.storage
          .from("ticket-attachments")
          .upload(path, file, { contentType: file.type, upsert: false })
        if (uploadError) throw new Error(uploadError.message)

        const { error: attachmentError } = await supabase.from("ticket_attachments").insert({
          org_id: ticket.org_id,
          ticket_id: ticket.uuid,
          kind,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
          created_by: user.id,
        })
        if (attachmentError) throw new Error(attachmentError.message)
      }

      await reload()
      return ticket
    },
    updateTicket: async (id, patch) => {
      const ticket = getTicketById(id)
      if (!ticket) throw new Error("Ticket not found.")

      const { error: updateError } = await supabase
        .from("tickets")
        .update(patch)
        .eq("id", ticket.uuid)

      if (updateError) throw new Error(updateError.message)
      await reload()
    },
    mergeDuplicate: async (duplicateId, canonicalId) => {
      const duplicate = getTicketById(duplicateId)
      const canonical = getTicketById(canonicalId)
      if (!duplicate || !canonical) throw new Error("Ticket not found.")
      if (duplicate.uuid === canonical.uuid) throw new Error("Choose a different ticket.")

      const { data: duplicateReporters, error: reportersError } = await supabase
        .from("ticket_reporters")
        .select("user_id")
        .eq("ticket_id", duplicate.uuid)
      if (reportersError) throw new Error(reportersError.message)

      const movedReporters = (duplicateReporters ?? []).map((row) => ({
        ticket_id: canonical.uuid,
        user_id: row.user_id,
      }))
      if (movedReporters.length) {
        const { error: moveError } = await supabase.from("ticket_reporters").upsert(movedReporters)
        if (moveError) throw new Error(moveError.message)
      }

      const { error: updateError } = await supabase
        .from("tickets")
        .update({
          duplicate_of: canonical.uuid,
          status: "closed",
          rejection_reason: "duplicate",
          rejection_note: `Merged into ${canonical.id}.`,
        })
        .eq("id", duplicate.uuid)
      if (updateError) throw new Error(updateError.message)
      await reload()
    },
    createComment: async (ticketId, body, isInternal = false) => {
      const ticket = getTicketById(ticketId)
      if (!ticket) throw new Error("Ticket not found.")

      const { error: insertError } = await supabase.from("ticket_comments").insert({
        ticket_id: ticket.uuid,
        author_id: user.id,
        body,
        is_internal: isInternal,
      })

      if (insertError) throw new Error(insertError.message)
      await reload()
    },
    updateUserRole: async (userId, role) => {
      const { error: updateError } = await supabase.from("profiles").update({ role }).eq("id", userId)
      if (updateError) throw new Error(updateError.message)
      await reload()
    },
    markNotificationRead: async (id) => {
      const { error: updateError } = await supabase.from("notifications").update({ read: true }).eq("id", id)
      if (updateError) throw new Error(updateError.message)
      await reload()
    },
    markAllNotificationsRead: async () => {
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false)
      if (updateError) throw new Error(updateError.message)
      await reload()
    },
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useAppData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error("useAppData must be used within DataProvider")
  return ctx
}
