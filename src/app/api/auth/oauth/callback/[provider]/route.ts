import { timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { setAuthSessionCookie } from "@/features/auth/server/auth-cookie"
import {
  createSession,
  getOrCreateOAuthUser,
  getOtpLoginTypeByUserId,
  OAuthSignupRequiredError,
  SignupIpAlreadyUsedError,
} from "@/features/auth/server/auth-store"
import { getAuthBaseUrl, isOAuthProvider } from "@/features/auth/server/auth-oauth"
import { socialSignupSchema } from "@/features/auth/server/auth-validation"
import { getSignupIpHash, SignupIpUnavailableError } from "@/features/auth/server/signup-ip"

export const runtime = "nodejs"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function equalSecret(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

function authErrorRedirect(requestUrl: string, error: "cancelled" | "failed" | "signup_required" | "signup_ip_used" | "otp_required") {
  const baseUrl = getAuthBaseUrl(requestUrl)
  const destination = new URL("/sign-in", baseUrl)
  destination.searchParams.set("authError", error)
  return NextResponse.redirect(destination)
}

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params
  if (!isOAuthProvider(provider)) {
    return NextResponse.json({ error: "This sign-in provider is not supported." }, { status: 404 })
  }

  const requestUrl = new URL(request.url)
  const cookieStore = await cookies()
  const stateCookie = `oauth_state_${provider}`
  const verifierCookie = `oauth_verifier_${provider}`
  const nextCookie = `oauth_next_${provider}`
  const signupBirthDateCookie = `oauth_signup_birth_date_${provider}`
  const signupConsentCookie = `oauth_signup_consent_${provider}`
  const referralCookie = `oauth_referral_code_${provider}`
  const expectedState = cookieStore.get(stateCookie)?.value
  const verifier = cookieStore.get(verifierCookie)?.value
  const receivedState = requestUrl.searchParams.get("state")
  const signupResult = socialSignupSchema.safeParse({
    dateOfBirth: cookieStore.get(signupBirthDateCookie)?.value,
    privacyAccepted: cookieStore.get(signupConsentCookie)?.value === "true",
  })
  const signup = signupResult.success ? signupResult.data : null
  const referralCode = cookieStore.get(referralCookie)?.value

  function finish(response: NextResponse) {
    response.cookies.delete(stateCookie)
    response.cookies.delete(verifierCookie)
    response.cookies.delete(nextCookie)
    response.cookies.delete(signupBirthDateCookie)
    response.cookies.delete(signupConsentCookie)
    response.cookies.delete(referralCookie)
    return response
  }

  if (requestUrl.searchParams.has("error")) return finish(authErrorRedirect(request.url, "cancelled"))
  if (!expectedState || !verifier || !receivedState || !equalSecret(receivedState, expectedState)) {
    return finish(authErrorRedirect(request.url, "failed"))
  }

  const code = requestUrl.searchParams.get("code")
  const clientId = provider === "google" ? process.env.GOOGLE_CLIENT_ID : process.env.TWITTER_CLIENT_ID
  const clientSecret = provider === "google" ? process.env.GOOGLE_CLIENT_SECRET : process.env.TWITTER_CLIENT_SECRET
  if (!code || !clientId || !clientSecret) return finish(authErrorRedirect(request.url, "failed"))

  try {
    const signupIpHash = signup ? getSignupIpHash(request) : undefined
    const baseUrl = getAuthBaseUrl(request.url)
    const callbackUrl = new URL(`/api/auth/oauth/callback/${provider}`, baseUrl)
    const tokenResponse = await fetch(
      provider === "google"
        ? "https://oauth2.googleapis.com/token"
        : "https://api.x.com/2/oauth2/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: callbackUrl.toString(),
          code_verifier: verifier,
        }),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      },
    )
    if (!tokenResponse.ok) throw new Error(`${provider} token exchange failed (${tokenResponse.status}).`)
    const tokenData: unknown = await tokenResponse.json()
    if (!isRecord(tokenData) || typeof tokenData.access_token !== "string") {
      throw new Error(`${provider} returned an invalid access token response.`)
    }
    const accessToken = tokenData.access_token

    const profileResponse = await fetch(
      provider === "google"
        ? "https://openidconnect.googleapis.com/v1/userinfo"
        : "https://api.x.com/2/users/me?user.fields=name,username",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      },
    )
    if (!profileResponse.ok) throw new Error(`${provider} profile lookup failed (${profileResponse.status}).`)
    const profile: unknown = await profileResponse.json()
    const fields = provider === "twitter" && isRecord(profile) ? profile.data : profile

    let user
    if (provider === "google") {
      if (
        !isRecord(fields) ||
        typeof fields.sub !== "string" ||
        typeof fields.name !== "string" ||
        typeof fields.email !== "string" ||
        fields.email_verified !== true
      ) {
        throw new Error("Google did not return a verified email address.")
      }
      user = await getOrCreateOAuthUser({
        provider,
        providerUserId: fields.sub,
        name: fields.name,
        email: fields.email,
        emailVerified: true,
        allowCreate: Boolean(signup),
        dateOfBirth: signup?.dateOfBirth,
        referralCode,
        signupIpHash,
      })
    } else {
      if (
        !isRecord(fields) ||
        typeof fields.id !== "string" ||
        typeof fields.name !== "string"
      ) {
        throw new Error("X returned an invalid user profile.")
      }
      user = await getOrCreateOAuthUser({
        provider,
        providerUserId: fields.id,
        name: fields.name,
        allowCreate: Boolean(signup),
        dateOfBirth: signup?.dateOfBirth,
        referralCode,
        signupIpHash,
      })
    }

    if (await getOtpLoginTypeByUserId(user.id)) {
      return finish(authErrorRedirect(request.url, "otp_required"))
    }
    const session = await createSession(user.id, "oauth")
    const response = NextResponse.redirect(new URL("/", baseUrl))
    setAuthSessionCookie(response, session, false, "user")
    return finish(response)
  } catch (error) {
    if (error instanceof OAuthSignupRequiredError) {
      return finish(authErrorRedirect(request.url, "signup_required"))
    }
    if (error instanceof SignupIpAlreadyUsedError) {
      return finish(authErrorRedirect(request.url, "signup_ip_used"))
    }
    if (error instanceof SignupIpUnavailableError) {
      console.error("Signup IP could not be determined.", error)
      return finish(authErrorRedirect(request.url, "failed"))
    }
    console.error(`${provider} sign-in failed.`, error)
    return finish(authErrorRedirect(request.url, "failed"))
  }
}
