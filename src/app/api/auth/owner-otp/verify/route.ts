import { NextResponse } from "next/server"
import { setAuthSessionCookie } from "@/features/auth/server/auth-cookie"
import { verifyOwnerLoginOtp } from "@/features/auth/server/auth-store"
import { emailVerificationSchema } from "@/features/auth/server/auth-validation"
import { isOwnerEmail } from "@/features/auth/server/owner-email"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { readLimitedJson } from "@/lib/server/read-limited-json"
import { enforceRateLimit } from "@/lib/server/rate-limit"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = await readLimitedJson(request, 4 * 1024)
  if (!body.ok) {
    return NextResponse.json(
      { error: body.status === 413 ? "The request is too large." : "Send a valid JSON request body." },
      { status: body.status },
    )
  }
  const parsed = emailVerificationSchema.safeParse(body.value)
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the owner email and six-digit sign-in code." }, { status: 400 })
  }

  const rateLimitResponse = await enforceRateLimit(request, "owner-otp-verify", {
    capacity: 10,
    refillSeconds: 10 * 60,
    identifiers: [parsed.data.email],
  })
  if (rateLimitResponse) return rateLimitResponse

  if (!isOwnerEmail(parsed.data.email)) {
    return NextResponse.json({ error: "Owner sign-in is not available for this email address." }, { status: 403 })
  }

  if (!getSupabaseAdminClient()) {
    return NextResponse.json({
      error: "Owner sign-in is unavailable because server-side Supabase credentials are not configured.",
    }, { status: 503 })
  }

  try {
    const result = await verifyOwnerLoginOtp(parsed.data.email, parsed.data.otp)
    if (result.status !== "verified") {
      const errors = {
        invalid: "The sign-in code is incorrect.",
        missing: "No active owner sign-in code was found. Request a new code.",
        expired: "The sign-in code has expired. Request a new code.",
        "attempts-exceeded": "Too many incorrect codes. Request a new code.",
      } as const
      return NextResponse.json({ error: errors[result.status] }, { status: 401 })
    }

    const response = NextResponse.json({ user: result.user })
    setAuthSessionCookie(response, result, false, "owner")
    return response
  } catch (error) {
    console.error("Owner sign-in code verification failed.", error)
    return NextResponse.json({ error: "Could not verify the owner sign-in code right now." }, { status: 500 })
  }
}
