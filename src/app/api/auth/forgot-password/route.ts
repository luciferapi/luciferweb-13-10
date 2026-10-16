import { NextResponse } from "next/server"
import { createPasswordResetToken, deletePasswordResetToken } from "@/features/auth/server/auth-store"
import { loginSchema } from "@/features/auth/server/auth-validation"
import { sendPasswordResetEmail, verifySmtpConfiguration } from "@/features/notifications/server/email"
import { isSmtpConfigured } from "@/lib/smtp-server"
import { readLimitedJson } from "@/lib/server/read-limited-json"
import { enforceRateLimit } from "@/lib/server/rate-limit"

export const runtime = "nodejs"
const PRODUCTION_BASE_URL = "https://www.luciferapi.com"
const GENERIC_RESPONSE = {
  message: "If an account exists for that email, reset instructions will be sent. Check your spam folder; if nothing arrives after a few minutes, contact support.",
}

function isLocalHostname(hostname: string) {
  const host = hostname.toLowerCase()
  return host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host === "host.docker.internal" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127(?:\.\d{1,3}){3}$/.test(host)
}

function resolveResetBaseUrl(request: Request) {
  const isProduction = process.env.NODE_ENV === "production"
  const requestOrigin = new URL(request.url).origin
  const configuredBaseUrl = process.env.APP_URL?.trim()
  const candidates = [configuredBaseUrl, requestOrigin, PRODUCTION_BASE_URL]

  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const url = new URL(candidate)
      if (url.protocol !== "http:" && url.protocol !== "https:") continue
      if (url.username || url.password) continue
      if (isProduction && (url.protocol !== "https:" || isLocalHostname(url.hostname))) continue
      return url.origin
    } catch {
      // An invalid optional APP_URL should not prevent a production reset link.
    }
  }

  throw new Error("Could not determine a public base URL for the password reset link.")
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

  let baseUrl: string
  try {
    baseUrl = resolveResetBaseUrl(request)
  } catch (error) {
    console.error("Could not resolve a public URL for a password reset request.", error)
    await deletePasswordResetToken(token).catch((error) => {
      console.error("Could not invalidate reset token after public URL resolution failed.", error)
    })
    return NextResponse.json({ error: "Password reset is temporarily unavailable. Please try again later." }, { status: 503 })
  }
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
    // Keep the response identical for known and unknown accounts to prevent email enumeration.
    return NextResponse.json(GENERIC_RESPONSE)
  }

  return NextResponse.json(GENERIC_RESPONSE)
}
