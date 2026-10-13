import "server-only"
import { selectMysqlRows } from "@/lib/mysql"
import type { RowDataPacket } from "mysql2"

const DAY_COUNT = 30

type NumberRow = RowDataPacket & { value: number | string }
type DailyCountRow = RowDataPacket & { date_key: string; value: number | string }
type AuditRow = RowDataPacket & { action: string; created_at: Date | string }

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
    totalProjectPurchases: number
    paidProjectPurchases: number
    totalApiPurchases: number
    paidApiPurchases: number
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

function safeInteger(value: number | string, label: string) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`${label} is outside the supported integer range.`)
  }
  return number
}

function safeSignedInteger(value: number | string, label: string) {
  const number = Number(value)
  if (!Number.isSafeInteger(number)) throw new Error(`${label} is outside the supported integer range.`)
  return number
}

function toIsoString(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error("Analytics contains an invalid date.")
  return date.toISOString()
}

function addDailyRows(
  dailyByDate: Map<string, OwnerAnalyticsDaily>,
  rows: DailyCountRow[],
  field: "signups" | "referrals" | "supportTickets" | "projectRequests" |
    "productSalesPaise" | "walletDepositsPaise" | "paidWithdrawalsPaise",
  label: string,
) {
  for (const row of rows) {
    const day = dailyByDate.get(row.date_key)
    if (!day) continue
    const next = day[field] + safeInteger(row.value, label)
    if (!Number.isSafeInteger(next)) throw new Error("Analytics totals exceed the supported integer range.")
    day[field] = next
  }
}

async function scalar(sql: string, label: string, values: readonly (string | number)[] = []) {
  const rows = await selectMysqlRows<NumberRow>(sql, values)
  return safeInteger(rows[0]?.value ?? 0, label)
}

