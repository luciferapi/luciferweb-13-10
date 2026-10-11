import { NextResponse } from "next/server"
import { ProfileOneTimeEditError, updateUserProfile } from "@/features/auth/server/auth-store"
import { profileUpdateSchema } from "@/features/auth/server/auth-validation"
import { getSignedInUser } from "@/features/auth/server/auth-session"
import { readLimitedJson } from "@/lib/server/read-limited-json"

export const runtime = "nodejs"

export async function PATCH(request: Request) {
  const body = await readLimitedJson(request, 8 * 1024)
  if (!body.ok) {
    return NextResponse.json(
      { error: body.status === 413 ? "The profile request is too large." : "Send a valid JSON request body." },
      { status: body.status },
    )
  }
  const parsed = profileUpdateSchema.safeParse(body.value)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Enter valid profile details." },
      { status: 400 },
    )
  }

  try {
    const user = await getSignedInUser()
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 })

    await updateUserProfile(user.id, parsed.data)
    const updatedUser = await getSignedInUser()
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
