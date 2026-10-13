import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { findUserBySession } from "@/features/auth/server/auth-store"
import { getRazorpayCredentials, fetchRazorpayOrder } from "@/features/payments/server/razorpay-server"
import { readProjects } from "@/features/projects/server/project-store"
import { parsePriceToPaise } from "@/features/projects/server/project-pricing"
import { hasProjectSourceBundle } from "@/features/projects/server/source-bundles"
import { createSourceDownloadToken } from "@/features/projects/server/source-download-token"
import { saveProjectPurchase } from "@/features/purchases/server/purchase-store"

export const runtime = "nodejs"

const requestSchema = z.object({
  project_id: z.string().min(1).max(100),
  razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
})

export async function POST(request: Request) {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Sign in to verify and record this purchase." }, { status: 401 })

  let user
  try {
    user = await findUserBySession(token)
  } catch (error) {
    console.error("Could not verify the buyer session.", error)
    return NextResponse.json({ error: "Could not verify your sign-in right now." }, { status: 500 })
  }
  if (!user) return NextResponse.json({ error: "Sign in to verify and record this purchase." }, { status: 401 })

  const credentials = getRazorpayCredentials()
  if (!credentials) {
    return NextResponse.json({ error: "Razorpay is not configured on the server." }, { status: 503 })
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Required payment fields are missing or invalid." }, { status: 400 })

  const { project_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data
  const expectedSignature = createHmac("sha256", credentials.keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest()
  const receivedSignature = Buffer.from(razorpay_signature, "hex")

  if (expectedSignature.length !== receivedSignature.length || !timingSafeEqual(expectedSignature, receivedSignature)) {
    return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 })
  }

  try {
    const project = (await readProjects()).find((entry) => entry.code === project_id && entry.isPublished)
    const expectedAmount = project ? parsePriceToPaise(project.price) : null
    if (!project || expectedAmount === null) {
      return NextResponse.json({ error: "Project not found or price is invalid." }, { status: 400 })
    }

    const orderResponse = await fetchRazorpayOrder(razorpay_order_id, credentials.authorization)
    const order = await orderResponse.json().catch(() => null)
    if (orderResponse.status === 401) {
      return NextResponse.json({ error: "Razorpay rejected the server credentials." }, { status: 401 })
    }
    if (!orderResponse.ok) {
      return NextResponse.json({ error: "Could not verify the Razorpay order." }, { status: 500 })
    }

    if (
      order?.id !== razorpay_order_id ||
      order?.notes?.project_id !== project.code ||
      order?.notes?.user_id !== user.id ||
      order?.amount !== expectedAmount ||
      order?.currency !== "INR" ||
      order?.status !== "paid"
    ) {
      return NextResponse.json({ error: "The payment does not match this project order." }, { status: 400 })
    }

    const recorded = await saveProjectPurchase({
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      userId: user.id,
      projectCode: project.code,
      projectTitle: project.title,
      amountPaise: expectedAmount,
    })
    if (!recorded) {
      return NextResponse.json({ error: "Payment succeeded, but the purchase record conflicts with an existing transaction. Contact support." }, { status: 409 })
    }

    if (!(await hasProjectSourceBundle(project.code))) {
      return NextResponse.json({ error: "Payment was verified and added to your transaction history, but the source bundle is currently unavailable. Contact the site owner." }, { status: 503 })
    }

    const downloadToken = createSourceDownloadToken(project.code, razorpay_payment_id)
    if (!downloadToken) return NextResponse.json({ error: "Payment was verified and added to your transaction history, but could not prepare the secure source download." }, { status: 503 })

    return NextResponse.json({ success: true, project_id: project.code, payment_id: razorpay_payment_id, download_token: downloadToken })
  } catch (error) {
    console.error("Could not verify or record the project purchase.", error)
    return NextResponse.json({ error: "Could not verify the payment." }, { status: 500 })
  }
}