export async function getOwnerAnalytics(): Promise<OwnerAnalytics> {
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const firstDay = new Date(today)
  firstDay.setUTCDate(firstDay.getUTCDate() - (DAY_COUNT - 1))
  const periodStart = firstDay.toISOString()
  const startDate = periodStart.slice(0, 10)
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

  const [
    walletRows,
    totalProjects,
    publishedProjects,
    enabledApis,
    totalProjectRequests,
    paidProjectRequests,
    totalProjectPurchases,
    paidProjectPurchases,
    totalApiPurchases,
    paidApiPurchases,
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
    salesRows,
    depositRows,
    withdrawalRows,
    referralRows,
    supportRows,
    projectRequestRows,
    recentActions,
  ] = await Promise.all([
    selectMysqlRows<RowDataPacket & {
      total_users: number | string
      active_users: number | string
      blocked_users: number | string
      wallet_balance_paise: number | string
    }>(
      `SELECT
         (SELECT COUNT(*) FROM auth_users) AS total_users,
         (SELECT COUNT(*) FROM auth_users WHERE is_blocked = FALSE) AS active_users,
         (SELECT COUNT(*) FROM auth_users WHERE is_blocked = TRUE) AS blocked_users,
         COALESCE((
           SELECT SUM(GREATEST(COALESCE(d.total, 0) - COALESCE(w.total, 0) + COALESCE(a.total, 0), 0))
           FROM auth_users u
           LEFT JOIN (
             SELECT user_id, SUM(amount_paise) AS total FROM wallet_deposits
             WHERE status = 'paid' GROUP BY user_id
           ) d ON d.user_id = u.id
           LEFT JOIN (
             SELECT user_id, SUM(amount_paise) AS total FROM wallet_withdrawal_requests
             WHERE status IN ('pending', 'paid') GROUP BY user_id
           ) w ON w.user_id = u.id
           LEFT JOIN (
             SELECT user_id, SUM(amount_paise) AS total FROM owner_wallet_adjustments GROUP BY user_id
           ) a ON a.user_id = u.id
         ), 0) AS wallet_balance_paise`,
    ),
    scalar("SELECT COUNT(*) AS value FROM projects", "Total projects"),
    scalar("SELECT COUNT(*) AS value FROM projects WHERE is_published = TRUE", "Published projects"),
    scalar("SELECT COUNT(*) AS value FROM api_endpoints WHERE is_enabled = TRUE", "Enabled APIs"),
    scalar("SELECT COUNT(*) AS value FROM project_requests", "Project requests"),
    scalar("SELECT COUNT(*) AS value FROM project_requests WHERE payment_status = 'paid'", "Paid project requests"),
    scalar("SELECT COUNT(*) AS value FROM project_purchases", "Project purchases"),
    scalar("SELECT COUNT(*) AS value FROM project_purchases WHERE status = 'paid'", "Paid project purchases"),
    scalar("SELECT COUNT(*) AS value FROM api_endpoint_purchases", "API purchases"),
    scalar("SELECT COUNT(*) AS value FROM api_endpoint_purchases WHERE status = 'paid'", "Paid API purchases"),
    scalar("SELECT COUNT(*) AS value FROM referrals", "Referrals"),
    scalar("SELECT COUNT(*) AS value FROM referrals WHERE status = 'pending'", "Pending referrals"),
    scalar("SELECT COUNT(*) AS value FROM support_tickets WHERE status IN ('open', 'in_progress', 'waiting_on_user')", "Open support tickets"),
    scalar("SELECT COUNT(*) AS value FROM support_tickets WHERE escalated_at IS NOT NULL", "Escalated support tickets"),
    scalar("SELECT COUNT(*) AS value FROM owner_audit_logs WHERE created_at >= ?", "Audit actions", [periodStart]),
    scalar("SELECT COUNT(*) AS value FROM project_purchases WHERE status = 'pending'", "Pending project purchases"),
    scalar("SELECT COUNT(*) AS value FROM api_endpoint_purchases WHERE status = 'pending'", "Pending API purchases"),
    scalar("SELECT COUNT(*) AS value FROM wallet_deposits WHERE status = 'pending'", "Pending deposits"),
    scalar("SELECT COUNT(*) AS value FROM wallet_withdrawal_requests WHERE status = 'pending'", "Pending withdrawals"),
    selectMysqlRows<DailyCountRow>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date_key, COUNT(*) AS value
       FROM auth_users WHERE created_at >= ? GROUP BY date_key`,
      [startDate],
    ),
    selectMysqlRows<DailyCountRow>(
      `SELECT date_key, SUM(amount_paise) AS value FROM (
         SELECT DATE_FORMAT(purchased_at, '%Y-%m-%d') AS date_key, amount_paise
         FROM project_purchases WHERE status = 'paid' AND purchased_at >= ?
         UNION ALL
         SELECT DATE_FORMAT(purchased_at, '%Y-%m-%d') AS date_key, amount_paise
         FROM api_endpoint_purchases WHERE status = 'paid' AND purchased_at >= ?
       ) sales GROUP BY date_key`,
      [startDate, startDate],
    ),
    selectMysqlRows<DailyCountRow>(
      `SELECT DATE_FORMAT(paid_at, '%Y-%m-%d') AS date_key, SUM(amount_paise) AS value
       FROM wallet_deposits WHERE status = 'paid' AND paid_at >= ? GROUP BY date_key`,
      [startDate],
    ),
    selectMysqlRows<DailyCountRow>(
      `SELECT DATE_FORMAT(processed_at, '%Y-%m-%d') AS date_key, SUM(amount_paise) AS value
       FROM wallet_withdrawal_requests
       WHERE status = 'paid' AND processed_at IS NOT NULL AND processed_at >= ?
       GROUP BY date_key`,
      [startDate],
    ),
    selectMysqlRows<DailyCountRow>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date_key, COUNT(*) AS value
       FROM referrals WHERE created_at >= ? GROUP BY date_key`,
      [startDate],
    ),
    selectMysqlRows<DailyCountRow>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date_key, COUNT(*) AS value
       FROM support_tickets WHERE created_at >= ? GROUP BY date_key`,
      [startDate],
    ),
    selectMysqlRows<DailyCountRow>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date_key, COUNT(*) AS value
       FROM project_requests WHERE created_at >= ? GROUP BY date_key`,
      [startDate],
    ),
    selectMysqlRows<AuditRow>(
      "SELECT action, created_at FROM owner_audit_logs ORDER BY created_at DESC LIMIT 8",
    ),
  ])

  const wallet = walletRows[0]
  if (!wallet) throw new Error("The wallet summary query returned no result.")
  addDailyRows(dailyByDate, signupRows, "signups", "Daily signups")
  addDailyRows(dailyByDate, salesRows, "productSalesPaise", "Product sales")
  addDailyRows(dailyByDate, depositRows, "walletDepositsPaise", "Wallet deposits")
  addDailyRows(dailyByDate, withdrawalRows, "paidWithdrawalsPaise", "Paid withdrawals")
  addDailyRows(dailyByDate, referralRows, "referrals", "Daily referrals")
  addDailyRows(dailyByDate, supportRows, "supportTickets", "Daily support tickets")
  addDailyRows(dailyByDate, projectRequestRows, "projectRequests", "Daily project requests")
  const daily = [...dailyByDate.values()]
  const sumDaily = (field: "signups" | "referrals" | "supportTickets" | "projectRequests") =>
    daily.reduce((total, row) => {
      const next = total + row[field]
      if (!Number.isSafeInteger(next)) throw new Error("Analytics totals exceed the supported integer range.")
      return next
    }, 0)
  const sumMoney = (field: "productSalesPaise" | "walletDepositsPaise" | "paidWithdrawalsPaise") =>
    daily.reduce((total, row) => {
      const next = total + row[field]
      if (!Number.isSafeInteger(next)) throw new Error("Analytics totals exceed the supported integer range.")
      return next
    }, 0)

  return {
    generatedAt: now.toISOString(),
    periodStart,
    summary: {
      totalUsers: safeInteger(wallet.total_users, "Total users"),
      activeUsers: safeInteger(wallet.active_users, "Active users"),
      blockedUsers: safeInteger(wallet.blocked_users, "Blocked users"),
      walletBalancePaise: safeSignedInteger(wallet.wallet_balance_paise, "Total wallet balance"),
      totalProjects,
      publishedProjects,
      enabledApis,
      totalProjectRequests,
      paidProjectRequests,
      totalProjectPurchases,
      paidProjectPurchases,
      totalApiPurchases,
      paidApiPurchases,
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
      productSalesPaise: sumMoney("productSalesPaise"),
      walletDepositsPaise: sumMoney("walletDepositsPaise"),
      paidWithdrawalsPaise: sumMoney("paidWithdrawalsPaise"),
      supportTickets: sumDaily("supportTickets"),
      projectRequests: sumDaily("projectRequests"),
      referrals: sumDaily("referrals"),
    },
    daily,
    recentActions: recentActions.map((row) => ({
      action: row.action,
      createdAt: toIsoString(row.created_at),
    })),
  }
}
