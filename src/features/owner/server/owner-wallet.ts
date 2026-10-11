import "server-only"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

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

function getAdminClient() {
  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase admin access is not configured.")
  return client
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
  const client = getAdminClient()
  const [summaryResult, depositResult, withdrawalResult, adjustmentResult] = await Promise.all([
    client.rpc("owner_wallet_summary"),
    client
      .from("wallet_deposits")
      .select("order_id, deposit_id, user_id, amount_paise, status, created_at")
      .order("created_at", { ascending: false })
      .limit(ACTIVITY_LIMIT),
    client
      .from("wallet_withdrawal_requests")
      .select("request_id, withdrawal_id, user_id, amount_paise, status, created_at")
      .order("created_at", { ascending: false })
      .limit(ACTIVITY_LIMIT),
    client
      .from("owner_wallet_adjustments")
      .select("id, user_id, amount_paise, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(ACTIVITY_LIMIT),
  ])

  if (summaryResult.error) throw summaryResult.error
  if (depositResult.error) throw depositResult.error
  if (withdrawalResult.error) throw withdrawalResult.error
  if (adjustmentResult.error) throw adjustmentResult.error

  const summaryRow = Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data
  if (!summaryRow) throw new Error("The wallet summary query returned no result.")

  const deposits = depositResult.data ?? []
  const withdrawals = withdrawalResult.data ?? []
  const adjustments = adjustmentResult.data ?? []
  const userIds = [...new Set([
    ...deposits.map((entry) => entry.user_id),
    ...withdrawals.map((entry) => entry.user_id),
    ...adjustments.map((entry) => entry.user_id),
  ])]
  const { data: profiles, error: profileError } = userIds.length
    ? await client.from("auth_users").select("id, public_uid, name, email").in("id", userIds)
    : { data: [], error: null }
  if (profileError) throw profileError

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
  const activity: OwnerWalletActivity[] = [
    ...deposits.map((entry): OwnerWalletActivity => {
      const user = profileById.get(entry.user_id)
      return {
        id: `deposit:${entry.order_id}`,
        userId: entry.user_id,
        userUid: user?.id ?? entry.user_id,
        userName: user?.name ?? "Deleted user",
        email: user?.email ?? null,
        type: "deposit",
        amountPaise: toSafeInteger(entry.amount_paise, "Deposit amount"),
        status: entry.status,
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
        userUid: user?.id ?? entry.user_id,
        userName: user?.name ?? "Deleted user",
        email: user?.email ?? null,
        type: "withdrawal",
        amountPaise: toSafeInteger(entry.amount_paise, "Withdrawal amount"),
        status: entry.status,
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
        userUid: user?.id ?? entry.user_id,
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
