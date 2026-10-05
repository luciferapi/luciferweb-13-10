import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { findUserBySession } from "@/lib/auth-store"
import { sendProjectRequestNotification } from "@/lib/email"
import { fetchRazorpayOrder, getRazorpayCredentials } from "@/lib/razorpay-server"
import {
  markProjectRequestNotification,
  markProjectRequestPaid,
  PROJECT_REQUEST_FEE_PAISE,
} from "@/lib/project-request-store"

export const runtime = "nodejs"

const requestSchema = z.object({
  request_ref: z.string().uuid(),
  razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
})

export async function POST(request: Request) {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Sign in to verify and submit your project request." }, { status: 401 })

  let user
  try {
    user = await findUserBySession(token)
  } catch (error) {
    console.error("Could not verify the project requester session.", error)
    return NextResponse.json({ error: "Could not verify your sign-in right now." }, { status: 500 })
  }
  if (!user) return NextResponse.json({ error: "Sign in to verify and submit your project request." }, { status: 401 })

  const credentials = getRazorpayCredentials()
  if (!credentials) return NextResponse.json({ error: "Razorpay is not configured on the server." }, { status: 503 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Required payment verification fields are missing or invalid." }, { status: 400 })

  const { request_ref, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) return NextResponse.json({ error: "Razorpay is not configured on the server." }, { status: 503 })

  const expectedSignature = createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest()
  const receivedSignature = Buffer.from(razorpay_signature, "hex")
  if (expectedSignature.length !== receivedSignature.length || !timingSafeEqual(expectedSignature, receivedSignature)) {
    return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 })
  }

  try {
    const orderResponse = await fetchRazorpayOrder(razorpay_order_id, credentials.authorization)
    const order = await orderResponse.json().catch(() => null)
    if (orderResponse.status === 401) return NextResponse.json({ error: "Razorpay rejected the server credentials." }, { status: 502 })
    if (!orderResponse.ok) return NextResponse.json({ error: "Could not verify the Razorpay order." }, { status: 500 })
    if (
      order?.id !== razorpay_order_id ||
      order?.notes?.request_ref !== request_ref ||
      order?.notes?.user_id !== user.id ||
      order?.amount !== PROJECT_REQUEST_FEE_PAISE ||
      order?.currency !== "INR" ||
      order?.status !== "paid"
    ) {
      return NextResponse.json({ error: "The payment does not match this project request." }, { status: 400 })
    }

    const savedRequest = await markProjectRequestPaid({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      userId: user.id,
      requestRef: request_ref,
    })
    if (!savedRequest) {
      return NextResponse.json({ error: "The verified payment could not be matched to your project request." }, { status: 409 })
    }

    if (savedRequest.sendNotification) {
      try {
        await sendProjectRequestNotification({
          requestNumber: savedRequest.requestNumber,
          projectName: savedRequest.projectName,
          description: savedRequest.description,
          userEmail: savedRequest.email,
          contactEmail: savedRequest.contactEmail,
          whatsappNumber: savedRequest.whatsappNumber,
          telegramId: savedRequest.telegramId,
          preferredLanguage: savedRequest.preferredLanguage,
          desiredDuration: savedRequest.desiredDuration,
        })
        await markProjectRequestNotification(request_ref, "sent")
      } catch (error) {
        console.error(`Project request #${savedRequest.requestNumber} was saved, but its email notification failed.`, error)
        try {
          await markProjectRequestNotification(request_ref, "failed")
        } catch (statusError) {
          console.error(`Could not record the notification failure for project request #${savedRequest.requestNumber}.`, statusError)
        }
        return NextResponse.json({
          success: true,
          request_number: savedRequest.requestNumber,
          notification_sent: false,
          message: "Your request was submitted and payment verified, but the notification email could not be sent. Please contact support with your request number.",
        })
      }
    }

    return NextResponse.json({
      success: true,
      request_number: savedRequest.requestNumber,
      notification_sent: true,
    })
  } catch (error) {
    console.error("Could not verify or submit the paid project request.", error)
    return NextResponse.json({ error: "Could not verify the project request payment." }, { status: 500 })
  }
}
