import { createClient } from "@supabase/supabase-js"
import { randomBytes } from "node:crypto"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRole) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
  process.exit(1)
}

const supabase = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const password = process.env.SEED_PASSWORD || `${randomBytes(18).toString("base64url")}aA1!`
const users = [
  { email: "pm@bugicha.test", full_name: "Morgan Kim", role: "pm" },
  { email: "engineer@bugicha.test", full_name: "Sam Rivera", role: "engineer" },
  { email: "user@bugicha.test", full_name: "Alex Chen", role: "general" },
]

async function getOrgAndProject() {
  let { data: org, error: orgSelectError } = await supabase
    .from("orgs")
    .select("*")
    .eq("name", "Fringecore")
    .maybeSingle()
  if (orgSelectError) throw orgSelectError

  if (!org) {
    const { data, error } = await supabase.from("orgs").insert({ name: "Fringecore" }).select("*").single()
    if (error) throw error
    org = data
  }

  let { data: project, error: projectSelectError } = await supabase
    .from("projects")
    .select("*")
    .eq("org_id", org.id)
    .eq("key", "WEB")
    .maybeSingle()
  if (projectSelectError) throw projectSelectError

  if (!project) {
    const { data, error } = await supabase
      .from("projects")
      .insert({ org_id: org.id, key: "WEB", name: "Bugicha Web" })
      .select("*")
      .single()
    if (error) throw error
    project = data
  }

  return { org, project }
}

const { org, project } = await getOrgAndProject()

async function upsertUser(seedUser) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: seedUser.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: seedUser.full_name },
  })

  if (error && !error.message.toLowerCase().includes("already")) throw error

  const user = data.user ?? (await findUser(seedUser.email))
  if (!user) throw new Error(`Could not find ${seedUser.email}`)

  if (!data.user) {
    const { error: passwordError } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: seedUser.full_name },
    })
    if (passwordError) throw passwordError
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    org_id: org.id,
    email: seedUser.email,
    full_name: seedUser.full_name,
    role: seedUser.role,
  })

  if (profileError) throw profileError
  return user
}

async function findUser(email) {
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) throw error
  return data.users.find((user) => user.email === email)
}

const [pm, engineer, general] = await Promise.all(users.map(upsertUser))

const { error: membersError } = await supabase.from("project_members").upsert([
  { project_id: project.id, user_id: pm.id },
  { project_id: project.id, user_id: engineer.id },
])
if (membersError) throw membersError

const { data: existing } = await supabase
  .from("tickets")
  .select("id, status")
  .eq("title", "Seed: Login page throws after invalid password")
  .maybeSingle()

if (!existing) {
  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      org_id: org.id,
      project_id: project.id,
      title: "Seed: Login page throws after invalid password",
      description: "Seed ticket for PM review and engineer assignment workflow.",
      type: "bug",
      severity: "high",
      priority: "p1",
      status: "assigned",
      reporter_id: general.id,
      assignee_id: engineer.id,
      source_url: "http://localhost:3000/login",
      capture: {
        url: "http://localhost:3000/login",
        route: "/login",
        user_agent: "seed",
        browser: "seed",
        os: "seed",
        viewport: { w: 1280, h: 720 },
        device_pixel_ratio: 1,
        environment: "development",
        app_version: null,
        captured_at: new Date().toISOString(),
      },
    })
    .select("id")
    .single()

  if (error) throw error

  const { error: commentError } = await supabase.from("ticket_comments").insert({
    org_id: org.id,
    ticket_id: ticket.id,
    author_id: pm.id,
    body: "Seed data: assigned to engineering for triage.",
  })

  if (commentError) throw commentError
} else {
  const { error } = await supabase
    .from("tickets")
    .update({
      org_id: org.id,
      project_id: project.id,
      priority: "p1",
      status: "assigned",
      reporter_id: general.id,
      assignee_id: engineer.id,
    })
    .eq("id", existing.id)
  if (error) throw error
}

console.log("Seed complete.")
console.log(`PM/Admin:   pm@bugicha.test / ${password}`)
console.log(`Engineer:   engineer@bugicha.test / ${password}`)
console.log(`General:    user@bugicha.test / ${password}`)
