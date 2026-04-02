import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const skipAuth = import.meta.env.VITE_SKIP_AUTH === 'true'

// Connect to Supabase whenever credentials exist — even with VITE_SKIP_AUTH=true.
// skipAuth only skips the login flow; it does NOT disable the database.
const hasCredentials = !!(supabaseUrl && supabaseAnonKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co')

if (!hasCredentials) {
  console.info('[OpsFlow] Supabase not configured — running in mock mode. Copy .env.example → .env.local to connect a real database.')
} else if (skipAuth) {
  console.info('[OpsFlow] VITE_SKIP_AUTH=true — skipping login, using demo user. Database is still connected.')
}

export const supabase = hasCredentials
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
