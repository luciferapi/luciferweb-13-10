import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { findUserBySession, ProfileOneTimeEditError, updateUserProfile } from "@/lib/auth-store"
import { profileUpdateSchema } from "@/lib/auth-validation"

export const runtime = "nodejs"

export async function PATCH(request: Request) {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Not signed in." }, { status: 401 })

  const body: unknown = await request.json().catch(() => null)
  const parsed = profileUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Enter valid profile details." },
      { status: 400 },
    )
  }

  try {
    const user = await findUserBySession(token)
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 })

    await updateUserProfile(user.id, parsed.data)
    const updatedUser = await findUserBySession(token)
    if (!updatedUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 })
    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    if (error instanceof ProfileOneTimeEditError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error("Could not update the account profile.", error)
    return NextResponse.json({ error: "Could not update your profile right now." }, { status: 500 })
  }
}
