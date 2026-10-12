import { NextResponse } from "next/server"
import { requestOwnerLoginOtp } from "@/features/auth/server/auth-store"
import { ownerOtpRequestSchema } from "@/features/auth/server/auth-validation"
import { sendOwnerLoginOtp } from "@/features/notifications/server/email"
import { isOwnerEmail } from "@/features/auth/server/owner-email"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { isSupabaseSchemaUnavailable } from "@/lib/supabase-errors"
import { readLimitedJson } from "@/lib/server/read-limited-json"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = await readLimitedJson(request, 4 * 1024)
  if (!body.ok) {
    return NextResponse.json(
      { error: body.status === 413 ? "The request is too large." : "Send a valid JSON request body." },
      { status: body.status },
    )
  }
  const parsed = ownerOtpRequestSchema.safeParse(body.value)
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid owner email address." }, { status: 400 })
  }

  if (!isOwnerEmail(parsed.data.email)) {
    return NextResponse.json({ error: "Owner sign-in is not available for this email address." }, { status: 403 })
  }

  if (!getSupabaseAdminClient()) {
    return NextResponse.json({
      error: "Owner sign-in is unavailable because server-side Supabase credentials are not configured.",
    }, { status: 503 })
  }

  try {
    const result = await requestOwnerLoginOtp(parsed.data.email)
    if (result.status === "missing") {
      return NextResponse.json({
        message: "If owner sign-in is available, check the configured owner inbox and spam folder.",
        retryAfterSeconds: 120,
      })
    }
    if (result.status === "cooldown") {
      return NextResponse.json({
        message: "A code was requested recently and was not resent. Check your inbox and spam folder for the earlier email; you can request another when the timer ends.",
        retryAfterSeconds: result.retryAfterSeconds,
      })
    }

    await sendOwnerLoginOtp(parsed.data.email, result.otp, result.name)
    return NextResponse.json({
      message: "The email server accepted the sign-in code. Check your inbox and spam or junk folder.",
      retryAfterSeconds: result.retryAfterSeconds,
    })
  } catch (error) {
    console.error("Could not create the owner sign-in code.", error)
    if (isSupabaseSchemaUnavailable(error)) {
      return NextResponse.json({
        error: "Owner sign-in is unavailable because the Supabase database schema is missing or not exposed. Apply the Supabase migrations and try again.",
      }, { status: 503 })
    }
    return NextResponse.json({
      error: "Could not send the owner sign-in code. Check the Supabase server credentials and app SMTP configuration.",
    }, { status: 503 })
  }
}
