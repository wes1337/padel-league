#!/usr/bin/env node
// Dumps all Supabase data to a timestamped JSON file in /backups.
// Usage: node scripts/backup-supabase.mjs

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backupsDir = path.join(__dirname, '..', 'backups')

// Read env vars from .env.local
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=')
    return [k.trim(), v.join('=').trim()]
  })
)

const SUPABASE_URL = env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
}

async function fetchAll(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers })
  if (!res.ok) throw new Error(`Failed to fetch ${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

const tables = ['leagues', 'players', 'seasons', 'sessions', 'matches', 'session_signups']

console.log('Fetching data from Supabase...')
const data = {}
for (const table of tables) {
  data[table] = await fetchAll(table)
  console.log(`  ${table}: ${data[table].length} rows`)
}

fs.mkdirSync(backupsDir, { recursive: true })

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const filename = `backup-${timestamp}.json`
const filepath = path.join(backupsDir, filename)

fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
console.log(`\nBackup saved to: ${filepath}`)

// Keep only the 10 most recent backups
const backups = fs.readdirSync(backupsDir)
  .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
  .sort()
  .reverse()

for (const old of backups.slice(10)) {
  fs.unlinkSync(path.join(backupsDir, old))
  console.log(`  Pruned old backup: ${old}`)
}
