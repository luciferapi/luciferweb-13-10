"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, CircleDollarSign, LoaderCircle, RefreshCw, UsersRound } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { OwnerAnalytics } from "@/features/owner/server/owner-analytics"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function isAnalytics(value: unknown): value is OwnerAnalytics {
  if (!isRecord(value) || !isRecord(value.summary) || !isRecord(value.queues) ||
    !isRecord(value.period) || !Array.isArray(value.daily) || !Array.isArray(value.recentActions) ||
    typeof value.generatedAt !== "string" || typeof value.periodStart !== "string") return false
  const numericGroups = [value.summary, value.queues, value.period]
  return numericGroups.every((group) => Object.values(group).every(isNonNegativeInteger)) &&
    value.daily.every((row) => isRecord(row) && typeof row.date === "string" &&
      Object.entries(row).filter(([key]) => key !== "date").every(([, field]) => isNonNegativeInteger(field))) &&
    value.recentActions.every((row) => isRecord(row) && typeof row.action === "string" && typeof row.createdAt === "string")
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-IN").format(value)
}

function formatRupees(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100)
}

function formatChartRupees(rupees: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(rupees)
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`))
}

export function OwnerAnalyticsPanel() {
  const [analytics, setAnalytics] = useState<OwnerAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  const loadAnalytics = useCallback(async (signal?: AbortSignal, isRefresh = false) => {
    setError("")
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const response = await fetch("/api/owner/analytics", { cache: "no-store", signal })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok || !isAnalytics(result)) {
        const message = isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not load system analytics."
        throw new Error(message)
      }
      setAnalytics(result)
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return
      console.error("Could not load owner system analytics.", caught)
      setError(caught instanceof Error ? caught.message : "Could not load system analytics.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadAnalytics(controller.signal)
    return () => controller.abort()
  }, [loadAnalytics])

  if (loading) {
    return <p className="owner-analytics-loading"><LoaderCircle aria-hidden="true" size={18} className="animate-spin" /> Loading system analytics</p>
  }

  if (!analytics) {
    return (
      <section className="owner-analytics-error" role="alert">
        <p>{error || "System analytics are unavailable."}</p>
        <button type="button" className="owner-secondary-button" onClick={() => void loadAnalytics(undefined, true)} disabled={refreshing}>
          <RefreshCw aria-hidden="true" size={14} /> Try again
        </button>
      </section>
    )
  }

  const signups = analytics.daily.map((row) => ({ ...row, label: dayLabel(row.date) }))
  const money = analytics.daily.map((row) => ({
    ...row,
    label: dayLabel(row.date),
    productSales: row.productSalesPaise / 100,
    walletDeposits: row.walletDepositsPaise / 100,
    paidWithdrawals: row.paidWithdrawalsPaise / 100,
  }))
  const updatedAt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(analytics.generatedAt))

  return (
    <section className="owner-analytics" aria-labelledby="owner-analytics-heading">
      <header className="owner-analytics-header">
        <div>
          <p className="owner-analytics-period">LAST 30 DAYS · UTC</p>
          <h2 id="owner-analytics-heading">System overview</h2>
          <p>Live counts and recent activity across users, purchases, wallet, support, referrals, and platform content.</p>
        </div>
        <button type="button" className="owner-secondary-button" onClick={() => void loadAnalytics(undefined, true)} disabled={refreshing}>
          {refreshing ? <LoaderCircle aria-hidden="true" size={14} className="animate-spin" /> : <RefreshCw aria-hidden="true" size={14} />}
          Refresh
        </button>
      </header>

      {error ? <p className="owner-analytics-inline-error" role="alert">{error} Showing the last successfully loaded data.</p> : null}

      <div className="owner-analytics-kpis">
        <article className="owner-analytics-kpi">
          <span><UsersRound aria-hidden="true" size={16} /> Users</span>
          <strong>{formatCount(analytics.summary.totalUsers)}</strong>
          <small>{formatCount(analytics.period.signups)} new in 30 days · {formatCount(analytics.summary.blockedUsers)} blocked</small>
        </article>
        <article className="owner-analytics-kpi">
          <span><CircleDollarSign aria-hidden="true" size={16} /> Product sales</span>
          <strong>{formatRupees(analytics.period.productSalesPaise)}</strong>
          <small>Paid project and API orders in 30 days</small>
        </article>
        <article className="owner-analytics-kpi">
          <span><CircleDollarSign aria-hidden="true" size={16} /> Wallet deposits</span>
          <strong>{formatRupees(analytics.period.walletDepositsPaise)}</strong>
          <small>Paid deposits in 30 days</small>
        </article>
        <article className="owner-analytics-kpi">
          <span><Activity aria-hidden="true" size={16} /> Paid withdrawals</span>
          <strong>{formatRupees(analytics.period.paidWithdrawalsPaise)}</strong>
          <small>Processed payouts in 30 days</small>
        </article>
      </div>

      <div className="owner-analytics-chart-grid">
        <section className="owner-analytics-chart" aria-labelledby="analytics-growth-title">
          <div className="owner-analytics-section-heading">
            <div><h3 id="analytics-growth-title">User and service activity</h3><p>Daily signups, referrals, support tickets, and project requests</p></div>
          </div>
          <div className="owner-analytics-chart-canvas">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={signups} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="rgba(154,170,210,.12)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#9ba8c7", fontSize: 11 }} minTickGap={24} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#9ba8c7", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#101b38", border: "1px solid #273657", borderRadius: 10, color: "#edf2ff" }} />
                <Line type="monotone" dataKey="signups" name="Signups" stroke="#29a9ed" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="referrals" name="Referrals" stroke="#86d9d1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="supportTickets" name="Support tickets" stroke="#f4cb79" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="projectRequests" name="Project requests" stroke="#b15cf5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="owner-analytics-chart" aria-labelledby="analytics-money-title">
          <div className="owner-analytics-section-heading">
            <div><h3 id="analytics-money-title">Money movement</h3><p>Paid orders, wallet funding, and processed withdrawals</p></div>
          </div>
          <div className="owner-analytics-chart-canvas">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={money} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(154,170,210,.12)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#9ba8c7", fontSize: 11 }} minTickGap={24} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={formatChartRupees} tick={{ fill: "#9ba8c7", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => formatRupees(Number(value) * 100)}
                  contentStyle={{ background: "#101b38", border: "1px solid #273657", borderRadius: 10, color: "#edf2ff" }}
                />
                <Area type="monotone" dataKey="productSales" name="Product sales" stroke="#29a9ed" fill="#29a9ed" fillOpacity={0.12} strokeWidth={2} />
                <Area type="monotone" dataKey="walletDeposits" name="Wallet deposits" stroke="#86d9d1" fill="#86d9d1" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="paidWithdrawals" name="Paid withdrawals" stroke="#f4cb79" fill="#f4cb79" fillOpacity={0.08} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="owner-analytics-detail-grid">
        <section className="owner-analytics-detail" aria-labelledby="analytics-operations-title">
          <div className="owner-analytics-section-heading">
            <div><h3 id="analytics-operations-title">Operations</h3><p>Current platform totals and work queues</p></div>
          </div>
          <dl className="owner-analytics-rows">
            <div><dt>Active users</dt><dd>{formatCount(analytics.summary.activeUsers)}</dd></div>
            <div><dt>Wallet balance</dt><dd>{formatRupees(analytics.summary.walletBalancePaise)}</dd></div>
            <div><dt>Published projects</dt><dd>{formatCount(analytics.summary.publishedProjects)} / {formatCount(analytics.summary.totalProjects)}</dd></div>
            <div><dt>Enabled API endpoints</dt><dd>{formatCount(analytics.summary.enabledApis)}</dd></div>
            <div><dt>Project requests paid</dt><dd>{formatCount(analytics.summary.paidProjectRequests)} / {formatCount(analytics.summary.totalProjectRequests)}</dd></div>
            <div><dt>Pending project purchases</dt><dd>{formatCount(analytics.queues.projectPurchases)}</dd></div>
            <div><dt>Pending API purchases</dt><dd>{formatCount(analytics.queues.apiPurchases)}</dd></div>
            <div><dt>Pending wallet deposits</dt><dd>{formatCount(analytics.queues.walletDeposits)}</dd></div>
            <div><dt>Pending withdrawals</dt><dd>{formatCount(analytics.queues.withdrawals)}</dd></div>
          </dl>
        </section>

        <section className="owner-analytics-detail" aria-labelledby="analytics-support-title">
          <div className="owner-analytics-section-heading">
            <div><h3 id="analytics-support-title">Support, referrals, and administration</h3><p>Current workload and recent owner actions</p></div>
          </div>
          <dl className="owner-analytics-rows">
            <div><dt>Open support tickets</dt><dd>{formatCount(analytics.summary.openSupportTickets)}</dd></div>
            <div><dt>Forwarded to owner</dt><dd>{formatCount(analytics.summary.escalatedSupportTickets)}</dd></div>
            <div><dt>Pending referrals</dt><dd>{formatCount(analytics.queues.pendingReferrals)}</dd></div>
            <div><dt>All referrals</dt><dd>{formatCount(analytics.summary.totalReferrals)}</dd></div>
            <div><dt>Project requests, 30 days</dt><dd>{formatCount(analytics.period.projectRequests)}</dd></div>
            <div><dt>Support requests, 30 days</dt><dd>{formatCount(analytics.period.supportTickets)}</dd></div>
            <div><dt>Referral signups, 30 days</dt><dd>{formatCount(analytics.period.referrals)}</dd></div>
            <div><dt>Admin actions, 30 days</dt><dd>{formatCount(analytics.summary.totalAuditActions)}</dd></div>
          </dl>
          <div className="owner-analytics-audit">
            <h4>Recent owner actions</h4>
            {analytics.recentActions.length ? (
              <ul>
                {analytics.recentActions.map((item, index) => (
                  <li key={`${item.createdAt}-${item.action}-${index}`}>
                    <span>{item.action.replace(/[._]/g, " ")}</span>
                    <time dateTime={item.createdAt}>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</time>
                  </li>
                ))}
              </ul>
            ) : <p>No owner actions have been recorded.</p>}
          </div>
        </section>
      </div>
      <p className="owner-analytics-updated">Last updated {updatedAt}</p>
    </section>
  )
}
