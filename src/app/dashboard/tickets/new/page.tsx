"use client"

import { Suspense, useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { useAppData } from "@/lib/data-store"
import { TicketSeverity, TicketType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { IconPlus, IconArrowLeft, IconX, IconCloudUpload, IconVideo } from "@tabler/icons-react"
import { useAuth } from "@/components/auth-provider"

type Attachment = { file: File; url: string }

function NewTicketForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialType = searchParams.get("type") ?? ""
  const { role } = useAuth()
  const { createTicket, projects } = useAppData()
  const allowedTypes: TicketType[] = role === "general" ? ["bug", "feature_request"] : ["bug", "feature_request", "task"]

  const [projectId, setProjectId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState(allowedTypes.includes(initialType as TicketType) ? initialType : "")
  const [severity, setSeverity] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [recording, setRecording] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      attachments.forEach((a) => { if (a.url) URL.revokeObjectURL(a.url) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList).filter((f) => {
      if (!(f.type.startsWith("image/") || f.type.startsWith("video/"))) return false
      if (f.size > 25 * 1024 * 1024) {
        setError(`${f.name} is over the 25 MB limit.`)
        return false
      }
      return true
    })
    const entries: Attachment[] = incoming.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }))
    setAttachments((prev) => [...prev, ...entries])
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const removed = prev[index]
      if (removed.url) URL.revokeObjectURL(removed.url)
      return prev.filter((_, i) => i !== index)
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  async function startRecording() {
    setError(null)
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" })
    recorderRef.current = recorder
    chunksRef.current = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      const blob = new Blob(chunksRef.current, { type: "video/webm" })
      if (blob.size <= 25 * 1024 * 1024) {
        addFiles([new File([blob], `screen-recording-${Date.now()}.webm`, { type: "video/webm" })])
      } else {
        setError("Recording is over the 25 MB limit.")
      }
      setRecording(false)
      if (recordTimerRef.current) clearTimeout(recordTimerRef.current)
    }
    recorder.start()
    setRecording(true)
    recordTimerRef.current = setTimeout(() => recorder.stop(), 60000)
  }

  function stopRecording() {
    recorderRef.current?.stop()
  }

  function captureContext() {
    const url = sourceUrl || window.location.href
    return {
      url,
      route: new URL(url, window.location.href).pathname,
      user_agent: window.navigator.userAgent,
      browser: window.navigator.userAgent,
      os: window.navigator.platform,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      device_pixel_ratio: window.devicePixelRatio,
      environment: process.env.NODE_ENV,
      app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
      captured_at: new Date().toISOString(),
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const selectedProjectId = projectId || projects[0]?.id
    if (!selectedProjectId) {
      setError("Select a project.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const ticket = await createTicket({
        title,
        description,
        type: type as TicketType,
        severity: severity as TicketSeverity,
        source_url: sourceUrl || null,
        project_id: selectedProjectId,
        capture: captureContext(),
        attachments: attachments.map((attachment) => attachment.file),
      })
      router.push(`/dashboard/tickets/${ticket.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit ticket.")
      setSubmitting(false)
    }
  }

  const showAttachments = true
  const selectedProjectId = projectId || projects[0]?.id || ""
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="max-w-2xl mx-auto w-full">
        <Card>
          <CardHeader>
            <CardTitle>Submit a Ticket</CardTitle>
            <CardDescription>
              Report a bug, request a feature, or log a task. Your ticket will be reviewed by the team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="title">Title</FieldLabel>
                  <Input
                    id="title"
                    placeholder="Brief, descriptive title"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <FieldDescription>Summarize the issue in one sentence.</FieldDescription>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="project">Project</FieldLabel>
                    <Select required value={selectedProjectId} onValueChange={setProjectId}>
                      <SelectTrigger id="project">
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.key} · {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="type">Type</FieldLabel>
                    <Select required value={type} onValueChange={setType}>
                      <SelectTrigger id="type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedTypes.includes("bug") && <SelectItem value="bug">Bug</SelectItem>}
                        {allowedTypes.includes("feature_request") && <SelectItem value="feature_request">Feature Request</SelectItem>}
                        {allowedTypes.includes("task") && <SelectItem value="task">Task</SelectItem>}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="severity">Severity</FieldLabel>
                    <Select required value={severity} onValueChange={setSeverity}>
                      <SelectTrigger id="severity">
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical — blocks all users, no workaround, data loss or security exposure</SelectItem>
                        <SelectItem value="high">High — blocks a core workflow, painful workaround exists</SelectItem>
                        <SelectItem value="medium">Medium — degrades experience, easy workaround</SelectItem>
                        <SelectItem value="low">Low — cosmetic, or affects few users</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea
                    id="description"
                    placeholder="Describe the issue in detail. Include steps to reproduce, expected and actual behavior."
                    required
                    rows={6}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>

                {showAttachments && (
                  <Field>
                    <FieldLabel>Attachments</FieldLabel>
                    <FieldDescription>
                      Add screenshots or screen recordings to help illustrate the issue.
                    </FieldDescription>
                    <div className="mb-2">
                      <Button type="button" variant="outline" size="sm" onClick={recording ? stopRecording : startRecording}>
                        <IconVideo className="size-4 mr-2" />
                        {recording ? "Stop Recording" : "Record Screen"}
                      </Button>
                    </div>

                    {/* Dropzone */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="Upload attachments"
                      className={cn(
                        "mt-1 flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-colors select-none",
                        dragOver
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-muted/30"
                      )}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
                      }}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click() }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="hidden"
                        onChange={(e) => { if (e.target.files) { addFiles(e.target.files); e.target.value = "" } }}
                      />
                      <IconCloudUpload
                        className={cn("size-8 transition-colors", dragOver ? "text-primary" : "text-muted-foreground")}
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Drop files here or <span className="text-primary">browse</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          PNG, JPG, GIF, WebP, MP4, WebM, MOV
                        </p>
                      </div>
                    </div>

                    {/* Previews */}
                    {attachments.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {attachments.map((att, i) => (
                          <div
                            key={i}
                            className="group relative aspect-video overflow-hidden rounded-md border bg-muted"
                          >
                            {att.file.type.startsWith("image/") ? (
                              <img
                                src={att.url}
                                alt={att.file.name}
                                className="h-full w-full object-cover"
                              />
                            ) : att.file.type.startsWith("video/") ? (
                              <video src={att.url} controls className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <IconVideo className="size-7 text-muted-foreground" />
                              </div>
                            )}

                            {/* Remove button */}
                            <button
                              type="button"
                              aria-label={`Remove ${att.file.name}`}
                              onClick={(e) => { e.stopPropagation(); removeAttachment(i) }}
                              className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                            >
                              <IconX className="size-3.5" />
                            </button>

                            {/* Filename bar */}
                            <p className="absolute bottom-0 left-0 right-0 truncate bg-background/70 px-1.5 py-0.5 text-[10px] text-foreground">
                              {att.file.name}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Field>
                )}

                <Field>
                  <FieldLabel htmlFor="source-url">Source URL</FieldLabel>
                  <Input
                    id="source-url"
                    type="url"
                    placeholder="https://app.company.com/page-where-bug-occurred"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                  />
                  <FieldDescription>Optional — the page URL where the issue occurred.</FieldDescription>
                </Field>

                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="outline" asChild>
                    <Link href="/dashboard/tickets">
                      <IconArrowLeft className="size-4 mr-2" />
                      Cancel
                    </Link>
                  </Button>
                  <Button type="submit" disabled={submitting || !selectedProjectId}>
                    <IconPlus className="size-4 mr-2" />
                    {submitting ? "Submitting..." : "Submit Ticket"}
                  </Button>
                </div>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function NewTicketPage() {
  return (
    <>
      <DashboardHeader>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/dashboard/tickets">Tickets</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>Submit Ticket</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DashboardHeader>
      <Suspense>
        <NewTicketForm />
      </Suspense>
    </>
  )
}
