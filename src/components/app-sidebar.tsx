"use client"

import * as React from "react"
import Link from "next/link"

import { usePathname } from "next/navigation"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/components/auth-provider"
import { UserRole } from "@/lib/types"
import { IconPlus, IconChevronDown, IconClipboardList, IconChartBar, IconBug, IconFolder, IconHome, IconInbox, IconLayoutKanban, IconList, IconStar, IconUsers } from "@tabler/icons-react"

const ROLE_NAV: Record<UserRole, { title: string; url: string; icon: React.ReactNode }[]> = {
  general: [
    { title: "Overview",   url: "/dashboard",         icon: <IconHome /> },
    { title: "My Tickets", url: "/dashboard/tickets", icon: <IconList /> },
  ],
  engineer: [
    { title: "Overview",       url: "/dashboard",          icon: <IconHome /> },
    { title: "Assigned to Me", url: "/dashboard/assigned", icon: <IconClipboardList /> },
    { title: "My Tickets",     url: "/dashboard/tickets",  icon: <IconList /> },
    { title: "Kanban Board",   url: "/dashboard/kanban",   icon: <IconLayoutKanban /> },
  ],
  pm: [
    { title: "Overview",     url: "/dashboard",         icon: <IconHome /> },
    { title: "Review Queue", url: "/dashboard/review",  icon: <IconInbox /> },
    { title: "All Tickets",  url: "/dashboard/tickets", icon: <IconList /> },
    { title: "Kanban Board", url: "/dashboard/kanban",  icon: <IconLayoutKanban /> },
    { title: "Projects",     url: "/dashboard/projects", icon: <IconFolder /> },
    { title: "Reports",      url: "/dashboard/reports", icon: <IconChartBar /> },
    { title: "Users",        url: "/dashboard/users",   icon: <IconUsers /> },
  ],
  admin: [
    { title: "Overview",     url: "/dashboard",         icon: <IconHome /> },
    { title: "Review Queue", url: "/dashboard/review",  icon: <IconInbox /> },
    { title: "All Tickets",  url: "/dashboard/tickets", icon: <IconList /> },
    { title: "Kanban Board", url: "/dashboard/kanban",  icon: <IconLayoutKanban /> },
    { title: "Projects",     url: "/dashboard/projects", icon: <IconFolder /> },
    { title: "Reports",      url: "/dashboard/reports", icon: <IconChartBar /> },
    { title: "Users",        url: "/dashboard/users",   icon: <IconUsers /> },
  ],
}

function SplitSubmitButton() {
  const { state } = useSidebar()

  // Collapsed (icon-only) mode — show a single icon that opens the dropdown
  if (state === "collapsed") {
    return (
      <SidebarGroup className="pb-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton tooltip="Submit Ticket">
                  <IconPlus />
                  <span>Submit Ticket</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-44">
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/tickets/new?type=bug" className="flex items-center gap-2">
                    <IconBug className="size-4 shrink-0" />
                    Bug Report
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/tickets/new?type=feature_request" className="flex items-center gap-2">
                    <IconStar className="size-4 shrink-0" />
                    Feature Request
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    )
  }

  // Expanded mode — split button: [primary action | ▾ dropdown]
  return (
    <SidebarGroup className="pb-2">
      <ButtonGroup className="mx-2 w-auto">
        <Button
          variant="default"
          size="default"
          className="flex-1 justify-start"
          asChild
        >
          <Link href="/dashboard/tickets/new">
            <IconPlus className="size-4 shrink-0" />
            Submit Ticket
          </Link>
        </Button>
        <ButtonGroupSeparator />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default" size="icon" aria-label="Choose ticket type">
              <IconChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <Link href="/dashboard/tickets/new?type=bug" className="flex items-center gap-2">
                <IconBug className="size-4 shrink-0" />
                Bug Report
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/tickets/new?type=feature_request" className="flex items-center gap-2">
                <IconStar className="size-4 shrink-0" />
                Feature Request
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
    </SidebarGroup>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { role } = useAuth()
  const pathname = usePathname()
  const navItems = ROLE_NAV[role].map((item) => ({
    ...item,
    isActive: item.url === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(item.url),
  }))

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <IconBug className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Bugicha</span>
                  <span className="truncate text-xs text-muted-foreground">Ticket Management</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SplitSubmitButton />
        <NavMain items={navItems} label="Navigation" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
