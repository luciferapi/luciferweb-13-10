"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowUpFromLine, CircleAlert, LoaderCircle } from "lucide-react"
import type { WithdrawalMethodSummary } from "@/features/wallet/server/withdrawal-method-store"

const amountOptions = [50, 100, 250, 500, 1000, 1500]

function getErrorMessage(value: unknown, fallback: string) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
    ? value.error
    : fallback
}

export function WalletWithdrawalForm({
  availableBalancePaise,
  remainingRequests,
  withdrawalMethod,
}: {
  availableBalancePaise: number
  remainingRequests: number
  withdrawalMethod: WithdrawalMethodSummary | null
}) {
  const router = useRouter()
  const [amount, setAmount] = useState("50")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amountRupees = Number(amount)
    if (!Number.isInteger(amountRupees) || amountRupees < 50 || amountRupees > 1500) {
      setError("Enter a whole-rupee amount from ₹50 to ₹1,500.")
      return
    }
    if (amountRupees * 100 > availableBalancePaise) {
      setError("The amount exceeds your available wallet balance.")
      return
    }
    if (remainingRequests < 1) {
      setError("You have reached the daily limit of four withdrawal requests.")
      return
    }
    if (!withdrawalMethod) {
      setError("Save a UPI ID or bank account in Settings before requesting a withdrawal.")
      return
    }

    setBusy(true)
    setError("")
    setSuccess("")
    try {
      const response = await fetch("/api/wallet/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountRupees }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        if (
          typeof result === "object" &&
          result !== null &&
          "withdrawal_id" in result &&
          typeof result.withdrawal_id === "string"
        ) {
          window.dispatchEvent(new Event("wallet-withdrawal-updated"))
          router.refresh()
        }
        throw new Error(getErrorMessage(result, "Could not submit the withdrawal request."))
      }
      if (
        typeof result !== "object" ||
        result === null ||
        !("success" in result) ||
        result.success !== true ||
        !("withdrawal_id" in result) ||
        typeof result.withdrawal_id !== "string"
      ) {
        throw new Error("The server returned an invalid withdrawal confirmation.")
      }

      setSuccess(`Request submitted. Withdrawal ID: ${result.withdrawal_id}`)
      window.dispatchEvent(new Event("wallet-withdrawal-updated"))
      router.refresh()
    } catch (requestError) {
      console.error("Could not submit the wallet withdrawal request.", requestError)
      setError(requestError instanceof Error ? requestError.message : "Could not submit the withdrawal request.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(event) => void submitRequest(event)}
      className="mt-7 space-y-6 rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-zinc-900 dark:shadow-none sm:p-7"
    >
      <section aria-label="Withdrawal limits" className="grid grid-cols-2 gap-4 border-b border-white/10 pb-5 dark:border-white/10">
        <div>
          <p className="text-xs font-medium text-zinc-300 dark:text-zinc-400">Available balance</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-zinc-100 dark:text-zinc-50">
            {(availableBalancePaise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
          </p>
        </div>
        <div className="border-l border-white/10 pl-4 dark:border-white/10">
          <p className="text-xs font-medium text-zinc-300 dark:text-zinc-400">Requests left today</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-zinc-100 dark:text-zinc-50">{remainingRequests} of 4</p>
        </div>
      </section>

      <div className="space-y-3">
        <div>
          <label htmlFor="withdrawal-amount" className="text-sm font-semibold text-zinc-100 dark:text-zinc-50">
            Withdrawal amount
          </label>
          <p id="withdrawal-amount-help" className="mt-1 text-xs leading-5 text-zinc-300 dark:text-zinc-400">
            Choose a preset or enter a whole-rupee amount from ₹50 to ₹1,500.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {amountOptions.map((preset) => {
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
                className={`min-h-11 rounded-xl border px-2 text-sm font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${
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
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-zinc-400">₹</span>
          <input
            id="withdrawal-amount"
            type="number"
            inputMode="numeric"
            min={50}
            max={1500}
            step={1}
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value)
              setError("")
            }}
            aria-describedby="withdrawal-amount-help"
            className="min-h-12 w-full rounded-xl border border-white/10 bg-zinc-900 pl-8 pr-3 text-base font-semibold tabular-nums text-zinc-100 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-lime-400/40"
          />
        </div>
      </div>

      <section aria-label="Payout method" className="rounded-xl border border-white/10 bg-zinc-900 p-4 dark:border-white/10 dark:bg-zinc-900/60">
        <h2 className="text-sm font-semibold text-zinc-100 dark:text-zinc-50">Saved payout method</h2>
        {withdrawalMethod ? (
          <p className="mt-2 text-sm leading-6 text-zinc-300 dark:text-zinc-400">
            {withdrawalMethod.method === "upi" ? "UPI" : "Bank transfer"} to {withdrawalMethod.accountHolder}, {withdrawalMethod.destination}
          </p>
        ) : (
          <div>
            <p className="mt-2 text-sm leading-6 text-zinc-300 dark:text-zinc-400">Add your UPI ID or bank account in Settings before submitting.</p>
            <Link href="/settings" className="mt-2 inline-flex font-semibold text-lime-300 underline underline-offset-4 dark:text-lime-300">
              Open Settings
            </Link>
          </div>
        )}
      </section>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm leading-5 text-rose-200 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-200">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
      {success ? (
        <p role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm leading-5 text-emerald-200 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
          {success}. The owner will review your request.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !withdrawalMethod || remainingRequests < 1 || availableBalancePaise < 5000}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 text-sm font-bold text-zinc-950 transition hover:bg-lime-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
      >
        {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <ArrowUpFromLine aria-hidden="true" className="size-4" />}
        {busy ? "Submitting request..." : "Submit withdrawal request"}
      </button>
      <p className="text-center text-xs leading-5 text-zinc-300 dark:text-zinc-400">
        Your request will be sent to the owner for manual review.
      </p>
    </form>
  )
}
