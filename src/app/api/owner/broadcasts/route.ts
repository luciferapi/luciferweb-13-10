import { NextResponse } from "next/server"
import { z } from "zod"
import { requireOwnerAccess } from "@/features/auth/server/owner-access"
import { sendBroadcastEmails } from "@/features/notifications/server/email"
import { getOwnerBroadcastRecipients, listOwnerBroadcastRecipients } from "@/features/owner/server/owner-broadcasts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const broadcastInput = z.object({
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(3).max(5000),
  mode: z.enum(["all", "selected"]),
  userIds: z.array(z.string().uuid()).max(5000),
}).superRefine((input, context) => {
  if (input.mode === "selected" && input.userIds.length === 0) {
    context.addIssue({ code: "custom", message: "Select at least one user." })
  }
})

function checkOrigin(request: Request) {
  const origin = request.headers.get("origin")
  return Boolean(origin && origin === new URL(request.url).origin)
}

export async function GET(request: Request) {
  const unauthorized = await requireOwnerAccess("broadcasts")
  if (unauthorized) return unauthorized

  const params = new URL(request.url).searchParams
  const page = Number(params.get("page") ?? "1")
  if (!Number.isInteger(page) || page < 1 || page > 100_000) {
    return NextResponse.json({ error: "Invalid recipient page." }, { status: 400 })
  }

  try {
    return NextResponse.json(
      await listOwnerBroadcastRecipients(page, params.get("search") ?? ""),
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("Could not load broadcast recipients.", error)
    return NextResponse.json({ error: "Could not load users with email addresses." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!checkOrigin(request)) {
    return NextResponse.json({ error: "Broadcast requests must come from this site." }, { status: 403 })
  }
  const unauthorized = await requireOwnerAccess("broadcasts")
  if (unauthorized) return unauthorized

  const parsed = broadcastInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the message and recipient selection." }, { status: 400 })
  }

  try {
    const recipients = await getOwnerBroadcastRecipients(parsed.data.mode, parsed.data.userIds)
    if (!recipients.length) {
      return NextResponse.json({ error: "There are no users with email addresses to receive this message." }, { status: 400 })
    }

    const result = await sendBroadcastEmails({
      recipients: recipients.map((recipient) => recipient.email),
      subject: parsed.data.subject,
      message: parsed.data.message,
    })
    return NextResponse.json(
      {
        accepted: result.accepted,
        failed: result.failed,
        recipientCount: recipients.length,
        message: result.failed
          ? `Email accepted for ${result.accepted} recipients; ${result.failed} could not be sent.`
          : `Email accepted for all ${result.accepted} recipients.`,
      },
      { status: result.failed ? 502 : 200, headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("Could not send owner broadcast email.", error)
    if (error instanceof Error && error.message.includes("selected users")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const message = error instanceof Error && error.message === "Supabase admin access is not configured."
      ? "The user database is not available."
      : "Could not prepare or send the broadcast email."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
