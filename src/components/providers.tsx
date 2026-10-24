"use client"

import { TooltipProvider } from "@/components/ui/tooltip"
import { ReactNode } from "react"

export function Providers({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>
}
