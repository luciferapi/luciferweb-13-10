"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Download, LoaderCircle, ShieldCheck } from "lucide-react"
import { formatPriceInr } from "@/features/projects/server/project-pricing"
import { getRazorpayKeyId, loadRazorpayCheckout } from "@/features/payments/client/razorpay-checkout"
import { trackConversion } from "@/lib/analytics"

export function ProjectCheckout({ projectId, title, amountPaise, purchaseLabel }: {
  projectId: string
  title: string
  amountPaise: number
  purchaseLabel?: string
}) {
  const [busy, setBusy] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [downloadToken, setDownloadToken] = useState("")
  const [message, setMessage] = useState("")
  const [needsSignIn, setNeedsSignIn] = useState(false)

  async function updatePendingStatus(orderId: string, status: "cancelled" | "failed") {
    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, status }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => null)
      throw new Error(result?.error ?? "Could not update this transaction.")
    }
  }

  useEffect(() => {
    const savedToken = sessionStorage.getItem(`source-download:${projectId}`)
    if (savedToken) setDownloadToken(savedToken)
  }, [projectId])

  async function downloadSource() {
    if (!downloadToken) return
    setDownloadBusy(true)
    setMessage("")
    try {
      const response = await fetch("/api/download-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: downloadToken }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.error ?? "Could not download the source bundle.")
      }

      const bundle = await response.blob()
      const objectUrl = URL.createObjectURL(bundle)
      const anchor = document.createElement("a")
      anchor.href = objectUrl
      anchor.download = `${projectId}-source.zip`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
      setMessage("Source code download started.")
    } catch (downloadError) {
      setMessage(downloadError instanceof Error ? downloadError.message : "Could not download the source bundle.")
    } finally {
      setDownloadBusy(false)
    }
  }

  async function beginCheckout() {
    const analyticsAttempt = {}
    setBusy(true)
    setMessage("")
    setNeedsSignIn(false)
    try {
      const keyId = await getRazorpayKeyId()
      const Razorpay = await loadRazorpayCheckout()
      const orderResponse = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      })
      const order = await orderResponse.json()
      if (orderResponse.status === 401) setNeedsSignIn(true)
      if (!orderResponse.ok) throw new Error(order.error ?? "Could not start checkout.")

      let paymentHandled = false
      const checkout = new Razorpay({
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: "LUCIFER AI",
        description: title,
        order_id: order.order_id,
        handler: async (payment) => {
          paymentHandled = true
          try {
            const verificationResponse = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ project_id: projectId, ...payment }),
            })
            const verification = await verificationResponse.json()
            if (verificationResponse.status === 401) setNeedsSignIn(true)
            if (!verificationResponse.ok) throw new Error(verification.error ?? "Payment verification failed.")
            if (typeof verification.download_token !== "string") throw new Error("Payment verified, but a download token was not returned.")
            sessionStorage.setItem(`source-download:${projectId}`, verification.download_token)
            setDownloadToken(verification.download_token)
            setMessage("Payment verified. Your source code is available for download.")
            void trackConversion("Project Source Purchased", analyticsAttempt)
          } catch (verificationError) {
            setMessage(verificationError instanceof Error ? verificationError.message : "Payment verification failed.")
          } finally {
            setBusy(false)
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false)
            if (paymentHandled) return
            void updatePendingStatus(order.order_id, "cancelled")
              .then(() => setMessage("Checkout was cancelled and recorded in your transaction history."))
              .catch((error: unknown) => {
                console.error("Could not record the cancelled checkout.", error)
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
        void updatePendingStatus(order.order_id, "failed").catch((error: unknown) => {
          console.error("Could not record the failed checkout.", error)
          setMessage(error instanceof Error ? error.message : "Payment failed, but its status could not be updated.")
        })
      })
      checkout.open()
    } catch (checkoutError) {
      setBusy(false)
      setMessage(checkoutError instanceof Error ? checkoutError.message : "Could not start checkout.")
    }
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void beginCheckout()}
          disabled={busy}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-center text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60 sm:px-5"
        >
          {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <ShieldCheck aria-hidden="true" className="size-4" />}
          {purchaseLabel ?? `Buy for ${formatPriceInr(amountPaise)}`}
        </button>
        {downloadToken ? (
          <button
            type="button"
            onClick={() => void downloadSource()}
            disabled={downloadBusy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 text-center text-sm font-semibold transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
          >
            {downloadBusy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Download aria-hidden="true" className="size-4" />}
            Download source
          </button>
        ) : null}
      </div>
      {message ? (
        <div className="mt-3 text-sm text-muted-foreground" role="status">
          <p>{message}</p>
          {needsSignIn ? <Link href="/login" className="mt-2 inline-flex font-semibold text-cyan-700 underline underline-offset-4 dark:text-cyan-300">Sign in to continue</Link> : null}
        </div>
      ) : null}
    </div>
  )
}
