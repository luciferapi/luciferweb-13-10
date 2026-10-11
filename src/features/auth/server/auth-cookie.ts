import type { NextResponse } from "next/server"
import { SESSION_DURATION_SECONDS } from "@/features/auth/server/auth-store"

export const USER_SESSION_COOKIE = "lucifer_session"
export const OWNER_SESSION_COOKIE = "lucifer_owner_session"

export function getSessionCookieName(role: "user" | "owner" = "user") {
  return role === "owner" ? OWNER_SESSION_COOKIE : USER_SESSION_COOKIE
}

export function setAuthSessionCookie(
  response: NextResponse,
  session: { token: string; expiresAt: Date },
  persistent = false,
  role: "user" | "owner" = "user",
) {
  response.cookies.set(getSessionCookieName(role), session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(persistent
      ? { expires: session.expiresAt, maxAge: SESSION_DURATION_SECONDS }
      : {}),
  })
}
