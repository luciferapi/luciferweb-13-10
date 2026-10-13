"use client"

import { useCallback, useEffect, useState } from "react"
import { CircleDollarSign, LoaderCircle, RefreshCw, Wallet } from "lucide-react"
import { OwnerUsersPanel } from "@/features/owner/components/owner-users-panel"
import type { OwnerWalletActivity, OwnerWalletDashboard } from "@/features/owner/server/owner-wallet"

function isActivity(value: unknown): value is OwnerWalletActivity {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "string" &&
    "userId" in value && typeof value.userId === "string" &&
    "userUid" in value && typeof value.userUid === "string" &&
    "userName" in value && typeof value.userName === "string" &&
    "email" in value && (typeof value.email === "string" || value.email === null) &&
    "type" in value && ["deposit", "withdrawal", "credit", "debit"].includes(String(value.type)) &&
    "amountPaise" in value && typeof value.amountPaise === "number" && Number.isSafeInteger(value.amountPaise) &&
    "status" in value && typeof value.status === "string" &&
    "createdAt" in value && typeof value.createdAt === "string" &&
    "reference" in value && typeof value.reference === "string" &&
    "reason" in value && (typeof value.reason === "string" || value.reason === null)
}

function isDashboard(value: unknown): value is OwnerWalletDashboard {
  if (typeof value !== "object" || value === null || !("summary" in value) || !("activity" in value) || !Array.isArray(value.activity)) return false
  const summary = value.summary
  return typeof summary === "object" && summary !== null &&
    ["totalUsers", "activeUsers", "blockedUsers", "walletBalancePaise", "paidDepositsPaise", "pendingWithdrawalsPaise", "paidWithdrawalsPaise"]
      .every((key) => key in summary && typeof summary[key as keyof typeof summary] === "number" && Number.isSafeInteger(summary[key as keyof typeof summary])) &&
    value.activity.every(isActivity)
}

function formatInr(amountPaise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amountPaise / 100)
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function activityLabel(type: OwnerWalletActivity["type"]) {
  if (type === "deposit") return "Deposit"
  if (type === "withdrawal") return "Withdrawal"
  return type === "credit" ? "Owner credit" : "Owner debit"
}

function getErrorMessage(value: unknown) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
    ? value.error
    : "Could not load wallet management data."
}

export function OwnerWalletPanel() {
  const [data, setData] = useState<OwnerWalletDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async (signal?: AbortSignal) => {
    setError("")
    const response = await fetch("/api/owner/wallet", { cache: "no-store", signal })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok || !isDashboard(result)) throw new Error(getErrorMessage(result))
    setData(result)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return
        console.error("Could not load owner wallet management data.", caught)
        setError(caught instanceof Error ? caught.message : "Could not load wallet management data.")
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [load])

  async function refresh() {
    setLoading(true)
    try {
      await load()
    } catch (caught) {
      console.error("Could not refresh owner wallet management data.", caught)
      setError(caught instanceof Error ? caught.message : "Could not refresh wallet management data.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="owner-wallet-panel" aria-label="Wallet management">
      {error ? <p role="alert" className="owner-users-error">{error}</p> : null}
      <div className="owner-wallet-heading">
        <div>
          <h2>Wallet overview</h2>
          <p>Live balances are calculated from paid deposits, reserved/paid withdrawals, and audited owner adjustments.</p>
        </div>
        <button type="button" className="owner-users-refresh" onClick={() => void refresh()} disabled={loading}>
          {loading ? <LoaderCircle size={16} className="owner-users-spinner" /> : <RefreshCw size={16} />}
          Refresh
        </button>
      </div>

      <div className="owner-wallet-stats">
        <article className="is-primary">
          <span><Wallet size={16} aria-hidden="true" /> Total available wallet balance</span>
          <strong>{data ? formatInr(data.summary.walletBalancePaise) : loading ? "Loading…" : "—"}</strong>
          <small>{data ? `${data.summary.totalUsers.toLocaleString("en-IN")} registered users` : "Current user wallet totals"}</small>
        </article>
        <article>
          <span>Paid deposits</span>
          <strong>{data ? formatInr(data.summary.paidDepositsPaise) : loading ? "Loading…" : "—"}</strong>
          <small>Successfully paid in</small>
        </article>
        <article>
          <span>Pending withdrawals</span>
          <strong>{data ? formatInr(data.summary.pendingWithdrawalsPaise) : loading ? "Loading…" : "—"}</strong>
          <small>Reserved from available balances</small>
        </article>
        <article>
          <span>Paid withdrawals</span>
          <strong>{data ? formatInr(data.summary.paidWithdrawalsPaise) : loading ? "Loading…" : "—"}</strong>
          <small>Successfully paid out</small>
        </article>
      </div>

      <section className="owner-wallet-activity" aria-labelledby="owner-wallet-activity-title">
        <div className="owner-wallet-section-heading">
          <div>
            <h2 id="owner-wallet-activity-title">Recent wallet transactions</h2>
            <p>Deposits, withdrawals, and owner credit/debit adjustments.</p>
          </div>
          <span><CircleDollarSign size={15} aria-hidden="true" /> Latest activity</span>
        </div>
        <div className="owner-users-table-wrap">
          <table className="owner-wallet-table">
            <thead>
              <tr><th>User / UID</th><th>Transaction</th><th>Amount</th><th>Status</th><th>Reference / reason</th><th>Date</th></tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr><td colSpan={6} className="owner-users-empty"><LoaderCircle size={18} className="owner-users-spinner" /> Loading transactions…</td></tr>
              ) : data?.activity.length ? data.activity.map((activity) => {
                const isCredit = activity.type === "deposit" || activity.type === "credit"
                return (
                  <tr key={activity.id}>
                    <td>
                      <strong>{activity.userName}</strong>
                      <span>{activity.email ?? "No email"}</span>
                      <code title={activity.userUid}>{activity.userUid}</code>
                    </td>
                    <td>{activityLabel(activity.type)}</td>
                    <td className={isCredit ? "is-credit" : "is-debit"}>{isCredit ? "+" : "−"}{formatInr(activity.amountPaise)}</td>
                    <td><span className={`owner-wallet-status status-${activity.status}`}>{activity.status}</span></td>
                    <td>
                      <code title={activity.reference}>{activity.reference}</code>
                      {activity.reason ? <span className="owner-wallet-reason">{activity.reason}</span> : null}
                    </td>
                    <td>{formatDate(activity.createdAt)}</td>
                  </tr>
                )
              }) : (
                <tr><td colSpan={6} className="owner-users-empty">No wallet transactions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="owner-wallet-balances" aria-labelledby="owner-wallet-balances-title">
        <div className="owner-wallet-section-heading">
          <div>
            <h2 id="owner-wallet-balances-title">User balances and adjustments</h2>
            <p>Search users by UID, review balances, and make reasoned credit or debit adjustments.</p>
          </div>
        </div>
        <OwnerUsersPanel />
      </section>
    </section>
  )
}
