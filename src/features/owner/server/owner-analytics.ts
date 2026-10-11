import "server-only"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const PAGE_SIZE = 1000
const DAY_COUNT = 30

type CountResult = { count: number | null; error: { message: string } | null }
type RowPage<T> = { data: T[] | null; error: { message: string } | null }
type SignupRow = { created_at: string }
type MoneyRow = { amount_paise: number | string; purchased_at?: string; paid_at?: string | null; processed_at?: string | null }
type ActivityRow = { created_at: string }
type AuditRow = { action: string; created_at: string }

export type OwnerAnalyticsDaily = {
  date: string
  signups: number
  referrals: number
  supportTickets: number
  projectRequests: number
  productSalesPaise: number
  walletDepositsPaise: number
  paidWithdrawalsPaise: number
}

export type OwnerAnalytics = {
  generatedAt: string
  periodStart: string
  summary: {
    totalUsers: number
    activeUsers: number
    blockedUsers: number
    walletBalancePaise: number
    totalProjects: number
    publishedProjects: number
    enabledApis: number
    totalProjectRequests: number
    paidProjectRequests: number
    totalReferrals: number
    openSupportTickets: number
    escalatedSupportTickets: number
    totalAuditActions: number
  }
  queues: {
    projectPurchases: number
    apiPurchases: number
    walletDeposits: number
    withdrawals: number
    pendingReferrals: number
  }
  period: {
    signups: number
    productSalesPaise: number
    walletDepositsPaise: number
    paidWithdrawalsPaise: number
    supportTickets: number
    projectRequests: number
    referrals: number
  }
  daily: OwnerAnalyticsDaily[]
  recentActions: { action: string; createdAt: string }[]
}

function getAdminClient() {
  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase admin access is not configured.")
  return client
}

