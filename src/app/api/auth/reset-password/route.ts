import { NextResponse } from "next/server"
import { resetPassword } from "@/features/auth/server/auth-store"
import { passwordResetSchema } from "@/features/auth/server/auth-validation"
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
  const parsed = passwordResetSchema.safeParse(body.value)
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid reset link and a password of at least eight characters." }, { status: 400 })
  }

  const rateLimitResponse = await enforceRateLimit(request, "password-reset-complete", {
    capacity: 10,
    refillSeconds: 10 * 60,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const updated = await resetPassword(parsed.data.token, parsed.data.password)
    if (!updated) return NextResponse.json({ error: "This password reset link is invalid or expired." }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Password reset failed.", error)
    return NextResponse.json({ error: "Could not reset the password right now." }, { status: 500 })
  }
}
