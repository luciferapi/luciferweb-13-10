import { randomUUID } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { findUserBySession } from "@/features/auth/server/auth-store"
import { createRazorpayOrder, getRazorpayCredentials } from "@/features/payments/server/razorpay-server"
import { readProjects } from "@/features/projects/server/project-store"
import { parsePriceToPaise } from "@/features/projects/server/project-pricing"
import { hasProjectSourceBundle } from "@/features/projects/server/source-bundles"
import { createSourceDownloadToken } from "@/features/projects/server/source-download-token"
import {
  markProjectPurchaseCancelled,
  savePendingProjectPurchase,
  saveWalletOnlyProjectPurchase,
} from "@/features/purchases/server/purchase-store"
import {
  releaseWalletPurchaseDebit,
  reserveWalletPurchaseDebit,
} from "@/features/wallet/server/wallet-purchase-store"
import { readLimitedJson } from "@/lib/server/read-limited-json"
import { enforceRateLimit } from "@/lib/server/rate-limit"

export const runtime = "nodejs"

const requestSchema = z.object({
  project_id: z.string().min(1).max(128),
  wallet_amount_paise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional().default(0),
})

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

  const rateLimitResponse = await enforceRateLimit(request, "project-purchase-order", {
    capacity: 10,
    refillSeconds: 10 * 60,
    identifiers: [user.id],
  })
  if (rateLimitResponse) return rateLimitResponse

  const body = await readLimitedJson(request, 4 * 1024)
  if (!body.ok) {
    return NextResponse.json(
      { error: body.status === 413 ? "The request is too large." : "Send a valid JSON request body." },
      { status: body.status },
    )
  }
  const parsed = requestSchema.safeParse(body.value)
  if (!parsed.success) return NextResponse.json({ error: "A valid project_id and wallet amount are required." }, { status: 400 })

  try {
    const project = (await readProjects()).find((entry) => entry.code === parsed.data.project_id && entry.isPublished)
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 })
    if (!(await hasProjectSourceBundle(project.code))) {
      return NextResponse.json({ error: "The source code bundle is not uploaded yet." }, { status: 409 })
    }

    const totalAmountPaise = parsePriceToPaise(project.price)
    if (totalAmountPaise === null || totalAmountPaise < 100) {
      return NextResponse.json({ error: "This project does not have a valid price of at least ₹1.00." }, { status: 400 })
    }

    const walletAmountPaise = parsed.data.wallet_amount_paise
    if (walletAmountPaise > totalAmountPaise) {
      return NextResponse.json({ error: "The selected wallet amount cannot exceed the project price." }, { status: 400 })
    }

    const remainingPaise = totalAmountPaise - walletAmountPaise
    if (remainingPaise > 0 && remainingPaise < 100) {
      return NextResponse.json({ error: "Leave at least ₹1.00 for Razorpay, or use your wallet for the full project price." }, { status: 400 })
    }

    if (remainingPaise === 0) {
      const orderId = `wallet_${randomUUID().replace(/-/g, "")}`
      const downloadToken = createSourceDownloadToken(project.code, orderId)
      if (!downloadToken) {
        return NextResponse.json({ error: "Secure source downloads are not configured on the server." }, { status: 503 })
      }
      const recorded = await saveWalletOnlyProjectPurchase({
        orderId,
        userId: user.id,
        projectCode: project.code,
        projectTitle: project.title,
        amountPaise: totalAmountPaise,
      })
      if (!recorded) return NextResponse.json({ error: "Your wallet balance changed. Refresh it and try again." }, { status: 409 })

      return NextResponse.json({
        wallet_only: true,
        order_id: orderId,
        amount: 0,
        currency: "INR",
        wallet_applied_paise: walletAmountPaise,
        download_token: downloadToken,
      }, { headers: { "Cache-Control": "private, no-store" } })
    }

    const credentials = getRazorpayCredentials()
    if (!credentials) {
      return NextResponse.json({ error: "Razorpay is not configured on the server." }, { status: 503 })
    }

    const { response, order } = await createRazorpayOrder(credentials, {
      amountPaise: remainingPaise,
      receipt: `project_${randomUUID().replace(/-/g, "")}`,
      notes: {
        project_id: project.code,
        user_id: user.id,
        total_amount_paise: String(totalAmountPaise),
        wallet_applied_paise: String(walletAmountPaise),
      },
    })
    if (response.status === 401) {
      return NextResponse.json({ error: "Razorpay rejected the server credentials." }, { status: 401 })
    }
    if (!response.ok || typeof order?.id !== "string" || order.amount !== remainingPaise || order.currency !== "INR") {
      return NextResponse.json({ error: "Razorpay could not create the order." }, { status: 500 })
    }

    const recorded = await savePendingProjectPurchase({
      orderId: order.id,
      userId: user.id,
      projectCode: project.code,
      projectTitle: project.title,
      amountPaise: totalAmountPaise,
    })
    if (!recorded) {
      return NextResponse.json({ error: "Could not add the pending payment to your transaction history." }, { status: 500 })
    }

    if (walletAmountPaise > 0) {
      try {
        const reserved = await reserveWalletPurchaseDebit({
          userId: user.id,
          purchaseKey: order.id,
          amountPaise: walletAmountPaise,
        })
        if (!reserved) {
          await markProjectPurchaseCancelled(order.id, user.id)
          return NextResponse.json({ error: "Your wallet balance changed. Refresh it and choose a smaller amount." }, { status: 409 })
        }
      } catch (error) {
        await markProjectPurchaseCancelled(order.id, user.id).catch(() => undefined)
        await releaseWalletPurchaseDebit(order.id, user.id).catch(() => undefined)
        throw error
      }
    }

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      wallet_applied_paise: walletAmountPaise,
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not create or record the project order.", error)
    return NextResponse.json({ error: "Could not create the payment order." }, { status: 500 })
  }
}
