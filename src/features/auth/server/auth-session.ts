import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { findUserBySession, isEmailOtpSession } from "@/features/auth/server/auth-store"

export async function hasEmailOtpSession(token: string | null | undefined): Promise<boolean> {
  return token ? isEmailOtpSession(token) : false
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
  return null
}

export async function requireSignedInUser(destination: string) {
  const user = await getSignedInUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(destination)}`)
  return user
}
