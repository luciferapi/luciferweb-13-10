import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { findUserBySession, findUserBySupabaseAuthId } from "@/features/auth/server/auth-store"
import { getSupabaseServerClient } from "@/lib/supabase"

export function toSupabaseAuthUser(user: {
  id: string
  email?: string | null
  user_metadata?: {
    name?: string | null
    publicUid?: string | null
    dateOfBirth?: string | null
    telegramUsername?: string | null
    xUsername?: string | null
  }
}) {
  return {
    id: user.id,
    publicUid: user.user_metadata?.publicUid ?? "",
    name: user.user_metadata?.name ?? user.email ?? "User",
    email: user.email ?? null,
    dateOfBirth: user.user_metadata?.dateOfBirth ?? null,
    telegramUsername: user.user_metadata?.telegramUsername ?? null,
    xUsername: user.user_metadata?.xUsername ?? null,
    nameEditUsed: false,
    dateOfBirthEditUsed: false,
  }
}

export async function hasSupabaseEmailOtpSession() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return false

  const { data, error } = await supabase.auth.getClaims()
  if (error) {
    if (error.status && error.status < 500) return false
    throw error
  }
  if (!data) return false

  const methods = data.claims.amr
  return Array.isArray(methods) && methods.some((method) => (
    method === "otp" ||
    (typeof method === "object" && method !== null && "method" in method && method.method === "otp")
  ))
}

export async function getSignedInUser() {
  const cookieStore = await cookies()
  const tokens = [
    cookieStore.get("lucifer_session")?.value,
    cookieStore.get("lucifer_owner_session")?.value,
  ]

  for (const token of tokens) {
    if (!token) continue
    const user = await findUserBySession(token)
    if (user) return user
  }

  const supabase = await getSupabaseServerClient()
  if (supabase) {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (!error && user) {
      const profile = await findUserBySupabaseAuthId(user.id)
      return profile ?? toSupabaseAuthUser(user)
    }
  }

  return null
}

export async function requireSignedInUser(destination: string) {
  const user = await getSignedInUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(destination)}`)
  return user
}
