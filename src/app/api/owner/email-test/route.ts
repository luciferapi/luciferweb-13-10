import { NextResponse } from "next/server"
import { requirePrimaryOwnerAccess } from "@/features/auth/server/owner-access"
import { sendSmtpTestEmail } from "@/features/notifications/server/email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Test email requests must come from this site." }, { status: 403 })
  }

  const unauthorized = await requirePrimaryOwnerAccess()
  if (unauthorized) return unauthorized

  try {
    await sendSmtpTestEmail()
    return NextResponse.json(
      { message: "A test email was sent to the configured SMTP mailbox." },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("SMTP test email could not be sent.", error)
    return NextResponse.json(
      { error: "Could not send the SMTP test email. Check the server email configuration." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
