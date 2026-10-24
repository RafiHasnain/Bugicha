import { redirect } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Profile } from "@/lib/types"

function pmEmails() {
  return (process.env.PM_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export async function ensureProfile(user: User): Promise<Profile> {
  const admin = createAdminClient()
  const email = user.email ?? ""
  const role = pmEmails().includes(email.toLowerCase()) ? "pm" : "general"
  const fullName =
    typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null

  const { data: existing } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  if (existing) {
    if (role === "pm" && existing.role !== "pm" && existing.role !== "admin") {
      const { data } = await admin
        .from("profiles")
        .update({ role })
        .eq("id", user.id)
        .select("*")
        .single()
      return data as Profile
    }
    return existing as Profile
  }

  const { data, error } = await admin
    .from("profiles")
    .insert({
      id: user.id,
      email,
      full_name: fullName,
      role,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return data as Profile
}

export async function requireUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) redirect("/login")

  const profile = await ensureProfile(data.user)
  return { user: data.user, profile }
}

export function profileName(profile: Profile) {
  return profile.full_name || profile.email.split("@")[0] || "User"
}
