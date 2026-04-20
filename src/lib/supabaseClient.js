import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const skipAuth = import.meta.env.VITE_SKIP_AUTH === 'true'
export const hasSupabaseCredentials = !!(supabaseUrl && supabaseAnonKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co')

// Connect to Supabase whenever credentials exist — even with VITE_SKIP_AUTH=true.
// skipAuth only skips the login flow; it does NOT disable the database.
export const missingSupabaseConfigMessage = 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before deploying the hosted demo.'

if (!hasSupabaseCredentials) {
  console.info('[OpsFlow] Supabase not configured — running in mock mode. Copy .env.example → .env.local to connect a real database.')
} else if (skipAuth) {
  console.info('[OpsFlow] VITE_SKIP_AUTH=true — skipping login, using demo user. Database is still connected.')
}

export const supabase = hasSupabaseCredentials
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
