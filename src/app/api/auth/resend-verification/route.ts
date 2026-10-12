import { NextResponse } from "next/server"
import { resendPendingRegistrationOtp } from "@/features/auth/server/auth-store"
import { emailVerificationSchema } from "@/features/auth/server/auth-validation"
import { sendRegistrationOtp } from "@/features/notifications/server/email"
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
  const parsed = emailVerificationSchema.pick({ email: true }).safeParse(body.value)
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })

  const rateLimitResponse = await enforceRateLimit(request, "registration-otp-resend", {
    capacity: 5,
    refillSeconds: 15 * 60,
    identifiers: [parsed.data.email],
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const result = await resendPendingRegistrationOtp(parsed.data.email)
    if (result.status === "cooldown") {
      return NextResponse.json(
        { error: "Please wait before requesting another code.", retryAfterSeconds: result.retryAfterSeconds },
        { status: 429 },
      )
    }
    if (result.status !== "sent") {
      return NextResponse.json({ error: "This signup verification has expired. Start account creation again." }, { status: 410 })
    }

    await sendRegistrationOtp(parsed.data.email, result.otp, result.name)

    return NextResponse.json({
      message: "The email server accepted a new verification code. Check your inbox and spam or junk folder.",
      retryAfterSeconds: 60,
      verificationType: "signup",
    })
  } catch (error) {
    console.error("Could not resend the verification email.", error)
    return NextResponse.json({ error: "Could not send a new code. Please try again after the resend timer." }, { status: 503 })
  }
}
