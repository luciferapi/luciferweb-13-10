import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { deleteSession } from "@/features/auth/server/auth-store"
import { getSupabaseServerClient } from "@/lib/supabase"

export const runtime = "nodejs"

export async function POST() {
  const cookieStore = await cookies()
  const userToken = cookieStore.get("lucifer_session")?.value
  const ownerToken = cookieStore.get("lucifer_owner_session")?.value

  try {
    const supabase = await getSupabaseServerClient()
    if (supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    }

    if (userToken) await deleteSession(userToken)
    if (ownerToken) await deleteSession(ownerToken)
  } catch (error) {
    console.error("Could not revoke the sign-in session.", error)
    return NextResponse.json({ error: "Could not sign out right now." }, { status: 500 })
  }

  const response = NextResponse.json({ success: true })
  for (const cookieName of ["lucifer_session", "lucifer_owner_session"]) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    })
  }
  return response
}
