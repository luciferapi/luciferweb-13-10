import { NextResponse } from "next/server"
import { authenticateUser, createSession, getOtpLoginTypeByEmail } from "@/features/auth/server/auth-store"
import { setAuthSessionCookie } from "@/features/auth/server/auth-cookie"
import { loginSchema } from "@/features/auth/server/auth-validation"
import { getSupabaseServerClient } from "@/lib/supabase"
import { findUserBySupabaseAuthId } from "@/features/auth/server/auth-store"
import { readLimitedJson } from "@/lib/server/read-limited-json"
import { enforceRateLimit } from "@/lib/server/rate-limit"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = await readLimitedJson(request, 8 * 1024)
  if (!body.ok) {
    return NextResponse.json(
      { error: body.status === 413 ? "The request is too large." : "Send a valid JSON request body." },
      { status: body.status },
    )
  }
  const parsed = loginSchema.safeParse(body.value)
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 })
  }

  const rateLimitResponse = await enforceRateLimit(request, "login", {
    capacity: 10,
    refillSeconds: 15 * 60,
    identifiers: [parsed.data.email],
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    try {
      if (await getOtpLoginTypeByEmail(parsed.data.email)) {
        return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 })
      }
    } catch (error) {
      if (!(error instanceof Error && error.message === "Supabase server credentials are not configured.")) {
        throw error
      }
      console.error("Skipping privileged-account lookup because Supabase admin credentials are unavailable.")
    }

    const supabase = await getSupabaseServerClient()
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      })
      if (error) {
        if (error.status === 400 || error.status === 401) {
          return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 })
        }
        throw error
      }
      if (!data.user) {
        throw new Error("Supabase Auth returned no user after password sign-in.")
      }

      const profile = await findUserBySupabaseAuthId(data.user.id)
      const user = profile ?? {
        id: data.user.id,
        publicUid: typeof data.user.user_metadata?.publicUid === "string" ? data.user.user_metadata.publicUid : "",
        name: typeof data.user.user_metadata?.name === "string" ? data.user.user_metadata.name : data.user.email ?? "User",
        email: data.user.email ?? null,
        dateOfBirth: typeof data.user.user_metadata?.dateOfBirth === "string" ? data.user.user_metadata.dateOfBirth : null,
        telegramUsername: typeof data.user.user_metadata?.telegramUsername === "string" ? data.user.user_metadata.telegramUsername : null,
        xUsername: typeof data.user.user_metadata?.xUsername === "string" ? data.user.user_metadata.xUsername : null,
        nameEditUsed: false,
        dateOfBirthEditUsed: false,
      }
      const response = NextResponse.json({ user })
      if (profile) {
        const session = await createSession(profile.id, "password")
        setAuthSessionCookie(response, session, parsed.data.rememberMe, "user")
      }
      return response
    }

    const user = await authenticateUser(parsed.data.email, parsed.data.password)
    if (!user) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 })

    const session = await createSession(user.id, "password")
    const response = NextResponse.json({ user })
    setAuthSessionCookie(response, session, parsed.data.rememberMe, "user")
    return response
  } catch (error) {
    console.error("Sign-in failed.", error)
    return NextResponse.json({ error: "Could not sign in right now." }, { status: 500 })
  }
}
