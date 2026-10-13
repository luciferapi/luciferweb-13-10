import { NextResponse } from "next/server"
import {
  createOAuthState,
  createPkceChallenge,
  createPkceVerifier,
  getAuthBaseUrl,
  isOAuthProvider,
  OAUTH_COOKIE_MAX_AGE,
} from "@/features/auth/server/auth-oauth"
import { socialSignupSchema } from "@/features/auth/server/auth-validation"
import { isReferralCodeAvailable } from "@/features/referrals/server/referral-store"
import { enforceRateLimit } from "@/lib/server/rate-limit"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params
  if (!isOAuthProvider(provider)) {
    return NextResponse.json({ error: "This sign-in provider is not supported." }, { status: 404 })
  }

  const clientId = provider === "google" ? process.env.GOOGLE_CLIENT_ID : process.env.TWITTER_CLIENT_ID
  const clientSecret = provider === "google" ? process.env.GOOGLE_CLIENT_SECRET : process.env.TWITTER_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "This sign-in provider is not configured." }, { status: 503 })
  }

  const rateLimitResponse = await enforceRateLimit(request, "oauth-start", {
    capacity: 10,
    refillSeconds: 10 * 60,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const requestUrl = new URL(request.url)
    const baseUrl = getAuthBaseUrl(request.url)
    const isSignup = requestUrl.searchParams.get("intent") === "create-account"
    const signup = isSignup
      ? socialSignupSchema.safeParse({
          dateOfBirth: requestUrl.searchParams.get("dateOfBirth"),
          privacyAccepted: requestUrl.searchParams.get("privacyAccepted") === "true",
        })
      : null
    if (signup && !signup.success) {
      return NextResponse.json({ error: signup.error.issues[0]?.message ?? "Check your signup details." }, { status: 400 })
    }
    const referralCode = isSignup ? requestUrl.searchParams.get("ref")?.trim().toUpperCase() : undefined
    if (referralCode && referralCode.length > 32) {
      return NextResponse.json({ error: "That referral code is invalid." }, { status: 400 })
    }
    if (referralCode && !await isReferralCodeAvailable(referralCode)) {
      return NextResponse.json({ error: "That referral code is invalid, expired, or no longer available." }, { status: 400 })
    }

    const state = createOAuthState()
    const verifier = createPkceVerifier()
    const callbackUrl = new URL(`/api/auth/oauth/callback/${provider}`, baseUrl)
    const authorizeUrl = provider === "google"
      ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
      : new URL("https://x.com/i/oauth2/authorize")
    authorizeUrl.searchParams.set("client_id", clientId)
    authorizeUrl.searchParams.set("redirect_uri", callbackUrl.toString())
    authorizeUrl.searchParams.set("response_type", "code")
    authorizeUrl.searchParams.set("scope", provider === "google" ? "openid email profile" : "users.read")
    authorizeUrl.searchParams.set("state", state)
    authorizeUrl.searchParams.set("code_challenge", createPkceChallenge(verifier))
    authorizeUrl.searchParams.set("code_challenge_method", "S256")
    if (provider === "google") authorizeUrl.searchParams.set("prompt", "select_account")

    const response = NextResponse.redirect(authorizeUrl)
    const signupBirthDateCookie = `oauth_signup_birth_date_${provider}`
    const signupConsentCookie = `oauth_signup_consent_${provider}`
    const referralCookie = `oauth_referral_code_${provider}`
    const cookieOptions = {
      httpOnly: true,
      secure: baseUrl.protocol === "https:",
      sameSite: "lax" as const,
      path: "/",
      maxAge: OAUTH_COOKIE_MAX_AGE,
    }
    response.cookies.set(`oauth_state_${provider}`, state, cookieOptions)
    response.cookies.set(`oauth_verifier_${provider}`, verifier, cookieOptions)
    if (signup?.success) {
      response.cookies.set(signupBirthDateCookie, signup.data.dateOfBirth, cookieOptions)
      response.cookies.set(signupConsentCookie, "true", cookieOptions)
    } else {
      response.cookies.delete(signupBirthDateCookie)
      response.cookies.delete(signupConsentCookie)
    }
    if (referralCode) response.cookies.set(referralCookie, referralCode, cookieOptions)
    else response.cookies.delete(referralCookie)
    return response
  } catch (error) {
    console.error(`Could not start ${provider} sign-in.`, error)
    return NextResponse.json({ error: "Could not start social sign-in right now." }, { status: 500 })
  }
}
