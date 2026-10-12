"use client"

import { useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import type { ApiEndpoint } from "@/features/api-endpoints/server/api-endpoint-types"
import type { RazorpaySuccess } from "@/features/payments/server/razorpay-types"
import { formatPriceInr } from "@/features/projects/server/project-pricing"
import { getRazorpayKeyId, loadRazorpayCheckout } from "@/features/payments/client/razorpay-checkout"
import { trackConversion } from "@/lib/analytics"

export function ApiEndpointPurchaseButton({
  endpoint,
  onUnlocked,
}: {
  endpoint: ApiEndpoint
  onUnlocked: (endpointId: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  async function updatePendingOrder(orderId: string, status: "cancelled" | "failed") {
    const response = await fetch("/api/api-endpoints/purchase/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, status }),
    })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const error = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
        ? result.error
        : "Could not update this API payment."
      throw new Error(error)
    }
  }

  async function beginCheckout() {
    const analyticsAttempt = {}
    setBusy(true)
    setMessage("")
    try {
      const keyId = await getRazorpayKeyId()
      const Razorpay = await loadRazorpayCheckout()
      const response = await fetch("/api/api-endpoints/purchase/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId: endpoint.id }),
      })
      const order: unknown = await response.json()
      if (!response.ok) {
        const error = typeof order === "object" && order !== null && "error" in order && typeof order.error === "string"
          ? order.error
          : "Could not start API access checkout."
        throw new Error(error)
      }
      if (
        typeof order !== "object" ||
        order === null ||
        !("order_id" in order) || typeof order.order_id !== "string" ||
        !("amount" in order) || typeof order.amount !== "number" ||
        !("currency" in order) || order.currency !== "INR"
      ) throw new Error("The API checkout order response was invalid.")

      const orderId = order.order_id
      let paymentHandled = false
      const checkout = new Razorpay({
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: "LUCIFER AI",
        description: `Explorer access: ${endpoint.name}`,
        order_id: orderId,
        handler: async (payment: RazorpaySuccess) => {
          paymentHandled = true
          try {
            const verifyResponse = await fetch("/api/api-endpoints/purchase/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payment),
            })
            const result: unknown = await verifyResponse.json()
            if (!verifyResponse.ok) {
              const error = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
                ? result.error
                : "API payment verification failed."
              throw new Error(error)
            }
            if (
              typeof result !== "object" ||
              result === null ||
              !("success" in result) || result.success !== true ||
              !("endpointId" in result) || result.endpointId !== endpoint.id
            ) throw new Error("The API access payment confirmation was invalid.")
            setMessage("Payment verified. Explorer testing is now unlocked.")
            void trackConversion("API Explorer Purchased", analyticsAttempt)
            onUnlocked(endpoint.id)
          } catch (error) {
            console.error("Could not verify API Explorer access payment.", error)
            setMessage(error instanceof Error ? error.message : "API payment verification failed.")
          } finally {
            setBusy(false)
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false)
            if (paymentHandled) return
            void updatePendingOrder(orderId, "cancelled").catch((error: unknown) => {
              console.error("Could not record the cancelled API checkout.", error)
              setMessage(error instanceof Error ? error.message : "Checkout was cancelled, but its status could not be updated.")
            })
          },
        },
        theme: { color: "#67e8f9" },
      })

      checkout.on("payment.failed", (failure) => {
        paymentHandled = true
        setBusy(false)
        setMessage(failure.error?.description ?? "Payment failed. Please try again.")
        void updatePendingOrder(orderId, "failed").catch((error: unknown) => {
          console.error("Could not record the failed API payment.", error)
          setMessage(error instanceof Error ? error.message : "Payment failed, but its status could not be updated.")
        })
      })
      checkout.open()
    } catch (error) {
      console.error("Could not start API Explorer checkout.", error)
      setBusy(false)
      setMessage(error instanceof Error ? error.message : "Could not start API access checkout.")
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void beginCheckout()}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-cyan-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200"
      >
        {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <ShieldCheck aria-hidden="true" className="h-4 w-4" />}
        {busy ? "Opening checkout" : `Buy Explorer access for ${formatPriceInr(endpoint.pricePaise)}`}
      </button>
      {message ? <p className="mt-2 text-sm text-muted-foreground" role="status">{message}</p> : null}
    </div>
  )
}
