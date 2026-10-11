import { NextResponse } from "next/server"
import { verifyEmailRegistration, SESSION_DURATION_SECONDS } from "@/features/auth/server/auth-store"
import { emailVerificationSchema } from "@/features/auth/server/auth-validation"
import { readLimitedJson } from "@/lib/server/read-limited-json"
import { enforceRateLimit } from "@/lib/server/rate-limit"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = await readLimitedJson(request, 4 * 1024)
  if (!body.ok) {
    return NextResponse.json(
      { error: body.status === 413 ? "The request is too large." : "Send a valid JSON request body." },
      { status: body.status },
    )
  }
  const parsed = emailVerificationSchema.safeParse(body.value)
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the email address and six-digit verification code." }, { status: 400 })
  }

  const rateLimitResponse = await enforceRateLimit(request, "registration-otp-verify", {
    capacity: 10,
    refillSeconds: 10 * 60,
    identifiers: [parsed.data.email],
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const result = await verifyEmailRegistration(parsed.data.email, parsed.data.otp)
    if (result.status !== "verified") {
      const errors = {
        invalid: "The verification code is incorrect.",
        missing: "This signup verification is no longer active. Start account creation again.",
        expired: "The verification code has expired. Request a new code below.",
        "attempts-exceeded": "Too many incorrect codes. Start account creation again.",
        "already-registered": "An account with this email already exists. Sign in instead.",
        "ip-already-registered": "An account has already been created from this network.",
      } as const
      const status = result.status === "already-registered" || result.status === "ip-already-registered" ? 409 : 400
      return NextResponse.json({ error: errors[result.status] }, { status })
    }

    const response = NextResponse.json({ user: result.user }, { status: 201 })
    response.cookies.set("lucifer_session", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: result.expiresAt,
      maxAge: SESSION_DURATION_SECONDS,
    })
    return response
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 })
    }
    console.error("Email verification failed.", error)
    return NextResponse.json({ error: "Could not verify your email right now." }, { status: 500 })
  }
}
