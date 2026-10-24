"use client"

import { ReactNode } from "react"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { NotificationBell } from "@/components/notification-bell"
import { SearchCommand } from "@/components/search-command"

export function DashboardHeader({ children }: { children: ReactNode }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex flex-1 items-center gap-2 px-4 min-w-0">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
        <div className="flex-1 min-w-0">{children}</div>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <SearchCommand />
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
