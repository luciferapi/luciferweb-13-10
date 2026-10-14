import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { getSignedInUser } from "@/features/auth/server/auth-session"
import { z } from "zod"
import { sendSupportTicketNotification } from "@/features/notifications/server/email"
import { listUserProjectPurchases } from "@/features/purchases/server/purchase-store"
import { createSupportTicket, listSupportTickets } from "@/features/support/server/support-tickets"
import { enforceRateLimit } from "@/lib/server/rate-limit"
import { readLimitedFormData } from "@/lib/server/read-limited-form-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const supportTicketCode = () => `SUP-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`

const issueTypes = ["account", "payment", "project", "api", "other"] as const
const allowedAttachments = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["application/pdf", ".pdf"],
])
const maximumAttachmentBytes = 5 * 1024 * 1024
const maximumRequestBytes = maximumAttachmentBytes + 64 * 1024

const ticketSchema = z.object({
  issueType: z.enum(issueTypes),
  orderId: z.string().max(100),
  description: z.string().trim().min(10).max(5000),
})

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof getSignedInUser>>
  try {
    user = await getSupportUser()
  } catch (error) {
    console.error("Could not verify the support ticket session.", error)
    return NextResponse.json({ error: "Could not verify your sign-in right now." }, { status: 500 })
  }
  if (!user || !user.email) {
    return NextResponse.json({ error: "A verified account email is required to submit a support ticket." }, { status: 401 })
  }

  const rateLimitResponse = await enforceRateLimit(request, "support-ticket", {
    capacity: 5,
    refillSeconds: 60 * 60,
    identifiers: [user.id],
  })
  if (rateLimitResponse) return rateLimitResponse

  const formResult = await readLimitedFormData(request, maximumRequestBytes)
  if (!formResult.ok) {
    return NextResponse.json(
      { error: formResult.status === 413 ? "Support ticket uploads must be 5 MB or smaller." : "The support ticket form could not be read." },
      { status: formResult.status },
    )
  }
  const formData = formResult.value

  const parsed = ticketSchema.safeParse({
    issueType: formData.get("issueType"),
    orderId: formData.get("orderId") ?? "",
    description: formData.get("description"),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose an issue type and describe the problem in at least 10 characters." }, { status: 400 })
  }

  let attachment: { filename: string; content: Buffer; contentType: string } | undefined
  const uploadedFile = formData.get("attachment")
  if (uploadedFile instanceof File && uploadedFile.size > 0) {
    const extension = allowedAttachments.get(uploadedFile.type)
    if (!extension) {
      return NextResponse.json({ error: "Attachments must be a JPG, PNG, WebP, or PDF file." }, { status: 400 })
    }
    if (uploadedFile.size > maximumAttachmentBytes) {
      return NextResponse.json({ error: "Attachments must be 5 MB or smaller." }, { status: 413 })
    }
    const content = Buffer.from(await uploadedFile.arrayBuffer())
    const signatureIsValid =
      uploadedFile.type === "image/jpeg" ? content.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) :
      uploadedFile.type === "image/png" ? content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) :
      uploadedFile.type === "application/pdf" ? content.subarray(0, 5).toString("ascii") === "%PDF-" :
      uploadedFile.type === "image/webp" ? content.subarray(0, 4).toString("ascii") === "RIFF" && content.subarray(8, 12).toString("ascii") === "WEBP" :
      false
    if (!signatureIsValid) {
      return NextResponse.json({ error: "The attachment content does not match its file type." }, { status: 400 })
    }
    attachment = {
      filename: `support-attachment${extension}`,
      content,
      contentType: uploadedFile.type,
    }
  }

  try {
    if (parsed.data.orderId) {
      const purchases = await listUserProjectPurchases(user.id)
      if (!purchases.some((purchase) => purchase.orderId === parsed.data.orderId)) {
        return NextResponse.json({ error: "That order number does not belong to your account." }, { status: 400 })
      }
    }

    const ticketCode = supportTicketCode()
    await createSupportTicket({
      ticketCode,
      userId: user.id,
      issueType: parsed.data.issueType,
      orderId: parsed.data.orderId || null,
      message: parsed.data.description,
    })
    let notificationSent = true
    try {
      await sendSupportTicketNotification({
        ticketId: ticketCode,
        issueType: parsed.data.issueType,
        orderId: parsed.data.orderId,
        description: parsed.data.description,
        userName: user.name,
        userEmail: user.email,
        attachment,
      })
    } catch (error) {
      notificationSent = false
      console.error(`Support ticket ${ticketCode} was saved, but its email notification failed.`, error)
    }
    return NextResponse.json({ success: true, ticketId: ticketCode, notificationSent }, { status: 201 })
  } catch (error) {
    console.error("Could not save the support ticket.", error)
    return NextResponse.json({ error: "Could not save your ticket right now. Please try again." }, { status: 500 })
  }
}

export async function GET() {
  try {
    const user = await getSupportUser()
    if (!user) return NextResponse.json({ error: "Sign in to view your support tickets." }, { status: 401 })
    const result = await listSupportTickets({ userId: user.id })
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not load customer support tickets.", error)
    return NextResponse.json({ error: "Could not load your support tickets." }, { status: 500 })
  }
}

async function getSupportUser() {
  return getSignedInUser()
}
