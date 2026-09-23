import postgres from "postgres"
import fs from "node:fs"
const env = fs.readFileSync("/home/amber/Documents/mainframe/Alkemart4/Alkemart4/.local/supabase-alkemart.env", "utf8")
const url = env.split("\n").find((l) => l.startsWith("DATABASE_URL_POOLER="))!.slice("DATABASE_URL_POOLER=".length).trim()
const sql = postgres(url.replace("?sslmode=require", ""), { max: 1, connect_timeout: 10 })
try { const r = await sql`select 1 as ok`; console.log("direct PG:", r[0].ok) }
catch (e: any) { console.log("direct PG FAIL:", e.message.slice(0, 120)) }
await sql.end()
