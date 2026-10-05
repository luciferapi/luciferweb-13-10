import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { findUserBySession } from "@/lib/auth-store"

export async function getSignedInUser() {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return null
  return await findUserBySession(token)
}

export async function requireSignedInUser(destination: string) {
  const user = await getSignedInUser()
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(destination)}`)
  return user
}
