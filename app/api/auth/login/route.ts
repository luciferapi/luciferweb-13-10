import { NextResponse } from "next/server"
import { authenticateUser, createSession, SESSION_DURATION_SECONDS } from "@/lib/auth-store"
import { loginSchema } from "@/lib/auth-validation"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 })
  }

  try {
    const user = await authenticateUser(parsed.data.email, parsed.data.password)
    if (!user) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 })

    const session = await createSession(user.id)
    const response = NextResponse.json({ user })
    response.cookies.set("lucifer_session", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: session.expiresAt,
      maxAge: SESSION_DURATION_SECONDS,
    })
    return response
  } catch (error) {
    console.error("Sign-in failed.", error)
    return NextResponse.json({ error: "Could not sign in right now." }, { status: 500 })
  }
}
