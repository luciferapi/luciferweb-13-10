import { NextResponse } from "next/server"
import { resendPendingRegistrationOtp } from "@/lib/auth-store"
import { emailVerificationSchema } from "@/lib/auth-validation"
import { sendRegistrationOtp } from "@/lib/email"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  const parsed = emailVerificationSchema.pick({ email: true }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })

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

    await sendRegistrationOtp(parsed.data.email, result.otp)

    return NextResponse.json({ message: "A new verification code has been sent.", retryAfterSeconds: 120 })
  } catch (error) {
    console.error("Could not resend the verification email.", error)
    return NextResponse.json({ error: "Could not send a new code. Please try again after the resend timer." }, { status: 503 })
  }
}
