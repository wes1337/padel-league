import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://kyhcstibhrmksipcgujc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5aGNzdGliaHJta3NpcGNndWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyODgxNTYsImV4cCI6MjA4ODg2NDE1Nn0.8p-0jgNKohfmOZcFHxCjvTE6lHpXcrPQBcBSYgWOLk8'
)
