import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { findUserBySession } from "@/lib/auth-store"

export const runtime = "nodejs"

export async function GET() {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Not signed in." }, { status: 401 })

  try {
    const user = await findUserBySession(token)
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 })
    return NextResponse.json({ user })
  } catch (error) {
    console.error("Could not verify the sign-in session.", error)
    return NextResponse.json({ error: "Could not verify your session right now." }, { status: 500 })
  }
}
