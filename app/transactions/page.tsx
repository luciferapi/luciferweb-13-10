"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Ban, CircleAlert, LoaderCircle, Receipt } from "lucide-react"
import { Footer } from "@/components/footer"
import { formatPriceInr } from "@/lib/project-pricing"
import type { ProjectPurchase } from "@/lib/purchase-store"

function isProjectPurchaseList(value: unknown): value is ProjectPurchase[] {
  return Array.isArray(value) && value.every((item) =>
    typeof item === "object" &&
    item !== null &&
    "paymentId" in item && (item.paymentId === null || typeof item.paymentId === "string") &&
    "orderId" in item && typeof item.orderId === "string" &&
    "projectCode" in item && typeof item.projectCode === "string" &&
    "projectTitle" in item && typeof item.projectTitle === "string" &&
    "amountPaise" in item && typeof item.amountPaise === "number" && Number.isSafeInteger(item.amountPaise) &&
    "currency" in item && item.currency === "INR" &&
    "status" in item && ["pending", "paid", "cancelled", "expired", "failed"].includes(String(item.status)) &&
    "purchasedAt" in item && typeof item.purchasedAt === "string" && Number.isFinite(Date.parse(item.purchasedAt)),
  )
}

export default function TransactionHistoryPage() {
  const [transactions, setTransactions] = useState<ProjectPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingOrder, setCancellingOrder] = useState("")
  const [signedIn, setSignedIn] = useState(false)
  const [error, setError] = useState("")

  async function cancelPendingTransaction(orderId: string) {
    setCancellingOrder(orderId)
    setError("")
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, status: "cancelled" }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Could not cancel this transaction."
        throw new Error(message)
      }

      const historyResponse = await fetch("/api/transactions", { cache: "no-store" })
      const history: unknown = await historyResponse.json()
      if (
        !historyResponse.ok ||
        typeof history !== "object" ||
        history === null ||
        !("transactions" in history) ||
        !isProjectPurchaseList(history.transactions)
      ) {
        throw new Error("Transaction cancelled, but could not refresh your history.")
      }
      setTransactions(history.transactions)
    } catch (cancelError) {
      console.error("Could not cancel the pending project transaction.", cancelError)
      setError(cancelError instanceof Error ? cancelError.message : "Could not cancel this transaction.")
    } finally {
      setCancellingOrder("")
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/transactions", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result: unknown = await response.json()
        if (response.status === 401) {
          setSignedIn(false)
          return
        }
        if (!response.ok) {
          const message =
            typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "string"
              ? result.error
              : "Could not load transaction history."
          throw new Error(message)
        }
        if (
          typeof result !== "object" ||
          result === null ||
          !("transactions" in result) ||
          !isProjectPurchaseList(result.transactions)
        ) {
          throw new Error("The transaction history response was invalid.")
        }
        setSignedIn(true)
        setTransactions(result.transactions)
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === "AbortError") return
        console.error("Could not load transaction history.", loadError)
        setError(loadError instanceof Error ? loadError.message : "Could not load transaction history.")
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto min-h-[65vh] max-w-6xl px-5 pb-20 pt-36 sm:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300">{"// account / purchases"}</p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-[-0.04em] sm:text-5xl">Transaction history</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Your verified project purchases, amounts, payment references, and project details.</p>
          </div>
          <Link href="/projects" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold transition hover:border-cyan-400">
            Browse projects <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        {loading ? (
          <p role="status" className="mt-10 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Loading your transactions...</p>
        ) : error ? (
          <p role="alert" className="mt-10 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300"><CircleAlert aria-hidden="true" className="size-4 shrink-0" />{error}</p>
        ) : !signedIn ? (
          <div className="mt-10 rounded-2xl border border-border bg-card/60 p-6 sm:p-8">
            <h2 className="text-lg font-bold">Sign in to view your purchases</h2>
            <p className="mt-2 text-sm text-muted-foreground">Project purchases are linked to your account so your history stays private.</p>
            <Link href="/sign-in" className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">Sign in</Link>
          </div>
        ) : transactions.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center">
            <Receipt aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-bold">No purchases yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Verified project purchases will appear here with their amount and payment details.</p>
            <Link href="/projects" className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">Explore projects</Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {transactions.map((transaction) => (
              <li key={transaction.orderId} className="rounded-2xl border border-border bg-card/60 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className={`font-mono text-[10px] uppercase tracking-[0.2em] ${transaction.status === "paid" ? "text-emerald-700 dark:text-emerald-300" : transaction.status === "pending" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
                      {transaction.status}
                    </p>
                    <h2 className="mt-2 text-lg font-bold">{transaction.projectTitle}</h2>
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">Project code: {transaction.projectCode}</p>
                  </div>
                  <p className="shrink-0 text-xl font-black">{formatPriceInr(transaction.amountPaise)}</p>
                </div>
                <dl className="mt-5 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Purchased</dt>
                    <dd className="mt-1">{new Date(transaction.purchasedAt).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Payment ID</dt>
                    <dd className="mt-1 break-all font-mono text-xs">{transaction.paymentId ?? "Not paid yet"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Order ID</dt>
                    <dd className="mt-1 break-all font-mono text-xs">{transaction.orderId}</dd>
                  </div>
                  <div className="flex items-end">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/projects/${encodeURIComponent(transaction.projectCode)}`} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold transition hover:border-cyan-400">
                        View project details <ArrowUpRight aria-hidden="true" className="size-3.5" />
                      </Link>
                      {transaction.status === "pending" ? (
                        <button
                          type="button"
                          onClick={() => void cancelPendingTransaction(transaction.orderId)}
                          disabled={Boolean(cancellingOrder)}
                          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-500/30 px-3 text-xs font-semibold text-rose-700 transition hover:border-rose-500/60 hover:bg-rose-500/5 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300"
                        >
                          {cancellingOrder === transaction.orderId ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : <Ban aria-hidden="true" className="size-3.5" />}
                          Cancel transaction
                        </button>
                      ) : null}
                    </div>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Footer />
    </main>
  )
}
