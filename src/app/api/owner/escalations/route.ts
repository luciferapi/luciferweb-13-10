import { NextResponse } from "next/server"
import { z } from "zod"
import { getOwnerWorkspaceAccess, requireOwnerAccess } from "@/features/auth/server/owner-access"
import { sendSupportTicketReplyNotification } from "@/features/notifications/server/email"
import {
  getSupportTicketIdentity,
  listSupportTickets,
  supportStatuses,
  updateSupportTicket,
  type SupportStatus,
} from "@/features/support/server/support-tickets"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const updateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reply"),
    ticketId: z.string().uuid(),
    message: z.string().trim().min(1).max(5000),
  }),
  z.object({
    action: z.literal("status"),
    ticketId: z.string().uuid(),
    status: z.enum(supportStatuses),
  }),
])

export async function GET() {
  const unauthorized = await requireOwnerAccess("escalations")
  if (unauthorized) return unauthorized

  try {
    const result = await listSupportTickets({ escalatedOnly: true, includeInternal: true })
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not load forwarded support requests.", error)
    return NextResponse.json({ error: "Could not load forwarded support requests." }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireOwnerAccess("escalations")
  if (unauthorized) return unauthorized

  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Check the reply or ticket status and try again." }, { status: 400 })
  const access = await getOwnerWorkspaceAccess()
  if (!access) return NextResponse.json({ error: "Sign in to manage forwarded support requests." }, { status: 401 })

  try {
    const ticket = await getSupportTicketIdentity(parsed.data.ticketId)
    if (!ticket || !ticket.escalatedAt) {
      return NextResponse.json({ error: "This ticket has not been forwarded to the owner." }, { status: 404 })
    }
    let body: string | null = null
    let nextStatus: SupportStatus
    if (parsed.data.action === "reply") {
      body = parsed.data.message
      nextStatus = "waiting_on_user"
    } else {
      nextStatus = parsed.data.status
    }
    const result = await updateSupportTicket({
      ticketId: parsed.data.ticketId,
      actorUserId: access.user.id,
      authorRole: "staff",
      authorName: access.user.name,
      authorEmail: access.user.email,
      body,
      status: nextStatus,
    })
    if (result === "not_found") return NextResponse.json({ error: "Support ticket not found." }, { status: 404 })
    if (result === "invalid_message") return NextResponse.json({ error: "Write a reply of 1 to 5,000 characters." }, { status: 400 })
    if (result === "invalid_status") return NextResponse.json({ error: "Choose a valid support ticket status." }, { status: 400 })
    if (result !== "updated") throw new Error(`Unexpected escalation update result: ${result}`)

    let notificationSent = true
    if (parsed.data.action === "reply") {
      try {
        await sendSupportTicketReplyNotification({
          ticketId: ticket.ticketCode,
          issueType: ticket.issueType,
          userName: ticket.userName,
          userEmail: ticket.userEmail,
          staffName: access.user.name,
          response: parsed.data.message,
        })
      } catch (error) {
        notificationSent = false
        console.error(`Owner reply to support ticket ${parsed.data.ticketId} was saved, but the customer email failed.`, error)
      }
    }
    return NextResponse.json({ success: true, notificationSent })
  } catch (error) {
    console.error("Could not update a forwarded support request.", error)
    return NextResponse.json({ error: "Could not update this forwarded request." }, { status: 500 })
  }
}
