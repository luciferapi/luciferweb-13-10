import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseEnv } from "@/lib/supabase"

let cachedAuthClient: SupabaseClient | null = null

export function getSupabaseAuthServerClient(): SupabaseClient {
  if (cachedAuthClient) return cachedAuthClient

  const { url, key, enabled } = getSupabaseEnv()
  if (!enabled || !url || !key) throw new Error("Supabase Auth is not configured.")

  cachedAuthClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
  return cachedAuthClient
}
