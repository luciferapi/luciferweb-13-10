import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { getSignedInUser } from "@/features/auth/server/auth-session"
import { z } from "zod"
import { createRazorpayOrder, getRazorpayCredentials } from "@/features/payments/server/razorpay-server"
import { PROJECT_REQUEST_FEE_PAISE, savePendingProjectRequest } from "@/features/projects/server/project-request-store"
import { readLimitedJson } from "@/lib/server/read-limited-json"
import { enforceRateLimit } from "@/lib/server/rate-limit"

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

  let user
  try {
    user = await getSignedInUser()
  } catch (error) {
    console.error("Could not verify the project requester session.", error)
    return NextResponse.json({ error: "Could not verify your sign-in right now." }, { status: 500 })
  }
  if (!user) return NextResponse.json({ error: "Sign in with a verified account before requesting a project." }, { status: 401 })

  const rateLimitResponse = await enforceRateLimit(request, "project-request-order", {
    capacity: 5,
    refillSeconds: 10 * 60,
    identifiers: [user.id],
  })
  if (rateLimitResponse) return rateLimitResponse

  const credentials = getRazorpayCredentials()
  if (!credentials) return NextResponse.json({ error: "Razorpay is not configured on the server." }, { status: 503 })

  const body = await readLimitedJson(request, 16 * 1024)
  if (!body.ok) {
    return NextResponse.json(
      { error: body.status === 413 ? "The request is too large." : "Send a valid JSON request body." },
      { status: body.status },
    )
  }
  const parsed = requestSchema.safeParse(body.value)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const validationMessages: Record<string, string> = {
      projectName: "Enter a project name between 2 and 120 characters.",
      description: "Describe the project in 10 to 5,000 characters.",
      contactEmail: "Enter a valid contact email or clear the field.",
      whatsappNumber: "Enter a valid WhatsApp number or clear the field.",
      telegramId: "Enter a valid Telegram username or ID, or clear the field.",
      preferredLanguage: "Enter your preferred language.",
      desiredDuration: "Tell us when you need the project.",
      acceptsNonRefundableFee: "Accept the non-refundable ₹1 request fee before continuing.",
    }
    return NextResponse.json(
      {
        error: issue?.path.length
          ? validationMessages[String(issue.path[0])] ?? "Check the project request details and try again."
          : issue?.message ?? "Check the project request details and try again.",
      },
      { status: 400 },
    )
  }

  const requestRef = randomUUID()
  try {
    const { response, order } = await createRazorpayOrder(credentials, {
      amountPaise: PROJECT_REQUEST_FEE_PAISE,
      receipt: `request_${requestRef.replace(/-/g, "")}`,
      notes: { request_ref: requestRef, user_id: user.id },
    })
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
