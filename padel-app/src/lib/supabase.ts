import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kyhcstibhrmksipcgujc.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5aGNzdGliaHJta3NpcGNndWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyODgxNTYsImV4cCI6MjA4ODg2NDE1Nn0.8p-0jgNKohfmOZcFHxCjvTE6lHpXcrPQBcBSYgWOLk8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
