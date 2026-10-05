import { NextResponse } from "next/server"
import { resetPassword } from "@/lib/auth-store"
import { passwordResetSchema } from "@/lib/auth-validation"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  const parsed = passwordResetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid reset link and a password of at least eight characters." }, { status: 400 })
  }

  try {
    const updated = await resetPassword(parsed.data.token, parsed.data.password)
    if (!updated) return NextResponse.json({ error: "This password reset link is invalid or expired." }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Password reset failed.", error)
    return NextResponse.json({ error: "Could not reset the password right now." }, { status: 500 })
  }
}
