"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowDownToLine, LoaderCircle } from "lucide-react"
import { loadRazorpayCheckout } from "@/features/payments/client/razorpay-checkout"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { RazorpayFailure, RazorpayOptions, RazorpaySuccess } from "@/features/payments/server/razorpay-types"

const presetAmounts = [1, 100, 250, 1000]
const pendingVerificationStorageKey = "lucifer:wallet-deposit-verification"

type OrderResponse = {
  order_id: string
  amount: number
  currency: "INR"
  key_id: string
}

function isOrderResponse(value: unknown): value is OrderResponse {
  return typeof value === "object" &&
    value !== null &&
    "order_id" in value && typeof value.order_id === "string" &&
    "amount" in value && typeof value.amount === "number" &&
    "currency" in value && value.currency === "INR" &&
    "key_id" in value && typeof value.key_id === "string"
}

function getErrorMessage(value: unknown, fallback: string) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
    ? value.error
    : fallback
}

export function WalletDepositControl() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("1")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function verifyPayment(payment: RazorpaySuccess) {
    const response = await fetch("/api/wallet/deposits/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payment),
    })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok || typeof result !== "object" || result === null || !("success" in result) || result.success !== true) {
      throw new Error(getErrorMessage(result, "Could not verify your deposit. Contact support with your Razorpay payment ID."))
    }
    window.localStorage.removeItem(pendingVerificationStorageKey)
  }

  useEffect(() => {
    const savedPayment = window.localStorage.getItem(pendingVerificationStorageKey)
    if (!savedPayment) return

    let payment: RazorpaySuccess
    try {
      const parsed: unknown = JSON.parse(savedPayment)
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !("razorpay_payment_id" in parsed) || typeof parsed.razorpay_payment_id !== "string" ||
        !("razorpay_order_id" in parsed) || typeof parsed.razorpay_order_id !== "string" ||
        !("razorpay_signature" in parsed) || typeof parsed.razorpay_signature !== "string"
      ) return
      payment = parsed as RazorpaySuccess
    } catch {
      window.localStorage.removeItem(pendingVerificationStorageKey)
      return
    }

    let cancelled = false
    setBusy(true)
    void verifyPayment(payment)
      .then(() => {
        if (cancelled) return
        window.dispatchEvent(new Event("wallet-deposit-updated"))
        router.refresh()
      })
      .catch((retryError: unknown) => {
        if (!cancelled) {
          console.error("Could not retry the wallet deposit verification.", retryError)
          setError(retryError instanceof Error ? retryError.message : "Your deposit is awaiting verification. Please refresh and try again.")
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })

    return () => {
      cancelled = true
    }
  }, [router])

  async function updatePendingStatus(orderId: string, status: "cancelled" | "failed") {
    const response = await fetch("/api/wallet/deposits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, status }),
    })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok) throw new Error(getErrorMessage(result, "Could not update this deposit."))
    window.dispatchEvent(new Event("wallet-deposit-updated"))
  }

  async function beginDeposit() {
    const selectedAmount = Number(amount)
    if (!Number.isInteger(selectedAmount) || selectedAmount < 1 || selectedAmount > 1000) {
      setError("Enter a whole-rupee amount from ₹1 to ₹1,000.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const Razorpay = await loadRazorpayCheckout()
      const orderResponse = await fetch("/api/wallet/deposits/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: selectedAmount }),
      })
      const orderData: unknown = await orderResponse.json().catch(() => null)
      if (!orderResponse.ok || !isOrderResponse(orderData)) {
        throw new Error(getErrorMessage(orderData, "Could not start this deposit."))
      }

      let paymentHandled = false
      const options: RazorpayOptions = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "LUCIFER AI",
        description: "Wallet deposit",
        order_id: orderData.order_id,
        handler: async (payment) => {
          paymentHandled = true
          try {
            window.localStorage.setItem(pendingVerificationStorageKey, JSON.stringify(payment))
            await verifyPayment(payment)
            setOpen(false)
            window.dispatchEvent(new Event("wallet-deposit-updated"))
            router.refresh()
          } catch (verificationError) {
            console.error("Could not verify the wallet deposit.", verificationError)
            setError(verificationError instanceof Error ? verificationError.message : "Could not verify your deposit.")
          } finally {
            setBusy(false)
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false)
            if (paymentHandled) return
            void updatePendingStatus(orderData.order_id, "cancelled")
              .then(() => setError("Checkout was closed. No money was added to your wallet."))
              .catch((statusError: unknown) => {
                console.error("Could not record the cancelled wallet deposit.", statusError)
                setError(statusError instanceof Error ? statusError.message : "Checkout was closed, but the deposit status could not be updated.")
              })
          },
        },
        theme: { color: "#67e8f9" },
      }

      const checkout = new Razorpay(options)
      checkout.on("payment.failed", (failure: RazorpayFailure) => {
        paymentHandled = true
        setBusy(false)
        const failureMessage = failure.error?.description ?? "Payment failed. Please try again."
        setError(failureMessage)
        void updatePendingStatus(orderData.order_id, "failed").catch((statusError: unknown) => {
          console.error("Could not record the failed wallet deposit.", statusError)
          setError(statusError instanceof Error ? statusError.message : `${failureMessage} Deposit status could not be updated.`)
        })
      })
      checkout.open()
    } catch (depositError) {
      setBusy(false)
      setError(depositError instanceof Error ? depositError.message : "Could not start this deposit.")
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("")
          setOpen(true)
        }}
        className="wallet-action group flex min-h-24 flex-col items-center justify-center gap-3 rounded-xl border border-lime-400/40 bg-lime-400 text-center text-sm font-semibold text-zinc-950 transition hover:-translate-y-0.5 hover:border-lime-300 hover:bg-lime-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 dark:border-lime-400/40 dark:bg-lime-400 dark:text-zinc-950 dark:hover:border-lime-300 dark:hover:bg-lime-300 dark:focus-visible:ring-offset-zinc-950"
      >
        <span className="grid size-11 place-items-center rounded-xl bg-black/10 text-zinc-950 transition group-hover:bg-black/15 dark:bg-black/10 dark:text-zinc-950 dark:group-hover:bg-black/15">
          <ArrowDownToLine aria-hidden="true" size={21} />
        </span>
        <span>Deposit</span>
      </button>

      <Dialog open={open} onOpenChange={(nextOpen) => {
        if (!busy) setOpen(nextOpen)
      }}>
        <DialogContent className="max-h-[min(90dvh,720px)] overflow-y-auto rounded-2xl border-white/10 bg-zinc-900 p-5 text-zinc-100 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-400 sm:p-7">
          <DialogHeader>
            <DialogTitle className="text-left text-xl font-bold tracking-tight">Add money to your wallet</DialogTitle>
            <DialogDescription className="text-left leading-6 text-zinc-300 dark:text-zinc-400">
              Choose an amount from ₹1 to ₹1,000. Payment is securely processed by Razorpay.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {presetAmounts.map((preset) => {
              const selected = amount === String(preset)
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setAmount(String(preset))
                    setError("")
                  }}
                  className={`min-h-11 rounded-xl border px-3 text-sm font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${
                    selected
                      ? "border-lime-400/40 bg-lime-400/10 text-zinc-100 dark:border-lime-400/40 dark:bg-lime-400/10 dark:text-lime-100"
                      : "border-white/10 bg-zinc-900 text-zinc-200 hover:border-white/10 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-white/10"
                  }`}
                >
                  ₹{preset.toLocaleString("en-IN")}
                </button>
              )
            })}
          </div>

          <div className="mt-5 space-y-2">
            <label htmlFor="wallet-deposit-amount" className="text-sm font-semibold text-zinc-200 dark:text-zinc-400">
              Custom amount
            </label>
            <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-zinc-400">₹</span>
              <input
                id="wallet-deposit-amount"
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                step={1}
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value)
                  setError("")
                }}
                aria-describedby="wallet-deposit-help"
                className="min-h-12 w-full rounded-xl border border-white/10 bg-zinc-900 pl-8 pr-3 text-base font-semibold tabular-nums text-zinc-100 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-lime-400/40"
              />
            </div>
            <p id="wallet-deposit-help" className="text-xs leading-5 text-zinc-300 dark:text-zinc-400">
              Whole rupees only. Minimum ₹1, maximum ₹1,000 per deposit.
            </p>
          </div>

          {error ? (
            <p role="alert" className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2.5 text-sm leading-5 text-rose-200 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-200">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void beginDeposit()}
            disabled={busy}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 text-sm font-bold text-zinc-950 transition hover:bg-lime-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
          >
            {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
            {busy ? "Opening secure checkout..." : "Continue to payment"}
          </button>
        </DialogContent>
      </Dialog>
    </>
  )
}
