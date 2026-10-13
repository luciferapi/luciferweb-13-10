import { createBrowserClient, createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || null

  return {
    url,
    key,
    enabled: Boolean(url && key),
  }
}

export function getSupabaseBrowserClient() {
  const { url, key, enabled } = getSupabaseEnv()
  if (!enabled || !url || !key) return null
  return createBrowserClient(url, key)
}

export async function getSupabaseServerClient() {
  const { url, key, enabled } = getSupabaseEnv()
  if (!enabled || !url || !key) return null

  const cookieStore = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch (error) {
          console.warn("Could not persist Supabase auth cookies in this request.", error)
        }
      },
    },
  })
}
