"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowUpRight,
  Ban,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  LoaderCircle,
  Receipt,
} from "lucide-react"
import { formatPriceInr } from "@/features/projects/server/project-pricing"
import type { ProjectPurchase } from "@/features/purchases/server/purchase-store"
import type { WalletDeposit } from "@/features/wallet/server/wallet-deposit-store"

function isProjectPurchaseList(value: unknown): value is ProjectPurchase[] {
  return Array.isArray(value) && value.every((item) =>
    typeof item === "object" &&
    item !== null &&
    "depositId" in item && typeof item.depositId === "string" && /^DEP[A-Z0-9]{13}$/.test(item.depositId) &&
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

function isWalletDepositList(value: unknown): value is WalletDeposit[] {
  return Array.isArray(value) && value.every((item) =>
    typeof item === "object" &&
    item !== null &&
    "depositId" in item && typeof item.depositId === "string" && /^DEP[A-Z0-9]{13}$/.test(item.depositId) &&
    "paymentId" in item && (item.paymentId === null || typeof item.paymentId === "string") &&
    "orderId" in item && typeof item.orderId === "string" &&
    "amountPaise" in item && typeof item.amountPaise === "number" && Number.isSafeInteger(item.amountPaise) &&
    "currency" in item && item.currency === "INR" &&
    "status" in item && ["pending", "paid", "cancelled", "expired", "failed"].includes(String(item.status)) &&
    "createdAt" in item && typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt)) &&
    "paidAt" in item && (item.paidAt === null || typeof item.paidAt === "string") &&
    "paymentDetails" in item && (
      item.paymentDetails === null ||
      (
        typeof item.paymentDetails === "object" &&
        item.paymentDetails !== null &&
        "status" in item.paymentDetails && typeof item.paymentDetails.status === "string" &&
        "captured" in item.paymentDetails && typeof item.paymentDetails.captured === "boolean" &&
        "method" in item.paymentDetails && (item.paymentDetails.method === null || typeof item.paymentDetails.method === "string") &&
        "international" in item.paymentDetails && (item.paymentDetails.international === null || typeof item.paymentDetails.international === "boolean") &&
        "bank" in item.paymentDetails && (item.paymentDetails.bank === null || typeof item.paymentDetails.bank === "string") &&
        "wallet" in item.paymentDetails && (item.paymentDetails.wallet === null || typeof item.paymentDetails.wallet === "string") &&
        "vpa" in item.paymentDetails && (item.paymentDetails.vpa === null || typeof item.paymentDetails.vpa === "string") &&
        "email" in item.paymentDetails && (item.paymentDetails.email === null || typeof item.paymentDetails.email === "string") &&
        "contact" in item.paymentDetails && (item.paymentDetails.contact === null || typeof item.paymentDetails.contact === "string") &&
        "feePaise" in item.paymentDetails && (item.paymentDetails.feePaise === null || typeof item.paymentDetails.feePaise === "number") &&
        "taxPaise" in item.paymentDetails && (item.paymentDetails.taxPaise === null || typeof item.paymentDetails.taxPaise === "number") &&
        "providerCreatedAt" in item.paymentDetails && (item.paymentDetails.providerCreatedAt === null || typeof item.paymentDetails.providerCreatedAt === "string") &&
        "description" in item.paymentDetails && (item.paymentDetails.description === null || typeof item.paymentDetails.description === "string") &&
        "reference" in item.paymentDetails && (item.paymentDetails.reference === null || typeof item.paymentDetails.reference === "string") &&
        "cardNetwork" in item.paymentDetails && (item.paymentDetails.cardNetwork === null || typeof item.paymentDetails.cardNetwork === "string") &&
        "cardLast4" in item.paymentDetails && (item.paymentDetails.cardLast4 === null || typeof item.paymentDetails.cardLast4 === "string")
      )
    ),
  )
}

function formatPurchaseDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function formatPaymentMethod(value: string | null) {
  if (!value) return null
  return value
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

const statusStyles: Record<ProjectPurchase["status"], string> = {
  paid: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-900",
  pending: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-900",
  cancelled: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
  expired: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
  failed: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:ring-rose-900",
}

const statusIconStyles: Record<ProjectPurchase["status"], string> = {
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  expired: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  failed: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
}

export function WalletTransactionHistory() {
  const searchParams = useSearchParams()
  const requestedFilter = searchParams.get("history")
  const activeFilter = requestedFilter === "deposit" || requestedFilter === "withdraw"
    ? requestedFilter
    : "all"
  const [transactions, setTransactions] = useState<ProjectPurchase[]>([])
  const [deposits, setDeposits] = useState<WalletDeposit[]>([])
  const [loading, setLoading] = useState(true)
  const [depositLoading, setDepositLoading] = useState(false)
  const [signedIn, setSignedIn] = useState(true)
  const [cancellingOrder, setCancellingOrder] = useState("")
  const [error, setError] = useState("")
  const [depositError, setDepositError] = useState("")

  async function loadTransactions(signal?: AbortSignal) {
    const response = await fetch("/api/transactions", { cache: "no-store", signal })
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
  }

  useEffect(() => {
    const controller = new AbortController()
    void loadTransactions(controller.signal)
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === "AbortError") return
        console.error("Could not load transaction history.", loadError)
        setError(loadError instanceof Error ? loadError.message : "Could not load transaction history.")
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (activeFilter !== "deposit") return
    const controller = new AbortController()
    async function loadDeposits() {
      setDepositLoading(true)
      setDepositError("")
      try {
        const response = await fetch("/api/wallet/deposits", { cache: "no-store", signal: controller.signal })
        const result: unknown = await response.json()
        if (response.status === 401) {
          setSignedIn(false)
          return
        }
        if (!response.ok) throw new Error(
          typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "Could not load deposit history.",
        )
        if (typeof result !== "object" || result === null || !("deposits" in result) || !isWalletDepositList(result.deposits)) {
          throw new Error("The deposit history response was invalid.")
        }
        setSignedIn(true)
        setDeposits(result.deposits)
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") return
        console.error("Could not load deposit history.", loadError)
        setDepositError(loadError instanceof Error ? loadError.message : "Could not load deposit history.")
      } finally {
        if (!controller.signal.aborted) setDepositLoading(false)
      }
    }

    const refreshDeposits = () => void loadDeposits()
    void loadDeposits()
    window.addEventListener("wallet-deposit-updated", refreshDeposits)
    return () => {
      controller.abort()
      window.removeEventListener("wallet-deposit-updated", refreshDeposits)
    }
  }, [activeFilter])

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
      await loadTransactions()
    } catch (cancelError) {
      console.error("Could not cancel the pending project transaction.", cancelError)
      setError(cancelError instanceof Error ? cancelError.message : "Could not cancel this transaction.")
    } finally {
      setCancellingOrder("")
    }
  }

  const paidTransactions = transactions.filter((transaction) => transaction.status === "paid")
  const paidTotalPaise = paidTransactions.reduce((total, transaction) => total + transaction.amountPaise, 0)
  const visibleTransactions = activeFilter === "all" ? transactions : []
  const filterLoading = activeFilter === "all" ? loading : activeFilter === "deposit" ? depositLoading : false
  const filterError = activeFilter === "all" ? error : activeFilter === "deposit" ? depositError : ""
  const filteredItemCount = activeFilter === "all" ? visibleTransactions.length : activeFilter === "deposit" ? deposits.length : 1
  const filterOptions = [
    { label: "All", value: "all", href: "/wallet#transaction-history" },
    { label: "Deposits", value: "deposit", href: "/wallet?history=deposit#transaction-history" },
    { label: "Withdrawals", value: "withdraw", href: "/wallet?history=withdraw#transaction-history" },
  ] as const

  return (
    <section id="transaction-history" aria-labelledby="transaction-history-heading" className="mt-14 scroll-mt-28 border-t border-slate-200/80 pt-9 dark:border-slate-800 sm:mt-16 sm:pt-11">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-800">
        <div>
          <h2 id="transaction-history-heading" className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Transaction history
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Review project purchases and wallet deposits. Cash withdrawals are coming soon.
          </p>
        </div>
        <Link
          href="/projects"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-800 transition hover:border-blue-300 hover:text-blue-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-700 dark:hover:text-blue-300 dark:focus-visible:ring-offset-slate-950"
        >
          Browse projects <ArrowUpRight aria-hidden="true" className="size-4" />
        </Link>
      </header>

      <nav aria-label="Filter transaction history" className="mt-5 flex flex-wrap gap-2">
        {filterOptions.map(({ label, value, href }) => (
          <Link
            key={value}
            href={href}
            aria-current={activeFilter === value ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-lg border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
              activeFilter === value
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:text-blue-300"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {activeFilter === "all" && signedIn && !loading && !error ? (
        <section aria-label="Payment summary" className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-[0_3px_14px_rgba(37,99,235,0.04)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-5">
          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Total paid</p>
            <p className="mt-1 font-mono text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">{formatPriceInr(paidTotalPaise)}</p>
          </div>
          <div className="border-l border-slate-200 pl-4 dark:border-slate-700 sm:pl-6">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Completed purchases</p>
            <p className="mt-1 font-mono text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">{paidTransactions.length}</p>
          </div>
        </section>
      ) : null}

      {filterLoading ? (
        <div role="status" className="mt-5 space-y-3" aria-label="Loading transactions">
          <span className="sr-only">Loading your transactions...</span>
          {[0, 1, 2].map((item) => (
            <div key={item} aria-hidden="true" className="h-24 rounded-2xl bg-white/80 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800" />
          ))}
        </div>
      ) : filterError ? (
        <p role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <span>{filterError}</span>
        </p>
      ) : !signedIn ? (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <Receipt aria-hidden="true" className="size-6 text-blue-700 dark:text-blue-300" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Sign in to view your purchases</h3>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">
            Your project payments are linked to your account and visible only to you.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
          >
            Sign in
          </Link>
        </section>
      ) : filteredItemCount === 0 ? (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <Receipt aria-hidden="true" className="size-6 text-blue-700 dark:text-blue-300" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
            {activeFilter === "deposit"
              ? "No deposits yet"
              : activeFilter === "withdraw"
                ? "No withdrawals yet"
                : "No purchases yet"}
          </h3>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">
            {activeFilter === "deposit"
              ? "Your wallet deposit payments will appear here after checkout."
              : activeFilter === "withdraw"
                ? "Withdrawal requests you submit will appear here with their review status."
                : "Project payments will appear here with their status and payment references."}
          </p>
          {activeFilter === "all" ? (
            <Link
              href="/projects"
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
            >
              Explore projects <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </section>
      ) : activeFilter === "deposit" ? (
        <section aria-label="Wallet deposits" className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <ul>
            {deposits.map((deposit, index) => {
              const label = deposit.status.charAt(0).toUpperCase() + deposit.status.slice(1)
              const StatusIcon = deposit.status === "paid" ? Check : deposit.status === "pending" ? Clock3 : CircleAlert
              return (
                <li key={deposit.orderId} className={index > 0 ? "border-t border-slate-200 dark:border-slate-800" : ""}>
                  <article className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl ${statusIconStyles[deposit.status]}`}>
                        <StatusIcon aria-hidden="true" size={18} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white sm:text-base">Wallet deposit</h3>
                          <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 text-[11px] font-semibold ring-1 ring-inset ${statusStyles[deposit.status]}`}>
                            {label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{formatPurchaseDate(deposit.paidAt ?? deposit.createdAt)}</p>
                        <p className="mt-1 truncate font-mono text-[11px] text-slate-600 dark:text-slate-400">Deposit ID {deposit.depositId}</p>
                        {deposit.paymentId ? (
                          <p className="mt-1 truncate font-mono text-[11px] text-slate-600 dark:text-slate-400">Razorpay payment ID {deposit.paymentId}</p>
                        ) : null}
                      </div>
                    </div>
                    <p className="ml-[52px] shrink-0 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white sm:ml-0">
                      +{formatPriceInr(deposit.amountPaise)}
                    </p>
                  </article>
                  {deposit.paymentDetails ? (
                    <details className="mx-4 mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/60 sm:mx-5">
                      <summary className="cursor-pointer font-semibold text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-100">
                        Razorpay payment details
                      </summary>
                      <dl className="mt-3 grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2">
                        {[
                          ["Payment method", formatPaymentMethod(deposit.paymentDetails.method)],
                          ["Payment status", deposit.paymentDetails.status],
                          ["Order ID", deposit.orderId],
                          ["Payment ID", deposit.paymentId],
                          ["Provider reference", deposit.paymentDetails.reference],
                          ["Bank", deposit.paymentDetails.bank],
                          ["Wallet", deposit.paymentDetails.wallet],
                          ["UPI ID", deposit.paymentDetails.vpa],
                          ["Card", deposit.paymentDetails.cardLast4
                            ? `${deposit.paymentDetails.cardNetwork ?? "Card"} ending ${deposit.paymentDetails.cardLast4}`
                            : null],
                          ["Email", deposit.paymentDetails.email],
                          ["Contact", deposit.paymentDetails.contact],
                          ["Payment fee", deposit.paymentDetails.feePaise === null
                            ? null
                            : formatPriceInr(deposit.paymentDetails.feePaise)],
                          ["Tax", deposit.paymentDetails.taxPaise === null
                            ? null
                            : formatPriceInr(deposit.paymentDetails.taxPaise)],
                          ["Payment created", deposit.paymentDetails.providerCreatedAt
                            ? formatPurchaseDate(deposit.paymentDetails.providerCreatedAt)
                            : null],
                          ["Description", deposit.paymentDetails.description],
                          ["International payment", deposit.paymentDetails.international === null
                            ? null
                            : deposit.paymentDetails.international ? "Yes" : "No"],
                          ["Captured", deposit.paymentDetails.captured ? "Yes" : "No"],
                        ].map(([label, value]) => value ? (
                          <div key={label}>
                            <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                            <dd className="mt-1 break-all font-medium text-slate-900 dark:text-slate-100">{value}</dd>
                          </div>
                        ) : null)}
                      </dl>
                    </details>
                  ) : deposit.status === "paid" ? (
                    <p className="mx-4 mb-4 text-xs text-slate-500 dark:text-slate-400 sm:mx-5">
                      Razorpay payment details are not available for this deposit.
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : activeFilter === "withdraw" ? (
        <section aria-label="Withdrawals coming soon" className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 sm:p-8">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Cash withdrawals are coming soon</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Your wallet balance remains available for project and paid API purchases.
          </p>
        </section>
      ) : (
        <section aria-label="Purchases" className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_3px_14px_rgba(37,99,235,0.04)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <ul>
            {visibleTransactions.map((transaction, index) => {
              const statusLabel = transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)
              const StatusIcon = transaction.status === "paid" ? Check : transaction.status === "pending" ? Clock3 : CircleAlert

              return (
                <li key={transaction.orderId} className={index > 0 ? "border-t border-slate-200 dark:border-slate-800" : ""}>
                  <article className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl ${statusIconStyles[transaction.status]}`}>
                          <StatusIcon aria-hidden="true" size={18} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="max-w-full truncate text-sm font-semibold text-slate-900 dark:text-white sm:text-base">{transaction.projectTitle}</h3>
                            <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 text-[11px] font-semibold ring-1 ring-inset ${statusStyles[transaction.status]}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{formatPurchaseDate(transaction.purchasedAt)}</p>
                          <p className="mt-1 truncate font-mono text-[11px] text-slate-600 dark:text-slate-400">Project {transaction.projectCode}</p>
                        </div>
                      </div>
                      <p className="ml-[52px] shrink-0 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white sm:ml-0">
                        {formatPriceInr(transaction.amountPaise)}
                      </p>
                    </div>

                    <details className="group mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-blue-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:text-blue-300 dark:focus-visible:ring-offset-slate-900 [&::-webkit-details-marker]:hidden">
                        Payment details
                        <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" />
                      </summary>
                      <dl className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800 sm:grid-cols-2 sm:p-4">
                        <div className="min-w-0">
                          <dt className="font-medium text-slate-600 dark:text-slate-300">Payment ID</dt>
                          <dd className="mt-1 break-all font-mono text-slate-800 dark:text-slate-100">{transaction.paymentId ?? "Not paid yet"}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="font-medium text-slate-600 dark:text-slate-300">Order ID</dt>
                          <dd className="mt-1 break-all font-mono text-slate-800 dark:text-slate-100">{transaction.orderId}</dd>
                        </div>
                      </dl>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/projects/${encodeURIComponent(transaction.projectCode)}`}
                          className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 transition hover:border-blue-300 hover:text-blue-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-700 dark:hover:text-blue-300 dark:focus-visible:ring-offset-slate-900"
                        >
                          View project <ArrowUpRight aria-hidden="true" className="size-3.5" />
                        </Link>
                        {transaction.status === "pending" ? (
                          <button
                            type="button"
                            onClick={() => void cancelPendingTransaction(transaction.orderId)}
                            disabled={Boolean(cancellingOrder)}
                            className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-800 transition hover:bg-rose-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/50 dark:focus-visible:ring-offset-slate-900"
                          >
                            {cancellingOrder === transaction.orderId ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : <Ban aria-hidden="true" className="size-3.5" />}
                            {cancellingOrder === transaction.orderId ? "Cancelling..." : "Cancel transaction"}
                          </button>
                        ) : null}
                      </div>
                    </details>
                  </article>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </section>
  )
}
