import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { setAuthSessionCookie } from "@/lib/auth-cookie"
import { createSession, getOrCreateOAuthUser, OAuthSignupRequiredError } from "@/lib/auth-store"
import { OAUTH_COOKIE_MAX_AGE } from "@/lib/auth-oauth"
import { socialSignupSchema } from "@/lib/auth-validation"

export const runtime = "nodejs"

type TelegramLoginPayload = Record<string, unknown> & {
  state?: unknown
  id?: unknown
  first_name?: unknown
  last_name?: unknown
  username?: unknown
  auth_date?: unknown
  hash?: unknown
}

function equalSecret(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return NextResponse.json({ error: "Telegram sign-in is not configured." }, { status: 503 })

  const body: unknown = await request.json().catch(() => null)
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Telegram returned invalid sign-in data." }, { status: 400 })
  }
  const payload = body as TelegramLoginPayload
  const cookieState = (await cookies()).get("telegram_login_state")?.value
  const requestState = typeof payload.state === "string" ? payload.state : ""
  if (!cookieState || !requestState || !equalSecret(cookieState, requestState)) {
    return NextResponse.json({ error: "Telegram sign-in expired. Please try again." }, { status: 403 })
  }

  if (
    (typeof payload.id !== "string" && typeof payload.id !== "number") ||
    !/^\d{1,20}$/.test(String(payload.id)) ||
    typeof payload.first_name !== "string" ||
    typeof payload.auth_date !== "number" ||
    !Number.isInteger(payload.auth_date) ||
    typeof payload.hash !== "string" ||
    !/^[0-9a-f]{64}$/i.test(payload.hash)
  ) {
    return NextResponse.json({ error: "Telegram returned invalid sign-in data." }, { status: 400 })
  }

  const now = Math.floor(Date.now() / 1000)
  if (payload.auth_date > now + 30 || now - payload.auth_date > OAUTH_COOKIE_MAX_AGE) {
    return NextResponse.json({ error: "Telegram sign-in expired. Please try again." }, { status: 403 })
  }

  const signedFields = Object.entries(payload)
    .filter(([key, value]) => key !== "hash" && key !== "state" && (typeof value === "string" || typeof value === "number"))
    .map(([key, value]) => `${key}=${value}`)
    .sort()
  const secretKey = createHash("sha256").update(botToken).digest()
  const expectedHash = createHmac("sha256", secretKey).update(signedFields.join("\n")).digest("hex")
  if (!equalSecret(payload.hash, expectedHash)) {
    return NextResponse.json({ error: "Telegram could not verify this sign-in." }, { status: 401 })
  }

  const name = [payload.first_name, payload.last_name]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .trim()
    .slice(0, 100)
  if (!name) return NextResponse.json({ error: "Telegram returned an invalid account name." }, { status: 400 })

  try {
    const cookieStore = await cookies()
    const signupResult = socialSignupSchema.safeParse({
      dateOfBirth: cookieStore.get("telegram_signup_birth_date")?.value,
      privacyAccepted: cookieStore.get("telegram_signup_consent")?.value === "true",
    })
    const signup = signupResult.success ? signupResult.data : null
    const user = await getOrCreateOAuthUser({
      provider: "telegram",
      providerUserId: String(payload.id),
      name,
      allowCreate: Boolean(signup),
      dateOfBirth: signup?.dateOfBirth,
      referralCode: cookieStore.get("telegram_signup_referral")?.value,
    })
    const session = await createSession(user.id)
    const response = NextResponse.json({ user })
    response.cookies.delete("telegram_login_state")
    response.cookies.delete("telegram_signup_birth_date")
    response.cookies.delete("telegram_signup_consent")
    response.cookies.delete("telegram_signup_referral")
    setAuthSessionCookie(response, session)
    return response
  } catch (error) {
    if (error instanceof OAuthSignupRequiredError) {
      return NextResponse.json({
        error: "No account uses this Telegram identity yet. Choose Create account and try again.",
      }, { status: 409 })
    }
    console.error("Telegram sign-in failed.", error)
    return NextResponse.json({ error: "Could not sign in with Telegram right now." }, { status: 500 })
  }
}
