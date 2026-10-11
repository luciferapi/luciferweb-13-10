import "server-only"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { findUserBySession, isEmailOtpSession } from "@/features/auth/server/auth-store"
import { getSignedInUser, hasSupabaseEmailOtpSession } from "@/features/auth/server/auth-session"
import { isOwnerEmail } from "@/features/auth/server/owner-email"
import { ownerModules } from "@/features/owner/owner-modules"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

export type OwnerWorkspaceAccess = {
  user: { id: string; email: string | null; name: string }
  isPrimaryOwner: boolean
  role: "owner" | "co_owner" | "admin" | "customer_support"
  modules: string[]
}

export type OwnerModuleSlug = (typeof ownerModules)[number]["slug"]

export async function getOwnerWorkspaceAccess(): Promise<OwnerWorkspaceAccess | null> {
  const cookieStore = await cookies()
  const ownerToken = cookieStore.get("lucifer_owner_session")?.value
  const fallbackToken = cookieStore.get("lucifer_session")?.value
  let token: string | null = null
  let user = null

  for (const candidateToken of [ownerToken, fallbackToken]) {
    if (!candidateToken) continue
    const candidateUser = await findUserBySession(candidateToken)
    if (!candidateUser) continue
    token = candidateToken
    user = candidateUser
    break
  }

  if (!user) user = await getSignedInUser()
  if (!user?.email) return null

  if (isOwnerEmail(user.email)) {
    const verifiedByEmailOtp = token
      ? await isEmailOtpSession(token)
      : await hasSupabaseEmailOtpSession()
    if (!verifiedByEmailOtp) return null
    return {
      user: { id: user.id, email: user.email, name: user.name },
      isPrimaryOwner: true,
      role: "owner",
      modules: ownerModules.map((module) => module.slug),
    }
  }

  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase admin access is not configured.")
  const [assignmentResult, profileResult] = await Promise.all([
    client.from("owner_admins").select("role, allowed_modules").eq("user_id", user.id).maybeSingle(),
    client.from("auth_users").select("is_blocked").eq("id", user.id).maybeSingle(),
  ])
  if (assignmentResult.error) throw assignmentResult.error
  if (profileResult.error) throw profileResult.error
  const assignment = assignmentResult.data
  if (!assignment || profileResult.data?.is_blocked) return null
  if (!["co_owner", "admin", "customer_support"].includes(assignment.role)) {
    throw new Error("The staff role configuration is invalid.")
  }
  return {
    user: { id: user.id, email: user.email, name: user.name },
    isPrimaryOwner: false,
    role: assignment.role,
    modules: assignment.allowed_modules,
  }
}

export async function requireOwnerAccess(module?: OwnerModuleSlug): Promise<NextResponse | null> {
  try {
    const access = await getOwnerWorkspaceAccess()
    if (!access) return NextResponse.json({ error: "Sign in with an authorized owner or staff account." }, { status: 401 })
    if (module === "admins" && !access.isPrimaryOwner) {
      return NextResponse.json({ error: "Only the primary owner can manage staff access." }, { status: 403 })
    }
    if (module && !access.isPrimaryOwner && !access.modules.includes(module)) {
      return NextResponse.json({ error: "Your staff account does not have access to this module." }, { status: 403 })
    }
    if (!module && !access.isPrimaryOwner) {
      return NextResponse.json({ error: "Only the primary owner can perform this action." }, { status: 403 })
    }
    return null
  } catch (error) {
    console.error("Could not verify owner or staff access.", error)
    return NextResponse.json({ error: "Could not verify access right now." }, { status: 500 })
  }
}

export async function requirePrimaryOwnerAccess(): Promise<NextResponse | null> {
  return requireOwnerAccess()
}
