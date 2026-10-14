import { NextResponse } from "next/server"
import { getSignedInUser } from "@/features/auth/server/auth-session"
import { z } from "zod"
import { sendSupportTicketFollowupNotification } from "@/features/notifications/server/email"
import { getSupportTicketIdentity, updateSupportTicket } from "@/features/support/server/support-tickets"
import { readLimitedJson } from "@/lib/server/read-limited-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const messageSchema = z.object({
  message: z.string().trim().min(1).max(5000),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {

  let user: Awaited<ReturnType<typeof getSignedInUser>>
  try {
    user = await getSignedInUser()
  } catch (error) {
    console.error("Could not verify the customer support session.", error)
    return NextResponse.json({ error: "Could not verify your sign-in right now." }, { status: 500 })
  }
  if (!user?.email) return NextResponse.json({ error: "Sign in to reply to your support ticket." }, { status: 401 })

  const body = await readLimitedJson(request, 8 * 1024)
  if (!body.ok) {
    return NextResponse.json(
      { error: body.status === 413 ? "Your reply is too large." : "Send a valid JSON request body." },
      { status: body.status },
    )
  }
  const parsed = messageSchema.safeParse(body.value)
  if (!parsed.success) {
    return NextResponse.json({ error: "Write a reply of 1 to 5,000 characters." }, { status: 400 })
  }
  const { ticketId } = await params
  if (!z.string().uuid().safeParse(ticketId).success) {
    return NextResponse.json({ error: "Choose a valid support ticket." }, { status: 400 })
  }

  try {
    const status = await updateSupportTicket({
      ticketId,
      actorUserId: user.id,
      authorRole: "customer",
      authorName: user.name,
      authorEmail: user.email,
      body: parsed.data.message,
      status: null,
    })
    if (status === "updated") {
      let notificationSent = true
      try {
        const ticket = await getSupportTicketIdentity(ticketId)
        if (!ticket || ticket.userId !== user.id) throw new Error("The support ticket customer could not be verified.")
        await sendSupportTicketFollowupNotification({
          ticketId: ticket.ticketCode,
          issueType: ticket.issueType,
          userName: user.name,
          userEmail: user.email,
          message: parsed.data.message,
        })
      } catch (error) {
        notificationSent = false
        console.error(`Customer reply to support ticket ${ticketId} was saved, but its email alert failed.`, error)
      }
      return NextResponse.json({ success: true, notificationSent })
    }
    if (status === "not_found") return NextResponse.json({ error: "Support ticket not found." }, { status: 404 })
    if (status === "invalid_message") return NextResponse.json({ error: "Write a reply of 1 to 5,000 characters." }, { status: 400 })
    throw new Error(`Unexpected customer support reply result: ${status}`)
  } catch (error) {
    console.error("Could not save the customer support reply.", error)
    return NextResponse.json({ error: "Could not save your reply right now." }, { status: 500 })
  }
}
