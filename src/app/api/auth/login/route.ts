import { NextResponse } from "next/server"
import { authenticateUser, createSession, getOtpLoginTypeByEmail } from "@/features/auth/server/auth-store"
import { setAuthSessionCookie } from "@/features/auth/server/auth-cookie"
import { loginSchema } from "@/features/auth/server/auth-validation"
import { readLimitedJson } from "@/lib/server/read-limited-json"
import { enforceRateLimit } from "@/lib/server/rate-limit"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = await readLimitedJson(request, 8 * 1024)
  if (!body.ok) {
    return NextResponse.json(
      { error: body.status === 413 ? "The request is too large." : "Send a valid JSON request body." },
      { status: body.status },
    )
  }
  const parsed = loginSchema.safeParse(body.value)
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 })
  }

  const rateLimitResponse = await enforceRateLimit(request, "login", {
    capacity: 10,
    refillSeconds: 15 * 60,
    identifiers: [parsed.data.email],
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    if (await getOtpLoginTypeByEmail(parsed.data.email)) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 })
    }

    const user = await authenticateUser(parsed.data.email, parsed.data.password)
    if (!user) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 })

    const session = await createSession(user.id, "password")
    const response = NextResponse.json({ user })
    setAuthSessionCookie(response, session, parsed.data.rememberMe, "user")
    return response
  } catch (error) {
    console.error("Sign-in failed.", error)
    return NextResponse.json({ error: "Could not sign in right now." }, { status: 500 })
  }
}
