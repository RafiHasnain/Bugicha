import { AppSidebar } from "@/components/app-sidebar"
import { AuthProvider } from "@/components/auth-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { DataProvider } from "@/lib/data-store"
import { requireUser } from "@/lib/auth/server"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireUser()

  return (
    <AuthProvider authUser={user} profile={profile}>
      <DataProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
      </DataProvider>
    </AuthProvider>
  )
}
