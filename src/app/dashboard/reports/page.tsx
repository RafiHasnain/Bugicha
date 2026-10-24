"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  LabelList,
  Dot,
} from "recharts"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartConfig,
} from "@/components/ui/chart"
import { DashboardHeader } from "@/components/dashboard-header"
import { useAuth } from "@/components/auth-provider"
import { useAppData } from "@/lib/data-store"
import { STATUS_CONFIG } from "@/lib/ticket-config"
import { IconAlertCircle, IconBug, IconCircleCheck, IconClock } from "@tabler/icons-react"

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

// ── Chart configs — use CSS vars directly (values are oklch, not hsl tuples) ──

const statusConfig = {
  count: { label: "Tickets", color: "var(--chart-1)" },
  label: { color: "var(--background)" },
} satisfies ChartConfig

const severityConfig = {
  count: { label: "Tickets", color: "var(--chart-2)" },
  label: { color: "var(--background)" },
} satisfies ChartConfig

const workloadConfig = {
  open:     { label: "Open",     color: "var(--chart-1)" },
  resolved: { label: "Resolved", color: "var(--chart-3)" },
} satisfies ChartConfig

const submissionsConfig = {
  count: { label: "Submitted", color: "var(--chart-4)" },
} satisfies ChartConfig

const typeConfig = {
  open:     { label: "Open",     color: "var(--chart-1)" },
  resolved: { label: "Resolved", color: "var(--chart-3)" },
} satisfies ChartConfig

