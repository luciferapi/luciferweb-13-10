import { randomUUID } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { findUserBySession } from "@/lib/auth-store"
import { getRazorpayCredentials } from "@/lib/razorpay-server"
import { PROJECT_REQUEST_FEE_PAISE, savePendingProjectRequest } from "@/lib/project-request-store"

export const runtime = "nodejs"

const requestSchema = z.object({
  projectName: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(5000),
  contactEmail: z.union([z.literal(""), z.string().trim().email().max(254)]).optional().default(""),
  whatsappNumber: z.string().trim().max(25).refine((value) => !value || /^\+?[0-9()\s.-]{7,25}$/.test(value)).optional().default(""),
  telegramId: z.string().trim().max(64).refine((value) => !value || /^(?:@?[A-Za-z0-9_]{3,32}|[0-9]{5,20})$/.test(value)).optional().default(""),
  preferredLanguage: z.string().trim().min(1).max(80),
  desiredDuration: z.string().trim().min(1).max(160),
  acceptsNonRefundableFee: z.literal(true),
}).refine(
  (value) => Boolean(value.contactEmail || value.whatsappNumber || value.telegramId),
  { message: "Provide at least one contact method: email, WhatsApp, or Telegram." },
)

export async function POST(request: Request) {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Sign in with a verified account before requesting a project." }, { status: 401 })

  let user
  try {
    user = await findUserBySession(token)
  } catch (error) {
    console.error("Could not verify the project requester session.", error)
    return NextResponse.json({ error: "Could not verify your sign-in right now." }, { status: 500 })
  }
  if (!user) return NextResponse.json({ error: "Sign in with a verified account before requesting a project." }, { status: 401 })

  const credentials = getRazorpayCredentials()
  if (!credentials) return NextResponse.json({ error: "Razorpay is not configured on the server." }, { status: 503 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a project name and description, provide at least one contact method, choose a preferred language and timeline, and accept the non-refundable ₹1 request fee." }, { status: 400 })
  }

  const requestRef = randomUUID()
  try {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: credentials.authorization,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount: PROJECT_REQUEST_FEE_PAISE,
        currency: "INR",
        receipt: `request_${requestRef.replace(/-/g, "")}`,
        notes: { request_ref: requestRef, user_id: user.id },
      }),
      cache: "no-store",
    })

    const order = await response.json().catch(() => null)
    if (response.status === 401) return NextResponse.json({ error: "Razorpay rejected the server credentials." }, { status: 502 })
    if (!response.ok || typeof order?.id !== "string" || order.amount !== PROJECT_REQUEST_FEE_PAISE || order.currency !== "INR") {
      return NextResponse.json({ error: "Razorpay could not create the request payment order." }, { status: 500 })
    }

    await savePendingProjectRequest({
      requestRef,
      orderId: order.id,
      userId: user.id,
      projectName: parsed.data.projectName,
      description: parsed.data.description,
      contactEmail: parsed.data.contactEmail,
      whatsappNumber: parsed.data.whatsappNumber,
      telegramId: parsed.data.telegramId,
      preferredLanguage: parsed.data.preferredLanguage,
      desiredDuration: parsed.data.desiredDuration,
    })

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      request_ref: requestRef,
    })
  } catch (error) {
    console.error("Could not create or record the project request payment.", error)
    return NextResponse.json({ error: "Could not create the project request payment." }, { status: 500 })
  }
}
