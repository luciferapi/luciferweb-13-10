import { NextResponse } from "next/server"
import { z } from "zod"
import { getOwnerWorkspaceAccess, requireOwnerAccess } from "@/features/auth/server/owner-access"
import {
  sendSupportTicketEscalationNotification,
  sendSupportTicketReplyNotification,
} from "@/features/notifications/server/email"
import {
  getSupportTicketIdentity,
  listSupportTickets,
  forwardSupportTicket,
  supportStatuses,
  updateSupportTicket,
  type SupportStatus,
} from "@/features/support/server/support-tickets"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const statusFilter = z.enum(["all", ...supportStatuses])
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
  z.object({
    action: z.literal("forward"),
    ticketId: z.string().uuid(),
    note: z.string().trim().min(3).max(1000),
  }),
])

export async function GET(request: Request) {
  const unauthorized = await requireOwnerAccess("support")
  if (unauthorized) return unauthorized

  try {
    const parsedStatus = statusFilter.safeParse(new URL(request.url).searchParams.get("status") ?? "open")
    if (!parsedStatus.success) return NextResponse.json({ error: "Choose a valid support ticket filter." }, { status: 400 })
    const status = parsedStatus.data
    const result = await listSupportTickets({ status, includeInternal: true })
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not load the support ticket inbox.", error)
    return NextResponse.json({ error: "Could not load support tickets." }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireOwnerAccess("support")
  if (unauthorized) return unauthorized

  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Check the reply or status and try again." }, { status: 400 })
  const access = await getOwnerWorkspaceAccess()
  if (!access) return NextResponse.json({ error: "Sign in to manage support tickets." }, { status: 401 })

  try {
    if (parsed.data.action === "forward") {
      const result = await forwardSupportTicket({
        ticketId: parsed.data.ticketId,
        actorUserId: access.user.id,
        note: parsed.data.note,
      })
      if (result === "forwarded") {
        let notificationSent = true
        try {
          const ticket = await getSupportTicketIdentity(parsed.data.ticketId)
          if (!ticket) throw new Error("The support ticket disappeared after being forwarded.")
          await sendSupportTicketEscalationNotification({
            ticketId: ticket.ticketCode,
            issueType: ticket.issueType,
            userName: ticket.userName,
            userEmail: ticket.userEmail,
            staffName: access.user.name,
            note: parsed.data.note,
          })
        } catch (error) {
          notificationSent = false
          console.error(`Support ticket ${parsed.data.ticketId} was forwarded, but the owner email failed.`, error)
        }
        return NextResponse.json({ success: true, notificationSent })
      }
      if (result === "not_found") return NextResponse.json({ error: "Support ticket not found." }, { status: 404 })
      if (result === "already_forwarded") return NextResponse.json({ error: "This ticket has already been forwarded to the owner." }, { status: 409 })
      if (result === "invalid_note") return NextResponse.json({ error: "Add an internal note of 3 to 1,000 characters." }, { status: 400 })
      if (result === "unauthorized") return NextResponse.json({ error: "Your account does not have permission to forward support tickets." }, { status: 403 })
      throw new Error(`Unexpected support ticket forward result: ${result}`)
    }
    let body: string | null = null
    let nextStatus: SupportStatus
    if (parsed.data.action === "reply") {
      body = parsed.data.message
      nextStatus = "waiting_on_user"
    } else {
      nextStatus = parsed.data.status
    }
    const status = await updateSupportTicket({
      ticketId: parsed.data.ticketId,
      actorUserId: access.user.id,
      authorRole: "staff",
      authorName: access.user.name,
      authorEmail: access.user.email,
      body,
      status: nextStatus,
    })
    if (status === "not_found") return NextResponse.json({ error: "Support ticket not found." }, { status: 404 })
    if (status === "invalid_message") return NextResponse.json({ error: "Write a reply of 1 to 5,000 characters." }, { status: 400 })
    if (status === "invalid_status") return NextResponse.json({ error: "Choose a valid support ticket status." }, { status: 400 })
    if (status !== "updated") throw new Error(`Unexpected support ticket update result: ${status}`)

    let notificationSent = true
    if (parsed.data.action === "reply") {
      try {
        const ticket = await getSupportTicketIdentity(parsed.data.ticketId)
        if (!ticket) throw new Error("The support ticket disappeared after its reply was saved.")
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
        console.error(`Support ticket ${parsed.data.ticketId} reply was saved, but the customer email failed.`, error)
      }
    }
    return NextResponse.json({ success: true, notificationSent })
  } catch (error) {
    console.error("Could not update a support ticket.", error)
    return NextResponse.json({ error: "Could not update this support ticket." }, { status: 500 })
  }
}
