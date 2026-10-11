import { NextResponse } from "next/server"
import {
  beginEmailVerification,
  discardPendingRegistration,
  SignupIpAlreadyUsedError,
} from "@/features/auth/server/auth-store"
import { registrationSchema } from "@/features/auth/server/auth-validation"
import { sendRegistrationOtp } from "@/features/notifications/server/email"
import { isReferralCodeAvailable } from "@/features/referrals/server/referral-store"
import { getSignupIpHash, SignupIpUnavailableError } from "@/features/auth/server/signup-ip"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { isSupabaseSchemaUnavailable } from "@/lib/supabase-errors"
import { readLimitedJson } from "@/lib/server/read-limited-json"
import { enforceRateLimit } from "@/lib/server/rate-limit"

export const runtime = "nodejs"

function isEmailAlreadyRegistered(error: unknown) {
  if (typeof error !== "object" || error === null) return false
  const code = "code" in error ? error.code : undefined
  const message = "message" in error && typeof error.message === "string" ? error.message : ""
  return code === "user_already_exists" ||
    code === "email_exists" ||
    /a user with this email address has already been registered/i.test(message)
}

function supabaseSetupError() {
  return NextResponse.json({
    error: "Account registration is temporarily unavailable. Configure the server-only Supabase secret and apply the Supabase migrations, then try again.",
  }, { status: 503 })
}

export async function POST(request: Request) {
  const body = await readLimitedJson(request, 16 * 1024)
  if (!body.ok) {
    return NextResponse.json(
      { error: body.status === 413 ? "The request is too large." : "Send a valid JSON request body." },
      { status: body.status },
    )
  }
  const parsed = registrationSchema.safeParse(body.value)
  if (!parsed.success) {
    const dateError = parsed.error.issues.find((issue) => issue.path[0] === "dateOfBirth")
    const privacyError = parsed.error.issues.find((issue) => issue.path[0] === "privacyAccepted")
    return NextResponse.json({
      error: dateError?.message ?? privacyError?.message ?? parsed.error.issues[0]?.message ?? "Check your name, email, and password.",
    }, { status: 400 })
  }

  const rateLimitResponse = await enforceRateLimit(request, "registration", {
    capacity: 5,
    refillSeconds: 15 * 60,
    identifiers: [parsed.data.email],
  })
  if (rateLimitResponse) return rateLimitResponse

  if (!getSupabaseAdminClient()) {
    console.error("Account registration is unavailable because server-side Supabase credentials are not configured.")
    return supabaseSetupError()
  }

  if (parsed.data.referralCode) {
    try {
      if (!await isReferralCodeAvailable(parsed.data.referralCode)) {
        return NextResponse.json({
          error: "That referral code is invalid, expired, or no longer available. Remove it to continue without a referral code.",
        }, { status: 400 })
      }
    } catch (error) {
      console.error("Could not validate the referral code.", error)
      if (isSupabaseSchemaUnavailable(error)) return supabaseSetupError()
      return NextResponse.json({
        error: "Referral code validation is temporarily unavailable. The code is optional; clear it and try again, or retry later.",
      }, { status: 503 })
    }
  }

  try {
    const { otp } = await beginEmailVerification({
      ...parsed.data,
      signupIpHash: getSignupIpHash(request),
    })
    try {
      await sendRegistrationOtp(parsed.data.email, otp, parsed.data.name)
    } catch (error) {
      await discardPendingRegistration(parsed.data.email)
      throw error
    }
    return NextResponse.json({ verificationRequired: true })
  } catch (error) {
    if (error instanceof SignupIpAlreadyUsedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof SignupIpUnavailableError) {
      console.error("Signup IP could not be determined.", error)
      return NextResponse.json({ error: "Could not verify your network address for signup." }, { status: 503 })
    }
    if (isEmailAlreadyRegistered(error)) {
      return NextResponse.json({
        error: "An account with this email already exists. Sign in or use Forgot password to regain access.",
      }, { status: 409 })
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 })
    }
    if (isSupabaseSchemaUnavailable(error)) return supabaseSetupError()
    console.error("Account verification email could not be sent.", error)
    return NextResponse.json({
      error: "We could not create your verification request. Check the Supabase server credentials and app SMTP settings, then try again.",
    }, { status: 503 })
  }
}
