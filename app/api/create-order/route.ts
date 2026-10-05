import { randomUUID } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { findUserBySession } from "@/lib/auth-store"
import { z } from "zod"
import { getRazorpayCredentials } from "@/lib/razorpay-server"
import { readProjects } from "@/lib/project-store"
import { parsePriceToPaise } from "@/lib/project-pricing"
import { hasProjectSourceBundle } from "@/lib/source-bundles"
import { savePendingProjectPurchase } from "@/lib/purchase-store"

export const runtime = "nodejs"

const requestSchema = z.object({ project_id: z.string().min(1).max(100) })

export async function POST(request: Request) {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Sign in before buying a project." }, { status: 401 })

  let user
  try {
    user = await findUserBySession(token)
  } catch (error) {
    console.error("Could not verify the buyer session.", error)
    return NextResponse.json({ error: "Could not verify your sign-in right now." }, { status: 500 })
  }
  if (!user) return NextResponse.json({ error: "Sign in before buying a project." }, { status: 401 })

  const credentials = getRazorpayCredentials()
  if (!credentials) {
    return NextResponse.json({ error: "Razorpay is not configured on the server." }, { status: 503 })
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "A valid project_id is required." }, { status: 400 })

  try {
    const project = (await readProjects()).find((entry) => entry.code === parsed.data.project_id && entry.isPublished)
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 })
    if (!(await hasProjectSourceBundle(project.code))) {
      return NextResponse.json({ error: "The source code bundle is not uploaded yet." }, { status: 409 })
    }

    const amount = parsePriceToPaise(project.price)
    if (amount === null || amount < 100) {
      return NextResponse.json({ error: "This project does not have a valid price of at least ₹1.00." }, { status: 400 })
    }

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: credentials.authorization,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: `project_${randomUUID().replace(/-/g, "")}`,
        notes: { project_id: project.code, user_id: user.id },
      }),
      cache: "no-store",
    })

    const order = await response.json().catch(() => null)
    if (response.status === 401) {
      return NextResponse.json({ error: "Razorpay rejected the server credentials." }, { status: 401 })
    }
    if (!response.ok || typeof order?.id !== "string" || order.amount !== amount || order.currency !== "INR") {
      return NextResponse.json({ error: "Razorpay could not create the order." }, { status: 500 })
    }

    const recorded = await savePendingProjectPurchase({
      orderId: order.id,
      userId: user.id,
      projectCode: project.code,
      projectTitle: project.title,
      amountPaise: amount,
    })
    if (!recorded) {
      return NextResponse.json({ error: "Could not add the pending payment to your transaction history." }, { status: 500 })
    }

    return NextResponse.json({ order_id: order.id, amount: order.amount, currency: order.currency })
  } catch (error) {
    console.error("Could not create or record the project order.", error)
    return NextResponse.json({ error: "Could not create the payment order." }, { status: 500 })
  }
}