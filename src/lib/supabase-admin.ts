import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let cachedAdminClient: SupabaseClient | null = null

export function getSupabaseAdminClient() {
  if (cachedAdminClient) return cachedAdminClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!url) return null

  const key = process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) return null

  cachedAdminClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
  return cachedAdminClient
}
