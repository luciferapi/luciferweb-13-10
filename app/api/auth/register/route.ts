import { NextResponse } from "next/server"
import { beginEmailVerification, discardPendingRegistration } from "@/lib/auth-store"
import { registrationSchema } from "@/lib/auth-validation"
import { sendRegistrationOtp } from "@/lib/email"
import { isReferralCodeAvailable } from "@/lib/referral-store"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  const parsed = registrationSchema.safeParse(body)
  if (!parsed.success) {
    const dateError = parsed.error.issues.find((issue) => issue.path[0] === "dateOfBirth")
    const privacyError = parsed.error.issues.find((issue) => issue.path[0] === "privacyAccepted")
    return NextResponse.json({
      error: dateError?.message ?? privacyError?.message ?? "Check your name, date of birth, email, and password.",
    }, { status: 400 })
  }

  if (parsed.data.referralCode) {
    try {
      if (!await isReferralCodeAvailable(parsed.data.referralCode)) {
        return NextResponse.json({ error: "That referral code is invalid, expired, or no longer available." }, { status: 400 })
      }
    } catch (error) {
      console.error("Could not validate the referral code.", error)
      return NextResponse.json({ error: "Could not validate the referral code right now." }, { status: 500 })
    }
  }

  try {
    const { otp } = await beginEmailVerification(parsed.data)
    try {
      await sendRegistrationOtp(parsed.data.email, otp)
    } catch (error) {
      await discardPendingRegistration(parsed.data.email)
      throw error
    }
    return NextResponse.json({ verificationRequired: true })
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 })
    }
    console.error("Account verification email could not be sent.", error)
    return NextResponse.json({ error: "Could not send a verification email right now. Check the mail settings and try again." }, { status: 503 })
  }
}
