import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { findUserBySession, updateUserName } from "@/lib/auth-store"
import { profileUpdateSchema } from "@/lib/auth-validation"

export const runtime = "nodejs"

export async function PATCH(request: Request) {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Not signed in." }, { status: 401 })

  const body: unknown = await request.json().catch(() => null)
  const parsed = profileUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a name between 1 and 100 characters." }, { status: 400 })
  }

  try {
    const user = await findUserBySession(token)
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 })

    await updateUserName(user.id, parsed.data.name)
    return NextResponse.json({ user: { ...user, name: parsed.data.name } })
  } catch (error) {
    console.error("Could not update the account name.", error)
    return NextResponse.json({ error: "Could not update your name right now." }, { status: 500 })
  }
}
