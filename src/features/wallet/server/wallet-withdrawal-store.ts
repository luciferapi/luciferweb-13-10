import "server-only"
import { randomUUID } from "node:crypto"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import type { PayoutDetails } from "@/features/wallet/server/withdrawal-method-store"
import { generateWalletTransactionId } from "@/features/wallet/server/wallet-transaction-id"

export const MIN_WITHDRAWAL_PAISE = 5_000
export const MAX_WITHDRAWAL_PAISE = 150_000
export const MAX_DAILY_WITHDRAWAL_REQUESTS = 4

export type WalletWithdrawalStatus = "pending" | "paid" | "rejected" | "cancelled"

export type WalletWithdrawalRequest = {
  withdrawalId: string
  amountPaise: number
  method: PayoutDetails["method"]
  destination: string
  status: WalletWithdrawalStatus
  createdAt: string
  ownerResponse: string | null
  paymentReference: string | null
}

type WithdrawalRow = {
  withdrawal_id: string
  amount_paise: number | string
  method_type: PayoutDetails["method"]
  payout_destination: string
  status: WalletWithdrawalStatus
  created_at: Date | string
  owner_response: string | null
  payment_reference: string | null
}

export class WithdrawalRequestLimitError extends Error {
  constructor() {
    super("You have reached the daily limit of four withdrawal requests.")
    this.name = "WithdrawalRequestLimitError"
  }
}

export class WithdrawalAmountExceedsBalanceError extends Error {
  constructor() {
    super("The withdrawal amount exceeds your available wallet balance.")
    this.name = "WithdrawalAmountExceedsBalanceError"
  }
}

function getAdminClient() {
  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase admin access is not configured.")
  return client
}

function indiaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

export async function getAvailableWalletBalancePaise(userId: string): Promise<number> {
  const { data, error } = await getAdminClient().rpc("get_available_wallet_balance_paise", {
    p_user_id: userId,
  })
  if (error) throw error
  const available = Number(data ?? 0)
  if (!Number.isSafeInteger(available)) {
    throw new Error("The available wallet balance is outside the supported integer range.")
  }
  return Math.max(available, 0)
}

export async function getDailyWithdrawalRequestCount(userId: string): Promise<number> {
  const { count, error } = await getAdminClient()
    .from("wallet_withdrawal_requests")
    .select("request_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("request_date", indiaDateKey())
  if (error) throw error
  return count ?? 0
}

export async function createWalletWithdrawalRequest(input: {
  userId: string
  amountPaise: number
  method: PayoutDetails["method"]
  destination: string
}): Promise<{ withdrawalId: string; remainingRequests: number }> {
  const { data, error } = await getAdminClient().rpc("create_wallet_withdrawal_request", {
    p_request_id: randomUUID(),
    p_withdrawal_id: generateWalletTransactionId("WIT"),
    p_user_id: input.userId,
    p_amount_paise: input.amountPaise,
    p_method_type: input.method,
    p_payout_destination: input.destination,
    p_request_date: indiaDateKey(),
  })
  if (error) throw error

  const result = data as { success?: boolean; error_code?: string; withdrawal_id?: string; remaining_requests?: number } | null
  if (result?.error_code === "daily_limit") throw new WithdrawalRequestLimitError()
  if (result?.error_code === "insufficient_balance") throw new WithdrawalAmountExceedsBalanceError()
  if (!result?.success || !result.withdrawal_id || typeof result.remaining_requests !== "number") {
    throw new Error("The withdrawal request was not saved.")
  }
  return { withdrawalId: result.withdrawal_id, remainingRequests: result.remaining_requests }
}

export async function listUserWalletWithdrawalRequests(userId: string): Promise<WalletWithdrawalRequest[]> {
  const { data, error } = await getAdminClient()
    .from("wallet_withdrawal_requests")
    .select("withdrawal_id, amount_paise, method_type, payout_destination, status, created_at, owner_response, payment_reference")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("request_id", { ascending: false })
  if (error) throw error
  return ((data ?? []) as WithdrawalRow[]).map((row) => ({
    withdrawalId: row.withdrawal_id,
    amountPaise: Number(row.amount_paise),
    method: row.method_type,
    destination: row.payout_destination,
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    ownerResponse: row.owner_response,
    paymentReference: row.payment_reference,
  }))
}
