"use client"

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
import { useAuth } from "@/components/auth-provider"
import { AppUser, useAppData } from "@/lib/data-store"
import { UserRole } from "@/lib/types"
import { IconCircleCheck, IconUser, IconHistory } from "@tabler/icons-react"

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

export default function UsersPage() {
  const { role: currentRole } = useAuth()
  const isManager = currentRole === "pm" || currentRole === "admin"
  const { users, tickets, loading, error, updateUserRole } = useAppData()

  async function changeRole(userId: string, newRole: UserRole) {
    await updateUserRole(userId, newRole)
  }

  function statsFor(userId: string) {
    const visibleTickets = tickets.filter((ticket) => !ticket.duplicate_of)
    const reported = visibleTickets.filter((t) => t.reporter_id === userId).length
    const assigned = visibleTickets.filter((t) => t.assignee_id === userId).length
    const resolved = visibleTickets.filter(
      (t) => t.assignee_id === userId && DONE_STATUSES.includes(t.status)
    ).length
    return { reported, assigned, resolved }
  }

  const totalUsers = users.length
  const engineers = users.filter((u) => u.role === "engineer").length
  const generals = users.filter((u) => u.role === "general").length
  const pms = users.filter((u) => u.role === "pm" || u.role === "admin").length

  if (!isManager) {
    return (
      <>
        <DashboardHeader>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Users</BreadcrumbPage>
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
              <BreadcrumbPage>Users</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DashboardHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">

        {/* KPI row */}
        <div className="grid auto-rows-min gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <div className="text-muted-foreground">
                <IconUser className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">All roles</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Engineers</CardTitle>
              <div className="text-muted-foreground">
                <IconHistory className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{engineers}</div>
              <p className="text-xs text-muted-foreground mt-1">Can be assigned tickets</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">General Users</CardTitle>
              <div className="text-muted-foreground">
                <IconUser className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{generals}</div>
              <p className="text-xs text-muted-foreground mt-1">Submit tickets only</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">PM / Admins</CardTitle>
              <div className="text-muted-foreground">
                <IconCircleCheck className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pms}</div>
              <p className="text-xs text-muted-foreground mt-1">Full access</p>
            </CardContent>
          </Card>
        </div>

        {/* Users table */}
        <Card>
          {(loading || error) && (
            <CardHeader>
              {loading && <CardTitle className="text-sm font-medium">Loading users...</CardTitle>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardHeader>
          )}
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-center">Reported</TableHead>
                  <TableHead className="text-center">Assigned</TableHead>
                  <TableHead className="text-center">Resolved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user: AppUser) => {
                  const stats = statsFor(user.id)
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 rounded-lg">
                            <AvatarFallback className="rounded-lg text-xs">{user.initials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-sm font-medium">{user.name}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isManager ? (
                          <Select
                            value={user.role}
                            onValueChange={(val) => changeRole(user.id, val as UserRole)}
                          >
                            <SelectTrigger className="w-36 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="general">General User</SelectItem>
                              <SelectItem value="engineer">Engineer</SelectItem>
                              <SelectItem value="pm">PM / Admin</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={ROLE_BADGE_VARIANT[user.role]} className="text-xs">
                            {ROLE_LABELS[user.role]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">{stats.reported}</TableCell>
                      <TableCell className="text-center text-sm">{stats.assigned}</TableCell>
                      <TableCell className="text-center text-sm">{stats.resolved}</TableCell>
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
