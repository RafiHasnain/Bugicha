"use client"

import { createContext, ReactNode, useContext } from "react"
import type { User } from "@supabase/supabase-js"
import type { Profile, UserRole } from "@/lib/types"

interface AuthContextType {
  user: {
    id: string
    name: string
    email: string
    role: UserRole
    initials: string
  }
  profile: Profile
  role: UserRole
}

const AuthContext = createContext<AuthContextType | null>(null)

function initials(name: string, email: string) {
  const source = name || email
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U"
}

export function AuthProvider({
  authUser,
  profile,
  children,
}: {
  authUser: User
  profile: Profile
  children: ReactNode
}) {
  const name = profile.full_name || profile.email.split("@")[0] || "User"
  const role = profile.role

  return (
    <AuthContext.Provider
      value={{
        profile,
        role,
        user: {
          id: authUser.id,
          name,
          email: profile.email,
          role,
          initials: initials(name, profile.email),
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
