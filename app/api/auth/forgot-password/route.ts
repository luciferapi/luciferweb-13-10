import { NextResponse } from "next/server"
import { createPasswordResetToken, deletePasswordResetToken } from "@/lib/auth-store"
import { loginSchema } from "@/lib/auth-validation"
import { sendPasswordResetEmail, verifySmtpConfiguration } from "@/lib/email"

export const runtime = "nodejs"

function hasSmtpConfiguration(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  const parsed = loginSchema.pick({ email: true }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })

  let token: string | null = null
  try {
    token = await createPasswordResetToken(parsed.data.email)
    if (!token) {
      return NextResponse.json(
        { error: "No account was found for that email. Create an account first." },
        { status: 404 },
      )
    }

    const baseUrl = process.env.APP_URL ?? (process.env.NODE_ENV === "development" ? new URL(request.url).origin : "https://luciferapi.com")
    const resetUrl = new URL("/sign-in", baseUrl)
    resetUrl.searchParams.set("reset", token)

    if (!hasSmtpConfiguration()) {
      if (process.env.NODE_ENV !== "production") {
        console.info(`Password reset URL for ${parsed.data.email}: ${resetUrl.toString()}`)
        return NextResponse.json({ message: "Password reset instructions have been sent to your email." })
      }
      throw new Error("SMTP is not configured for password reset emails.")
    }

    await verifySmtpConfiguration()
    await sendPasswordResetEmail(parsed.data.email, resetUrl.toString())
    return NextResponse.json({ message: "Password reset instructions have been sent to your email." })
  } catch (error) {
    console.error("Password reset email could not be sent.", error)
    if (token) {
      try {
        await deletePasswordResetToken(token)
      } catch (cleanupError) {
        console.error("Could not invalidate the unsent password reset link.", cleanupError)
      }
    }
    return NextResponse.json(
      { error: "We found the account, but could not send the reset email. Please try again later." },
      { status: 503 },
    )
  }
}
