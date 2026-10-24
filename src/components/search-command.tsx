"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAppData } from "@/lib/data-store"
import { SEVERITY_CONFIG } from "@/lib/ticket-config"
import { IconChartBar, IconBug, IconHome, IconInbox, IconLayoutKanban, IconList, IconSearch, IconStar, IconChecklist } from "@tabler/icons-react"

const TYPE_ICON = { bug: IconBug, feature_request: IconStar, task: IconChecklist }

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard", icon: IconHome },
  { label: "All Tickets", href: "/dashboard/tickets", icon: IconList },
  { label: "Review Queue", href: "/dashboard/review", icon: IconInbox },
  { label: "Kanban Board", href: "/dashboard/kanban", icon: IconLayoutKanban },
  { label: "Reports", href: "/dashboard/reports", icon: IconChartBar },
]

export function SearchCommand() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { tickets } = useAppData()

  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-2 px-3 text-sm text-muted-foreground hidden sm:flex"
      >
        <IconSearch className="size-3.5" />
        Search…
        <kbd className="ml-1 rounded border bg-muted px-1.5 font-mono text-[10px]">⌘K</kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="size-8 sm:hidden"
      >
        <IconSearch className="size-4" />
        <span className="sr-only">Search</span>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder="Search tickets, pages…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup heading="Pages">
              {NAV_ITEMS.map((item) => (
                <CommandItem
                  key={item.href}
                  value={item.label}
                  onSelect={() => go(item.href)}
                  className="gap-2"
                >
                  <item.icon className="size-4 text-muted-foreground" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Tickets">
              {tickets.map((ticket) => {
                const severity = SEVERITY_CONFIG[ticket.severity]
                const Icon = TYPE_ICON[ticket.type]
                return (
                  <CommandItem
                    key={ticket.id}
                    value={`${ticket.id} ${ticket.title} ${ticket.description}`}
                    onSelect={() => go(`/dashboard/tickets/${ticket.id}`)}
                    className="gap-2"
                  >
                    <Icon className="size-4 text-muted-foreground shrink-0" />
                    <span className="font-mono text-xs text-muted-foreground shrink-0">{ticket.id}</span>
                    <span className="flex-1 truncate">{ticket.title}</span>
                    <Badge variant={severity.variant} className="text-[10px] shrink-0">
                      {severity.label}
                    </Badge>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
