import { readFile } from "node:fs/promises"
import { Client } from "pg"

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL

if (!connectionString) {
  console.error("Missing DIRECT_URL or DATABASE_URL.")
  process.exit(1)
}

const sql = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8")
const chunks = sql
  .split(/^-- apply-schema:break$/m)
  .map((chunk) => chunk.trim())
  .filter(Boolean)
const client = new Client({ connectionString })

try {
  await client.connect()
  for (const chunk of chunks) {
    await client.query(chunk)
  }
  console.log("Schema applied.")
} finally {
  await client.end()
}
