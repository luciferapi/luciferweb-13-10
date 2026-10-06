import type { NextResponse } from "next/server"
import { SESSION_DURATION_SECONDS } from "@/lib/auth-store"

export function setAuthSessionCookie(
  response: NextResponse,
  session: { token: string; expiresAt: Date },
  persistent = false,
) {
  response.cookies.set("lucifer_session", session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(persistent
      ? { expires: session.expiresAt, maxAge: SESSION_DURATION_SECONDS }
      : {}),
  })
}
