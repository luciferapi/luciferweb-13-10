import "server-only"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { findUserBySession } from "@/features/auth/server/auth-store"
import { getSignedInUser, hasEmailOtpSession } from "@/features/auth/server/auth-session"
import { isOwnerEmail } from "@/features/auth/server/owner-email"
import { ownerModules } from "@/features/owner/owner-modules"
import { selectMysqlRows } from "@/lib/mysql"
import type { RowDataPacket } from "mysql2"

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
    const verifiedByEmailOtp = await hasEmailOtpSession(token)
    if (!verifiedByEmailOtp) return null
    return {
      user: { id: user.id, email: user.email, name: user.name },
      isPrimaryOwner: true,
      role: "owner",
      modules: ownerModules.map((module) => module.slug),
    }
  }

  const [assignments, profiles] = await Promise.all([
    selectMysqlRows<RowDataPacket & {
      role: string
      allowed_modules: string[] | string
    }>(
      "SELECT role, allowed_modules FROM owner_admins WHERE user_id = ? LIMIT 1",
      [user.id],
    ),
    selectMysqlRows<RowDataPacket & { is_blocked: boolean | number }>(
      "SELECT is_blocked FROM auth_users WHERE id = ? LIMIT 1",
      [user.id],
    ),
  ])
  const assignment = assignments[0]
  const profile = profiles[0]
  if (!assignment || profile?.is_blocked) return null
  const verifiedByEmailOtp = await hasEmailOtpSession(token)
  if (!verifiedByEmailOtp) return null
  if (
    assignment.role !== "co_owner"
    && assignment.role !== "admin"
    && assignment.role !== "customer_support"
  ) {
    throw new Error("The staff role configuration is invalid.")
  }
  const allowedModules: unknown = typeof assignment.allowed_modules === "string"
    ? JSON.parse(assignment.allowed_modules)
    : assignment.allowed_modules
  if (!Array.isArray(allowedModules) || !allowedModules.every((module) => typeof module === "string")) {
    throw new Error("The staff module configuration is invalid.")
  }
  return {
    user: { id: user.id, email: user.email, name: user.name },
    isPrimaryOwner: false,
    role: assignment.role,
    modules: allowedModules,
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
