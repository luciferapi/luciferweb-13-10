import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseEnv } from "@/lib/supabase"

let cachedAuthClient: SupabaseClient | null = null

export function getSupabaseAuthServerClient(): SupabaseClient {
  if (cachedAuthClient) return cachedAuthClient

  const { url, key } = getSupabaseEnv()
  const serverKey = key || process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null
  if (!url || !serverKey) throw new Error("Supabase Auth is not configured.")

  cachedAuthClient = createClient(url, serverKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
  return cachedAuthClient
}
