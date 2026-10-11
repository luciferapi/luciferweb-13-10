import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { OAUTH_COOKIE_MAX_AGE } from "@/features/auth/server/auth-oauth"
import { socialSignupSchema } from "@/features/auth/server/auth-validation"
import { isReferralCodeAvailable } from "@/features/referrals/server/referral-store"
import { readLimitedJson } from "@/lib/server/read-limited-json"
import { enforceRateLimit } from "@/lib/server/rate-limit"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!process.env.TELEGRAM_BOT_USERNAME || !process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "Telegram sign-in is not configured." }, { status: 503 })
  }

  const rateLimitResponse = await enforceRateLimit(request, "telegram-login-state", {
    capacity: 10,
    refillSeconds: 10 * 60,
  })
  if (rateLimitResponse) return rateLimitResponse

  const bodyResult = await readLimitedJson(request, 4 * 1024)
  if (!bodyResult.ok) {
    return NextResponse.json(
      { error: bodyResult.status === 413 ? "The request is too large." : "Send a valid JSON request body." },
      { status: bodyResult.status },
    )
  }
  const body = bodyResult.value
  const data = typeof body === "object" && body !== null && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {}
  const isSignup = data.intent === "create-account"
  const signup = isSignup
    ? socialSignupSchema.safeParse({
        dateOfBirth: data.dateOfBirth,
        privacyAccepted: data.privacyAccepted,
      })
    : null
  if (signup && !signup.success) {
    return NextResponse.json({ error: signup.error.issues[0]?.message ?? "Check your signup details." }, { status: 400 })
  }
  const referralCode = isSignup && typeof data.referralCode === "string"
    ? data.referralCode.trim().toUpperCase()
    : undefined
  if (referralCode && referralCode.length > 32) {
    return NextResponse.json({ error: "That referral code is invalid." }, { status: 400 })
  }
  if (referralCode && !await isReferralCodeAvailable(referralCode)) {
    return NextResponse.json({ error: "That referral code is invalid, expired, or no longer available." }, { status: 400 })
  }

  const state = randomBytes(32).toString("base64url")
  const response = NextResponse.json({ state })
  response.cookies.set("telegram_login_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE,
  })
  if (signup?.success) {
    response.cookies.set("telegram_signup_birth_date", signup.data.dateOfBirth, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: OAUTH_COOKIE_MAX_AGE,
    })
    response.cookies.set("telegram_signup_consent", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: OAUTH_COOKIE_MAX_AGE,
    })
    if (referralCode) {
      response.cookies.set("telegram_signup_referral", referralCode, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: OAUTH_COOKIE_MAX_AGE,
      })
    } else {
      response.cookies.delete("telegram_signup_referral")
    }
  } else {
    response.cookies.delete("telegram_signup_birth_date")
    response.cookies.delete("telegram_signup_consent")
    response.cookies.delete("telegram_signup_referral")
  }
  return response
}
