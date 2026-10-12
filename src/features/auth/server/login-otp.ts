import "server-only"
import { NextResponse } from "next/server"
import {
  requestPrivilegedLoginOtp,
  verifyPrivilegedLoginOtp,
} from "@/features/auth/server/auth-store"
import {
  emailVerificationSchema,
  loginCodeRequestSchema,
} from "@/features/auth/server/auth-validation"
import {
  sendOwnerLoginOtp,
  sendStaffLoginOtp,
} from "@/features/notifications/server/email"
import { isOwnerEmail } from "@/features/auth/server/owner-email"
import { setAuthSessionCookie } from "@/features/auth/server/auth-cookie"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { isSupabaseSchemaUnavailable } from "@/lib/supabase-errors"
import { enforceRateLimit } from "@/lib/server/rate-limit"
import { readLimitedJson } from "@/lib/server/read-limited-json"

export async function requestLoginOtp(request: Request) {
  const body = await readLimitedJson(request, 4 * 1024)
  if (!body.ok) {
    return NextResponse.json(
      { error: body.status === 413 ? "The request is too large." : "Send a valid JSON request body." },
      { status: body.status },
    )
  }
  const parsed = loginCodeRequestSchema.safeParse(body.value)
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid owner or staff email address." }, { status: 400 })
  }

  if (!getSupabaseAdminClient()) {
    return NextResponse.json({
      error: "Email-code sign-in is unavailable because server-side Supabase credentials are not configured.",
    }, { status: 503 })
  }

  try {
    const result = await requestPrivilegedLoginOtp(parsed.data.email)
    if (result.status === "missing") {
      return NextResponse.json({
        message: "If email-code sign-in is enabled for this account, check the configured inbox and spam folder.",
        retryAfterSeconds: 120,
      })
    }
    if (result.status === "cooldown") {
      return NextResponse.json({
        message: "A code was requested recently. Check your inbox and spam folder for the earlier email.",
        retryAfterSeconds: result.retryAfterSeconds,
      })
    }

    const sendLoginOtp = isOwnerEmail(parsed.data.email) ? sendOwnerLoginOtp : sendStaffLoginOtp
    await sendLoginOtp(parsed.data.email, result.otp, result.name)
    return NextResponse.json({
      message: "The email server accepted the sign-in code. Check your inbox and spam or junk folder.",
      retryAfterSeconds: result.retryAfterSeconds,
    })
  } catch (error) {
    console.error("Could not create an owner or staff sign-in code.", error)
    if (isSupabaseSchemaUnavailable(error)) {
      return NextResponse.json({
        error: "Email-code sign-in is unavailable because the Supabase schema is missing. Apply the Supabase migrations and try again.",
      }, { status: 503 })
    }
    return NextResponse.json({
      error: "Could not send the sign-in code. Check the Supabase server credentials and app SMTP configuration.",
    }, { status: 503 })
  }
}

export async function verifyLoginOtp(request: Request) {
  const body = await readLimitedJson(request, 4 * 1024)
  if (!body.ok) {
    return NextResponse.json(
      { error: body.status === 413 ? "The request is too large." : "Send a valid JSON request body." },
      { status: body.status },
    )
  }
  const parsed = emailVerificationSchema.safeParse(body.value)
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the owner or staff email and six-digit sign-in code." }, { status: 400 })
  }

  const rateLimitResponse = await enforceRateLimit(request, "privileged-login-code-verify", {
    capacity: 10,
    refillSeconds: 15 * 60,
    identifiers: [parsed.data.email],
  })
  if (rateLimitResponse) return rateLimitResponse

  if (!getSupabaseAdminClient()) {
    return NextResponse.json({
      error: "Email-code sign-in is unavailable because server-side Supabase credentials are not configured.",
    }, { status: 503 })
  }

  try {
    const result = await verifyPrivilegedLoginOtp(parsed.data.email, parsed.data.otp)
    if (result.status !== "verified") {
      const errors = {
        invalid: "The sign-in code is incorrect.",
        missing: "No active sign-in code was found. Request a new code.",
        expired: "The sign-in code has expired. Request a new code.",
        "attempts-exceeded": "Too many incorrect codes. Request a new code.",
      } as const
      return NextResponse.json({ error: errors[result.status] }, { status: 401 })
    }

    const response = NextResponse.json({ user: result.user })
    setAuthSessionCookie(response, result, false, "owner")
    return response
  } catch (error) {
    console.error("Owner or staff sign-in code verification failed.", error)
    return NextResponse.json({ error: "Could not verify the sign-in code right now." }, { status: 500 })
  }
}
