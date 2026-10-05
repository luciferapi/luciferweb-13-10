import { notFound } from "next/navigation"
import { cookies } from "next/headers"
import { findUserBySession } from "@/lib/auth-store"
import { isOwnerEmail } from "@/lib/owner-access"

export const dynamic = "force-dynamic"

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get("lucifer_session")?.value
  const user = token ? await findUserBySession(token) : null
  if (!user || !isOwnerEmail(user.email)) notFound()
  return children
}