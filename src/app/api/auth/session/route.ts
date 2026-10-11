import { NextResponse } from "next/server"
import { getSignedInUser } from "@/features/auth/server/auth-session"

export const runtime = "nodejs"

export async function GET() {
  try {
    const user = await getSignedInUser()
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 })
    return NextResponse.json({ user })
  } catch (error) {
    console.error("Could not verify the sign-in session.", error)
    return NextResponse.json({ error: "Could not verify your session right now." }, { status: 500 })
  }
}