async function exactCount(query: PromiseLike<CountResult>) {
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function readAllRows<T>(
  requestPage: (from: number, to: number) => PromiseLike<RowPage<T>>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await requestPage(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

function countValue(value: number | string) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error("Analytics contains an invalid transaction amount.")
  }
  return number
}

function addAmount(current: number, amount: number | string) {
  const total = current + countValue(amount)
  if (!Number.isSafeInteger(total)) throw new Error("Analytics transaction totals exceed the supported range.")
  return total
}

function toIsoString(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error("Analytics contains an invalid date.")
  return date.toISOString()
}

function dayKey(value: string) {
  return toIsoString(value).slice(0, 10)
}

export async function getOwnerAnalytics(): Promise<OwnerAnalytics> {
  const client = getAdminClient()
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const firstDay = new Date(today)
  firstDay.setUTCDate(firstDay.getUTCDate() - (DAY_COUNT - 1))
  const periodStart = firstDay.toISOString()

  const dailyByDate = new Map<string, OwnerAnalyticsDaily>()
  for (let offset = 0; offset < DAY_COUNT; offset += 1) {
    const date = new Date(firstDay)
    date.setUTCDate(date.getUTCDate() + offset)
    const key = date.toISOString().slice(0, 10)
    dailyByDate.set(key, {
      date: key,
      signups: 0,
      referrals: 0,
      supportTickets: 0,
      projectRequests: 0,
      productSalesPaise: 0,
      walletDepositsPaise: 0,
      paidWithdrawalsPaise: 0,
    })
  }

  const statusCount = (table: string, status: string) =>
    exactCount(client.from(table).select("*", { count: "exact", head: true }).eq("status", status))
  const totalCount = (table: string) =>
    exactCount(client.from(table).select("*", { count: "exact", head: true }))

  const [
    walletResult,
    publishedProjects,
    totalProjects,
    enabledApis,
    totalProjectRequests,
    paidProjectRequests,
    totalReferrals,
    pendingReferrals,
    openTickets,
    escalatedTickets,
    totalAuditActions,
    pendingProjectPurchases,
    pendingApiPurchases,
    pendingDeposits,
    pendingWithdrawals,
    signupRows,
    projectSalesRows,
    apiSalesRows,
    depositRows,
    withdrawalRows,
    referralRows,
    supportRows,
    projectRequestRows,
    recentActionRows,
  ] = await Promise.all([
    client.rpc("owner_wallet_summary"),
    exactCount(client.from("projects").select("*", { count: "exact", head: true }).eq("is_published", true)),
    totalCount("projects"),
    exactCount(client.from("api_endpoints").select("*", { count: "exact", head: true }).eq("is_enabled", true)),
    totalCount("project_requests"),
    exactCount(client.from("project_requests").select("*", { count: "exact", head: true }).eq("payment_status", "paid")),
    totalCount("referrals"),
    statusCount("referrals", "pending"),
    exactCount(client.from("support_tickets").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress", "waiting_on_user"])),
    exactCount(client.from("support_tickets").select("*", { count: "exact", head: true }).not("escalated_at", "is", null)),
    exactCount(client.from("owner_audit_logs").select("*", { count: "exact", head: true }).gte("created_at", periodStart)),
    statusCount("project_purchases", "pending"),
    statusCount("api_endpoint_purchases", "pending"),
    statusCount("wallet_deposits", "pending"),
    statusCount("wallet_withdrawal_requests", "pending"),
    readAllRows<SignupRow>((from, to) =>
      client.from("auth_users").select("created_at").gte("created_at", periodStart).range(from, to)),
    readAllRows<MoneyRow>((from, to) =>
      client.from("project_purchases").select("amount_paise, purchased_at").eq("status", "paid").gte("purchased_at", periodStart).range(from, to)),
    readAllRows<MoneyRow>((from, to) =>
      client.from("api_endpoint_purchases").select("amount_paise, purchased_at").eq("status", "paid").gte("purchased_at", periodStart).range(from, to)),
    readAllRows<MoneyRow>((from, to) =>
      client.from("wallet_deposits").select("amount_paise, paid_at").eq("status", "paid").gte("paid_at", periodStart).range(from, to)),
    readAllRows<MoneyRow>((from, to) =>
      client.from("wallet_withdrawal_requests").select("amount_paise, processed_at").eq("status", "paid").gte("processed_at", periodStart).range(from, to)),
    readAllRows<ActivityRow>((from, to) =>
      client.from("referrals").select("created_at").gte("created_at", periodStart).range(from, to)),
    readAllRows<ActivityRow>((from, to) =>
      client.from("support_tickets").select("created_at").gte("created_at", periodStart).range(from, to)),
    readAllRows<ActivityRow>((from, to) =>
      client.from("project_requests").select("created_at").gte("created_at", periodStart).range(from, to)),
    client.from("owner_audit_logs").select("action, created_at").order("created_at", { ascending: false }).limit(8),
  ])

  if (walletResult.error) throw new Error(walletResult.error.message)
  if (recentActionRows.error) throw new Error(recentActionRows.error.message)
  const wallet = Array.isArray(walletResult.data) ? walletResult.data[0] : walletResult.data
  if (!wallet) throw new Error("The wallet summary query returned no result.")

  const addDailyCount = (rows: ActivityRow[], key: "referrals" | "supportTickets" | "projectRequests") => {
    for (const row of rows) {
      const day = dailyByDate.get(dayKey(row.created_at))
      if (day) day[key] += 1
    }
  }
  const addDailyMoney = (
    rows: MoneyRow[],
    dateField: "purchased_at" | "paid_at" | "processed_at",
    valueField: "productSalesPaise" | "walletDepositsPaise" | "paidWithdrawalsPaise",
  ) => {
    for (const row of rows) {
      const date = row[dateField]
      if (!date) continue
      const day = dailyByDate.get(dayKey(date))
      if (day) day[valueField] = addAmount(day[valueField], row.amount_paise)
    }
  }

  for (const row of signupRows) {
    const day = dailyByDate.get(dayKey(row.created_at))
    if (day) day.signups += 1
  }
  addDailyCount(referralRows, "referrals")
  addDailyCount(supportRows, "supportTickets")
  addDailyCount(projectRequestRows, "projectRequests")
  addDailyMoney([...projectSalesRows, ...apiSalesRows], "purchased_at", "productSalesPaise")
  addDailyMoney(depositRows, "paid_at", "walletDepositsPaise")
  addDailyMoney(withdrawalRows, "processed_at", "paidWithdrawalsPaise")

  const daily = [...dailyByDate.values()]
  const sumDaily = (field: "signups" | "referrals" | "supportTickets" | "projectRequests") =>
    daily.reduce((total, row) => total + row[field], 0)
  const sumDailyAmount = (field: "productSalesPaise" | "walletDepositsPaise" | "paidWithdrawalsPaise") =>
    daily.reduce((total, row) => addAmount(total, row[field]), 0)

  return {
    generatedAt: now.toISOString(),
    periodStart,
    summary: {
      totalUsers: countValue(wallet.total_users),
      activeUsers: countValue(wallet.active_users),
      blockedUsers: countValue(wallet.blocked_users),
      walletBalancePaise: countValue(wallet.wallet_balance_paise),
      totalProjects,
      publishedProjects,
      enabledApis,
      totalProjectRequests,
      paidProjectRequests,
      totalReferrals,
      openSupportTickets: openTickets,
      escalatedSupportTickets: escalatedTickets,
      totalAuditActions,
    },
    queues: {
      projectPurchases: pendingProjectPurchases,
      apiPurchases: pendingApiPurchases,
      walletDeposits: pendingDeposits,
      withdrawals: pendingWithdrawals,
      pendingReferrals,
    },
    period: {
      signups: sumDaily("signups"),
      productSalesPaise: sumDailyAmount("productSalesPaise"),
      walletDepositsPaise: sumDailyAmount("walletDepositsPaise"),
      paidWithdrawalsPaise: sumDailyAmount("paidWithdrawalsPaise"),
      supportTickets: sumDaily("supportTickets"),
      projectRequests: sumDaily("projectRequests"),
      referrals: sumDaily("referrals"),
    },
    daily,
    recentActions: (recentActionRows.data ?? []).map((row: AuditRow) => ({
      action: row.action,
      createdAt: toIsoString(row.created_at),
    })),
  }
}
