import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { findUserBySession } from "@/lib/auth-store"

const OWNER_EMAIL = "kspgpraveen157@gmail.com"

export function isOwnerEmail(email: string) {
  return email.trim().toLowerCase() === OWNER_EMAIL
}

export async function requireOwnerAccess(): Promise<NextResponse | null> {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Sign in to access owner tools." }, { status: 401 })

  try {
    const user = await findUserBySession(token)
    if (!user) return NextResponse.json({ error: "Sign in to access owner tools." }, { status: 401 })
    if (!isOwnerEmail(user.email)) {
      return NextResponse.json({ error: "You are not authorized to access owner tools." }, { status: 403 })
    }
    return null
  } catch (error) {
    console.error("Could not verify owner access.", error)
    return NextResponse.json({ error: "Could not verify owner access right now." }, { status: 500 })
  }
}
