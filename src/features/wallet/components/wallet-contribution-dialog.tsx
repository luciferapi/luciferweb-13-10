"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { LoaderCircle, Wallet } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatPriceInr } from "@/features/projects/server/project-pricing"

type WalletContributionDialogProps = {
  open: boolean
  totalPaise: number
  busy?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (walletAmountPaise: number) => void
}

function parseInrToPaise(value: string): number | null {
  if (!/^\d{1,10}(?:\.\d{0,2})?$/.test(value)) return null
  const [rupees, fraction = ""] = value.split(".")
  const paise = Number(`${rupees}${fraction.padEnd(2, "0")}`)
  return Number.isSafeInteger(paise) ? paise : null
}

function formatPaiseInput(amountPaise: number) {
  return (amountPaise / 100).toFixed(2)
}

export function WalletContributionDialog({
  open,
  totalPaise,
  busy = false,
  onOpenChange,
  onConfirm,
}: WalletContributionDialogProps) {
  const [balancePaise, setBalancePaise] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [signedIn, setSignedIn] = useState(true)
  const [error, setError] = useState("")
  const [amountText, setAmountText] = useState("0.00")

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoading(true)
    setSignedIn(true)
    setBalancePaise(null)
    setError("")
    setAmountText("0.00")

    void fetch("/api/wallet/balance", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result: unknown = await response.json().catch(() => null)
        if (response.status === 401) {
          setSignedIn(false)
          throw new Error("Sign in to see and use your wallet balance.")
        }
        if (!response.ok || typeof result !== "object" || result === null ||
          !("balancePaise" in result) || typeof result.balancePaise !== "number" ||
          !Number.isSafeInteger(result.balancePaise) || result.balancePaise < 0) {
          const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "Could not load your wallet balance."
          throw new Error(message)
        }
        setBalancePaise(result.balancePaise)
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === "AbortError") return
        setError(loadError instanceof Error ? loadError.message : "Could not load your wallet balance.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [open])

  const balanceCapPaise = Math.min(balancePaise ?? 0, totalPaise)
  const maxPartialPaise = Math.max(totalPaise - 100, 0)
  const maxSelectablePaise = balanceCapPaise === totalPaise
    ? totalPaise
    : Math.min(balanceCapPaise, maxPartialPaise)
  const selectedPaise = parseInrToPaise(amountText)
  const leavesInvalidRazorpayRemainder = selectedPaise !== null &&
    selectedPaise > 0 && selectedPaise < totalPaise && totalPaise - selectedPaise < 100
  const selectionInvalid = selectedPaise === null ||
    selectedPaise > balanceCapPaise ||
    leavesInvalidRazorpayRemainder
  const remainingPaise = selectedPaise === null ? totalPaise : totalPaise - selectedPaise
  const canContinue = !busy && !loading && balancePaise !== null && signedIn && !selectionInvalid

  function selectMaximum() {
    setAmountText(formatPaiseInput(maxSelectablePaise))
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!busy) onOpenChange(nextOpen)
    }}>
      <DialogContent className="max-w-md rounded-2xl border-slate-200 bg-white p-5 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Wallet aria-hidden="true" className="size-5 text-cyan-700 dark:text-cyan-300" />
            Choose wallet amount
          </DialogTitle>
          <DialogDescription>
            Apply any amount you choose from your wallet. The remaining amount is paid through Razorpay.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400">Purchase total</p>
              <p className="mt-1 font-mono text-sm font-bold tabular-nums">{formatPriceInr(totalPaise)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400">Available wallet</p>
              <p className="mt-1 font-mono text-sm font-bold tabular-nums">
                {loading ? "Loading…" : balancePaise === null ? "—" : formatPriceInr(balancePaise)}
              </p>
            </div>
          </div>

          <label className="block space-y-1.5 text-sm font-semibold" htmlFor="wallet-contribution-amount">
            Wallet amount (INR)
            <span className="flex gap-2">
              <input
                id="wallet-contribution-amount"
                type="number"
                inputMode="decimal"
                min="0"
                max={balanceCapPaise / 100}
                step="0.01"
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
                disabled={loading || !signedIn || balancePaise === null}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                type="button"
                onClick={selectMaximum}
                disabled={loading || !signedIn || balancePaise === null || maxSelectablePaise === 0}
                className="min-h-11 shrink-0 rounded-lg border border-slate-300 px-3 text-xs font-semibold transition hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
              >
                Use max
              </button>
            </span>
          </label>

          {balancePaise !== null && balanceCapPaise === 0 ? (
            <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">Your wallet has no available balance for this purchase.</p>
          ) : null}
          {balancePaise !== null && balancePaise > 0 && maxSelectablePaise === 0 && balanceCapPaise < totalPaise ? (
            <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">Razorpay requires at least ₹1.00 online unless your wallet covers the full price, so your current balance cannot be applied to this purchase yet.</p>
          ) : null}
          {selectedPaise !== null && selectedPaise > balanceCapPaise ? (
            <p className="text-xs leading-5 text-rose-700 dark:text-rose-300">The wallet amount cannot exceed your available balance or the purchase total.</p>
          ) : null}
          {leavesInvalidRazorpayRemainder ? (
            <p className="text-xs leading-5 text-rose-700 dark:text-rose-300">Leave at least ₹1.00 for Razorpay, or apply the full purchase price from your wallet.</p>
          ) : null}
          {balancePaise !== null && !leavesInvalidRazorpayRemainder && selectedPaise !== null && selectedPaise <= balanceCapPaise ? (
            <p className="rounded-lg bg-cyan-50 px-3 py-2 text-xs leading-5 text-cyan-950 dark:bg-cyan-950/40 dark:text-cyan-100">
              {remainingPaise === 0
                ? "The full purchase will be paid from your wallet."
                : `${formatPriceInr(remainingPaise)} will be paid through Razorpay.`}
            </p>
          ) : null}

          {error ? (
            <div className="space-y-2 text-sm text-rose-700 dark:text-rose-300" role="alert">
              <p>{error}</p>
              {!signedIn ? <Link href="/login" className="inline-flex font-semibold underline underline-offset-4">Sign in</Link> : null}
            </div>
          ) : null}

          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            A selected amount is reserved while payment is pending. If you leave without a result, cancel the order from your <Link href="/wallet#transaction-history" className="font-semibold underline underline-offset-2">wallet transaction history</Link> to release it.
          </p>

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold transition hover:border-slate-500 disabled:opacity-50 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => selectedPaise !== null && onConfirm(selectedPaise)}
              disabled={!canContinue}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan-700 px-4 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200"
            >
              {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
              {remainingPaise === 0 ? "Pay from wallet" : "Continue to checkout"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
