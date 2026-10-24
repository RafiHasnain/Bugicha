"use client"

import { FormEvent, useMemo, useState } from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { DashboardHeader } from "@/components/dashboard-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
import type { Project } from "@/lib/types"
import { IconFolder, IconList, IconPlus } from "@tabler/icons-react"

function emptyProjectForm() {
  return {
    key: "",
    name: "",
    repo_url: "",
  }
}

export default function ProjectsPage() {
  const { role } = useAuth()
  const isManager = role === "pm" || role === "admin"
  const { projects, tickets, loading, error, createProject, updateProject } = useAppData()
  const [form, setForm] = useState(emptyProjectForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editUrl, setEditUrl] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const ticketCountByProject = useMemo(() => {
    const counts = new Map<string, number>()
    tickets
      .filter((ticket) => !ticket.duplicate_of)
      .forEach((ticket) => {
        counts.set(ticket.project_id, (counts.get(ticket.project_id) ?? 0) + 1)
      })
    return counts
  }, [tickets])

  const linkedProjects = projects.filter((project) => Boolean(project.repo_url)).length
  const activeProjects = projects.filter((project) => (ticketCountByProject.get(project.id) ?? 0) > 0).length

  function startEdit(project: Project) {
    setFormError(null)
    setEditingId(project.id)
    setEditName(project.name)
    setEditUrl(project.repo_url ?? "")
  }

  function stopEdit() {
    setEditingId(null)
    setEditName("")
    setEditUrl("")
  }

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)

    try {
      await createProject({
        key: form.key,
        name: form.name,
        repo_url: form.repo_url,
      })
      setForm(emptyProjectForm())
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create project.")
    } finally {
      setSaving(false)
    }
  }

  async function saveProject(projectId: string) {
    setSaving(true)
    setFormError(null)

    try {
      await updateProject(projectId, {
        name: editName,
        repo_url: editUrl,
      })
      stopEdit()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not update project.")
    } finally {
      setSaving(false)
    }
  }

  if (!isManager) {
    return (
      <>
        <DashboardHeader>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Projects</BreadcrumbPage>
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
              <BreadcrumbPage>Projects</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DashboardHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <div className="text-muted-foreground">
                <IconFolder className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projects.length}</div>
              <p className="mt-1 text-xs text-muted-foreground">Available in ticket forms</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <div className="text-muted-foreground">
                <IconList className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeProjects}</div>
              <p className="mt-1 text-xs text-muted-foreground">Have current tickets</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Linked Projects</CardTitle>
              <div className="text-muted-foreground">
                <IconFolder className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{linkedProjects}</div>
              <p className="mt-1 text-xs text-muted-foreground">Have a project URL</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Add Project</CardTitle>
            <FieldDescription>
              The project key is shown in ticket references and should stay short.
            </FieldDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitProject}>
              <FieldGroup className="gap-4 md:grid md:grid-cols-[minmax(8rem,0.8fr)_minmax(12rem,1.2fr)_minmax(14rem,1.6fr)_auto] md:items-end">
                <Field>
                  <FieldLabel htmlFor="project-key">Key</FieldLabel>
                  <Input
                    id="project-key"
                    value={form.key}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        key: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="WEB"
                    maxLength={10}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-name">Name</FieldLabel>
                  <Input
                    id="project-name"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Bugicha Web"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-url">Project URL</FieldLabel>
                  <Input
                    id="project-url"
                    type="url"
                    value={form.repo_url}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        repo_url: event.target.value,
                      }))
                    }
                    placeholder="https://example.com"
                  />
                </Field>
                <Button type="submit" disabled={saving}>
                  <IconPlus className="size-4" />
                  Add
                </Button>
              </FieldGroup>
            </form>
            {(formError || error) && (
              <p className="mt-3 text-sm text-destructive">{formError || error}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          {(loading || error) && (
            <CardHeader>
              {loading && <CardTitle className="text-sm font-medium">Loading projects...</CardTitle>}
              {error && !formError && <p className="text-sm text-destructive">{error}</p>}
            </CardHeader>
          )}
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Project</TableHead>
                  <TableHead>Project URL</TableHead>
                  <TableHead className="text-center">Tickets</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const isEditing = editingId === project.id
                  return (
                    <TableRow key={project.id}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {project.key}
                          </Badge>
                          {isEditing ? (
                            <Input
                              value={editName}
                              onChange={(event) => setEditName(event.target.value)}
                              className="max-w-sm"
                              required
                            />
                          ) : (
                            <span className="text-sm font-medium">{project.name}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="url"
                            value={editUrl}
                            onChange={(event) => setEditUrl(event.target.value)}
                            placeholder="https://example.com"
                          />
                        ) : project.repo_url ? (
                          <a
                            href={project.repo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-primary underline-offset-4 hover:underline"
                          >
                            {project.repo_url}
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">No URL</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {ticketCountByProject.get(project.id) ?? 0}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => saveProject(project.id)}
                              disabled={saving}
                            >
                              Save
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={stopEdit}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button type="button" size="sm" variant="outline" onClick={() => startEdit(project)}>
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
