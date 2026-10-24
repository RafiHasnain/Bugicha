"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { useAppData } from "@/lib/data-store"
import { Notification, NotificationType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { IconArrowRight, IconClipboardList, IconBell, IconMessage, IconCircleCheck } from "@tabler/icons-react"

const TYPE_ICON: Record<NotificationType, React.ComponentType<{ className?: string; size?: number; stroke?: number }>> = {
  assigned: IconClipboardList,
  assignment: IconClipboardList,
  status: IconArrowRight,
  status_change: IconArrowRight,
  comment: IconMessage,
  mention: IconMessage,
}

function NotificationItem({
  notification,
  onRead,
  onClose,
}: {
  notification: Notification
  onRead: (id: string) => void
  onClose: () => void
}) {
  const router = useRouter()
  const Icon = TYPE_ICON[notification.type]

  function handleClick() {
    onRead(notification.id)
    onClose()
    if (notification.ticket_id) {
      router.push(`/dashboard/tickets/${notification.ticket_id}`)
    }
  }

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors border-b last:border-b-0",
        !notification.read && "bg-accent/20"
      )}
      onClick={handleClick}
    >
      <div className={cn(
        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
        !notification.read ? "bg-primary/10" : "bg-muted"
      )}>
        <Icon
          className={cn("size-3.5", !notification.read ? "text-primary" : "text-muted-foreground")}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm leading-snug", !notification.read && "font-medium")}>
            {notification.title}
          </p>
          {!notification.read && <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(notification.created_at).toLocaleDateString(undefined, {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  )
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useAppData()
  const unread = notifications.filter((n) => !n.read).length

  function markRead(id: string) {
    void markNotificationRead(id)
  }

  function markAllRead() {
    void markAllNotificationsRead()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-8">
          <IconBell className="size-4" />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white leading-none">
              {unread}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 gap-0 overflow-hidden"
        align="end"
        sideOffset={6}
        collisionPadding={8}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unread > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {unread}
              </span>
            )}
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>

        {/* Scrollable list — plain overflow div so height constraint is respected */}
        <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <IconCircleCheck className="size-8" />
              <p className="text-sm">All caught up!</p>
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onRead={markRead} onClose={() => setOpen(false)} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t p-2">
          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
