import "server-only"
import { selectMysqlRows } from "@/lib/mysql"
import type { RowDataPacket } from "mysql2"

const ACTIVITY_LIMIT = 25
const DISPLAY_ACTIVITY_LIMIT = 40

export type OwnerWalletActivity = {
  id: string
  userId: string
  userUid: string
  userName: string
  email: string | null
  type: "deposit" | "withdrawal" | "credit" | "debit"
  amountPaise: number
  status: string
  createdAt: string
  reference: string
  reason: string | null
}

export type OwnerWalletDashboard = {
  summary: {
    totalUsers: number
    activeUsers: number
    blockedUsers: number
    walletBalancePaise: number
    paidDepositsPaise: number
    pendingWithdrawalsPaise: number
    paidWithdrawalsPaise: number
  }
  activity: OwnerWalletActivity[]
}

type ActivityRow = RowDataPacket & {
  user_id: string
  amount_paise: number | string
  status?: string
  created_at: Date | string
}

function toSafeInteger(value: number | string, label: string): number {
  const number = Number(value)
  if (!Number.isSafeInteger(number)) throw new Error(`${label} is outside the supported integer range.`)
  return number
}

function toIsoString(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error("Wallet activity contains an invalid date.")
  return date.toISOString()
}

export async function getOwnerWalletDashboard(): Promise<OwnerWalletDashboard> {
  const [summaryRows, deposits, withdrawals, adjustments] = await Promise.all([
    selectMysqlRows<RowDataPacket & {
      total_users: number | string
      active_users: number | string
      blocked_users: number | string
      paid_deposits_paise: number | string
      pending_withdrawals_paise: number | string
      paid_withdrawals_paise: number | string
      wallet_balance_paise: number | string
    }>(
      `SELECT
         (SELECT COUNT(*) FROM auth_users) AS total_users,
         (SELECT COUNT(*) FROM auth_users WHERE is_blocked = FALSE) AS active_users,
         (SELECT COUNT(*) FROM auth_users WHERE is_blocked = TRUE) AS blocked_users,
         COALESCE((SELECT SUM(amount_paise) FROM wallet_deposits WHERE status = 'paid'), 0) AS paid_deposits_paise,
         COALESCE((SELECT SUM(amount_paise) FROM wallet_withdrawal_requests WHERE status = 'pending'), 0) AS pending_withdrawals_paise,
         COALESCE((SELECT SUM(amount_paise) FROM wallet_withdrawal_requests WHERE status = 'paid'), 0) AS paid_withdrawals_paise,
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
    selectMysqlRows<ActivityRow & { order_id: string; deposit_id: string }>(
      `SELECT order_id, deposit_id, user_id, amount_paise, status, created_at
       FROM wallet_deposits ORDER BY created_at DESC LIMIT ?`,
      [ACTIVITY_LIMIT],
    ),
    selectMysqlRows<ActivityRow & { request_id: string; withdrawal_id: string }>(
      `SELECT request_id, withdrawal_id, user_id, amount_paise, status, created_at
       FROM wallet_withdrawal_requests ORDER BY created_at DESC LIMIT ?`,
      [ACTIVITY_LIMIT],
    ),
    selectMysqlRows<ActivityRow & { id: string; reason: string }>(
      `SELECT id, user_id, amount_paise, reason, created_at
       FROM owner_wallet_adjustments ORDER BY created_at DESC LIMIT ?`,
      [ACTIVITY_LIMIT],
    ),
  ])

  const summaryRow = summaryRows[0]
  if (!summaryRow) throw new Error("The wallet summary query returned no result.")

  const userIds = [...new Set([
    ...deposits.map((entry) => entry.user_id),
    ...withdrawals.map((entry) => entry.user_id),
    ...adjustments.map((entry) => entry.user_id),
  ])]
  const profiles = userIds.length
    ? await selectMysqlRows<RowDataPacket & { id: string; public_uid: string; name: string; email: string | null }>(
        `SELECT id, public_uid, name, email FROM auth_users WHERE id IN (${userIds.map(() => "?").join(", ")})`,
        userIds,
      )
    : []
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const activity: OwnerWalletActivity[] = [
    ...deposits.map((entry): OwnerWalletActivity => {
      const user = profileById.get(entry.user_id)
      return {
        id: `deposit:${entry.order_id}`,
        userId: entry.user_id,
        userUid: user?.public_uid ?? entry.user_id,
        userName: user?.name ?? "Deleted user",
        email: user?.email ?? null,
        type: "deposit",
        amountPaise: toSafeInteger(entry.amount_paise, "Deposit amount"),
        status: entry.status ?? "unknown",
        createdAt: toIsoString(entry.created_at),
        reference: entry.deposit_id,
        reason: null,
      }
    }),
    ...withdrawals.map((entry): OwnerWalletActivity => {
      const user = profileById.get(entry.user_id)
      return {
        id: `withdrawal:${entry.request_id}`,
        userId: entry.user_id,
        userUid: user?.public_uid ?? entry.user_id,
        userName: user?.name ?? "Deleted user",
        email: user?.email ?? null,
        type: "withdrawal",
        amountPaise: toSafeInteger(entry.amount_paise, "Withdrawal amount"),
        status: entry.status ?? "unknown",
        createdAt: toIsoString(entry.created_at),
        reference: entry.withdrawal_id,
        reason: null,
      }
    }),
    ...adjustments.map((entry): OwnerWalletActivity => {
      const user = profileById.get(entry.user_id)
      const amount = toSafeInteger(entry.amount_paise, "Wallet adjustment")
      return {
        id: `adjustment:${entry.id}`,
        userId: entry.user_id,
        userUid: user?.public_uid ?? entry.user_id,
        userName: user?.name ?? "Deleted user",
        email: user?.email ?? null,
        type: amount >= 0 ? "credit" : "debit",
        amountPaise: Math.abs(amount),
        status: "completed",
        createdAt: toIsoString(entry.created_at),
        reference: entry.id,
        reason: entry.reason,
      }
    }),
  ]
  activity.sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  return {
    summary: {
      totalUsers: toSafeInteger(summaryRow.total_users, "Total users"),
      activeUsers: toSafeInteger(summaryRow.active_users, "Active users"),
      blockedUsers: toSafeInteger(summaryRow.blocked_users, "Blocked users"),
      walletBalancePaise: toSafeInteger(summaryRow.wallet_balance_paise, "Total wallet balance"),
      paidDepositsPaise: toSafeInteger(summaryRow.paid_deposits_paise, "Paid deposits"),
      pendingWithdrawalsPaise: toSafeInteger(summaryRow.pending_withdrawals_paise, "Pending withdrawals"),
      paidWithdrawalsPaise: toSafeInteger(summaryRow.paid_withdrawals_paise, "Paid withdrawals"),
    },
    activity: activity.slice(0, DISPLAY_ACTIVITY_LIMIT),
  }
}
