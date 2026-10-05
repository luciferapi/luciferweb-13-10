import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { deleteSession } from "@/lib/auth-store"

export const runtime = "nodejs"

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get("lucifer_session")?.value

  try {
    if (token) await deleteSession(token)
  } catch (error) {
    console.error("Could not revoke the sign-in session.", error)
    return NextResponse.json({ error: "Could not sign out right now." }, { status: 500 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set("lucifer_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  })
  return response
}
