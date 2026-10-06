"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowUpFromLine, CircleAlert, LoaderCircle } from "lucide-react"
import type { WithdrawalMethodSummary } from "@/lib/withdrawal-method-store"

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
      className="mt-7 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-7"
    >
      <section aria-label="Withdrawal limits" className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-5 dark:border-slate-700">
        <div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Available balance</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950 dark:text-white">
            {(availableBalancePaise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
          </p>
        </div>
        <div className="border-l border-slate-200 pl-4 dark:border-slate-700">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Requests left today</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950 dark:text-white">{remainingRequests} of 4</p>
        </div>
      </section>

      <div className="space-y-3">
        <div>
          <label htmlFor="withdrawal-amount" className="text-sm font-semibold text-slate-900 dark:text-white">
            Withdrawal amount
          </label>
          <p id="withdrawal-amount-help" className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
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
                className={`min-h-11 rounded-xl border px-2 text-sm font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                  selected
                    ? "border-cyan-400 bg-cyan-50 text-slate-950 dark:border-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-100"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600"
                }`}
              >
                ₹{preset.toLocaleString("en-IN")}
              </button>
            )
          })}
        </div>
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-slate-500">₹</span>
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
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 text-base font-semibold tabular-nums text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-cyan-400"
          />
        </div>
      </div>

      <section aria-label="Payout method" className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Saved payout method</h2>
        {withdrawalMethod ? (
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
            {withdrawalMethod.method === "upi" ? "UPI" : "Bank transfer"} to {withdrawalMethod.accountHolder}, {withdrawalMethod.destination}
          </p>
        ) : (
          <div>
            <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">Add your UPI ID or bank account in Settings before submitting.</p>
            <Link href="/settings" className="mt-2 inline-flex font-semibold text-blue-700 underline underline-offset-4 dark:text-cyan-300">
              Open Settings
            </Link>
          </div>
        )}
      </section>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-5 text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
      {success ? (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-5 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
          {success}. The owner will review your request.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !withdrawalMethod || remainingRequests < 1 || availableBalancePaise < 5000}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
      >
        {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <ArrowUpFromLine aria-hidden="true" className="size-4" />}
        {busy ? "Submitting request..." : "Submit withdrawal request"}
      </button>
      <p className="text-center text-xs leading-5 text-slate-600 dark:text-slate-400">
        Your request will be sent to the owner for manual review.
      </p>
    </form>
  )
}