const DONE_STATUSES = ["merged", "released", "verified", "closed"]

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { role } = useAuth()
  const isManager = role === "pm" || role === "admin"
  const { tickets: rawTickets, users, loading, error } = useAppData()
  const tickets = rawTickets.filter((ticket) => !ticket.duplicate_of)
  const statusData = Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
    name: cfg.label,
    count: tickets.filter((t) => t.status === key).length,
  }))

  const severityData = [
    { name: "Critical", count: tickets.filter((t) => t.severity === "critical").length },
    { name: "High", count: tickets.filter((t) => t.severity === "high").length },
    { name: "Medium", count: tickets.filter((t) => t.severity === "medium").length },
    { name: "Low", count: tickets.filter((t) => t.severity === "low").length },
  ]

  const engineers = users.filter((u) => u.role === "engineer")
  const workloadData = engineers.map((eng) => ({
    name: eng.name.split(" ")[0],
    open: tickets.filter(
      (t) => t.assignee_id === eng.id && !DONE_STATUSES.includes(t.status)
    ).length,
    resolved: tickets.filter(
      (t) => t.assignee_id === eng.id && DONE_STATUSES.includes(t.status)
    ).length,
  }))

  const dateMap: Record<string, number> = {}
  tickets.forEach((t) => {
    const day = t.created_at.slice(0, 10)
    dateMap[day] = (dateMap[day] ?? 0) + 1
  })
  const submissionsData = Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count], i) => ({
      date: new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }))

  const typeData = [
    {
      name: "Bug",
      open: tickets.filter((t) => t.type === "bug" && !DONE_STATUSES.includes(t.status)).length,
      resolved: tickets.filter((t) => t.type === "bug" && DONE_STATUSES.includes(t.status)).length,
    },
    {
      name: "Feature",
      open: tickets.filter((t) => t.type === "feature_request" && !DONE_STATUSES.includes(t.status)).length,
      resolved: tickets.filter((t) => t.type === "feature_request" && DONE_STATUSES.includes(t.status)).length,
    },
    {
      name: "Task",
      open: tickets.filter((t) => t.type === "task" && !DONE_STATUSES.includes(t.status)).length,
      resolved: tickets.filter((t) => t.type === "task" && DONE_STATUSES.includes(t.status)).length,
    },
  ]

  const totalOpen = tickets.filter((t) => !DONE_STATUSES.includes(t.status) && t.status !== "rejected").length
  const totalResolved = tickets.filter((t) => DONE_STATUSES.includes(t.status)).length
  const criticalOpen = tickets.filter((t) => t.severity === "critical" && !DONE_STATUSES.includes(t.status) && t.status !== "rejected").length

  if (!isManager) {
    return (
      <>
        <DashboardHeader>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Reports</BreadcrumbPage>
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
              <BreadcrumbPage>Reports</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DashboardHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {loading && <p className="text-sm text-muted-foreground">Loading reports...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* KPI row — same StatCard pattern as the overview page */}
        <div className="grid auto-rows-min gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <div className="text-muted-foreground">
                <IconBug className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tickets.length}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open</CardTitle>
              <div className="text-muted-foreground">
                <IconClock className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOpen}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting resolution</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved / Closed</CardTitle>
              <div className="text-muted-foreground">
                <IconCircleCheck className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalResolved}</div>
              <p className="text-xs text-muted-foreground mt-1">Completed tickets</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Open</CardTitle>
              <div className="text-muted-foreground">
                <IconAlertCircle className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{criticalOpen}</div>
              <p className="text-xs text-muted-foreground mt-1">Needs immediate attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Row 1: Status + Severity (both horizontal bar) */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Tickets by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={statusConfig} className="aspect-auto h-64 w-full">
                <BarChart
                  accessibilityLayer
                  data={statusData}
                  layout="vertical"
                  margin={{ right: 48 }}
                >
                  <CartesianGrid horizontal={false} />
                  <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} hide />
                  <XAxis dataKey="count" type="number" hide />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={4}>
                    <LabelList
                      dataKey="name"
                      position="insideLeft"
                      offset={8}
                      className="fill-(--color-label)"
                      fontSize={12}
                    />
                    <LabelList
                      dataKey="count"
                      position="right"
                      offset={8}
                      className="fill-foreground"
                      fontSize={12}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Tickets by Severity</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={severityConfig} className="aspect-auto h-40 w-full">
                <BarChart
                  accessibilityLayer
                  data={severityData}
                  layout="vertical"
                  margin={{ right: 48 }}
                  barSize={32}
                >
                  <CartesianGrid horizontal={false} />
                  <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} hide />
                  <XAxis dataKey="count" type="number" hide />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={4}>
                    <LabelList
                      dataKey="name"
                      position="insideLeft"
                      offset={8}
                      className="fill-(--color-label)"
                      fontSize={12}
                    />
                    <LabelList
                      dataKey="count"
                      position="right"
                      offset={8}
                      className="fill-foreground"
                      fontSize={12}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Workload + Submissions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Engineer Workload</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ maxWidth: workloadData.length * 96 + 64 }}>
                <ChartContainer config={workloadConfig} className="aspect-auto h-44 w-full">
                  <BarChart accessibilityLayer data={workloadData} barSize={48} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} fontSize={12} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="open"     stackId="a" fill="var(--color-open)"     radius={[0, 0, 4, 4]} />
                    <Bar dataKey="resolved" stackId="a" fill="var(--color-resolved)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Submissions Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={submissionsConfig} className="aspect-auto h-44 w-full">
                <LineChart
                  accessibilityLayer
                  data={submissionsData}
                  margin={{ top: 24, left: 24, right: 24 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="line" nameKey="count" hideLabel />}
                  />
                  <Line
                    dataKey="count"
                    type="natural"
                    stroke="var(--color-count)"
                    strokeWidth={2}
                    dot={({ payload, ...props }) => (
                      <Dot
                        key={payload.date}
                        r={5}
                        cx={props.cx}
                        cy={props.cy}
                        fill={payload.fill}
                        stroke={payload.fill}
                      />
                    )}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Row 3: Type breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tickets by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ maxWidth: typeData.length * 96 + 48 }}>
              <ChartContainer config={typeConfig} className="aspect-auto h-44 w-full">
                <BarChart accessibilityLayer data={typeData} barSize={48} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="open"     stackId="a" fill="var(--color-open)"     radius={[0, 0, 4, 4]} />
                  <Bar dataKey="resolved" stackId="a" fill="var(--color-resolved)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

      </div>
    </>
  )
}
