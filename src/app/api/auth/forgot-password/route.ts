import { NextResponse } from "next/server"
import { createPasswordResetToken, deletePasswordResetToken } from "@/features/auth/server/auth-store"
import { loginSchema } from "@/features/auth/server/auth-validation"
import { sendPasswordResetEmail, verifySmtpConfiguration } from "@/features/notifications/server/email"
import { isSmtpConfigured } from "@/lib/smtp-server"
import { readLimitedJson } from "@/lib/server/read-limited-json"
import { enforceRateLimit } from "@/lib/server/rate-limit"

export const runtime = "nodejs"
const GENERIC_RESPONSE = {
  message: "If an account exists for that email, password reset instructions will be sent.",
}

export async function POST(request: Request) {
  const body = await readLimitedJson(request, 4 * 1024)
  if (!body.ok) {
    return NextResponse.json(
      { error: body.status === 413 ? "The request is too large." : "Send a valid JSON request body." },
      { status: body.status },
    )
  }
  const parsed = loginSchema.pick({ email: true }).safeParse(body.value)
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })

  const rateLimitResponse = await enforceRateLimit(request, "password-reset", {
    capacity: 10,
    refillSeconds: 60 * 60,
    identifiers: [parsed.data.email],
  })
  if (rateLimitResponse) return rateLimitResponse

  let token: string | null
  try {
    token = await createPasswordResetToken(parsed.data.email)
  } catch (error) {
    console.error("Could not create a password reset request.", error)
    return NextResponse.json({ error: "Password reset is temporarily unavailable." }, { status: 503 })
  }

  if (!token) return NextResponse.json(GENERIC_RESPONSE)

  const baseUrl = process.env.APP_URL ?? (process.env.NODE_ENV === "development" ? new URL(request.url).origin : "https://luciferapi.com")
  const resetUrl = new URL("/login", baseUrl)
  resetUrl.searchParams.set("reset", token)

  try {
    if (!isSmtpConfigured()) {
      if (process.env.NODE_ENV !== "production") {
        console.info(`Password reset URL for ${parsed.data.email}: ${resetUrl.toString()}`)
        return NextResponse.json(GENERIC_RESPONSE)
      }
      throw new Error("SMTP is not configured for password reset emails.")
    }

    await verifySmtpConfiguration()
    await sendPasswordResetEmail(parsed.data.email, resetUrl.toString())
  } catch (error) {
    console.error("Password reset email could not be sent.", error)
    try {
      await deletePasswordResetToken(token)
    } catch (cleanupError) {
      console.error("Could not invalidate the unsent password reset link.", cleanupError)
    }
  }

  return NextResponse.json(GENERIC_RESPONSE)
}
