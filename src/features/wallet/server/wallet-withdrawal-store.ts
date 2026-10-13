import "server-only"
import { randomUUID } from "node:crypto"
import { getMysqlPool, selectMysqlRows, withMysqlTransaction } from "@/lib/mysql"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
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

type WithdrawalRow = RowDataPacket & {
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
  const pool = getMysqlPool()
  const [rows] = await pool.execute<(RowDataPacket & { balance_paise: number | string | null })[]>(
    `SELECT
       COALESCE((SELECT SUM(amount_paise) FROM wallet_deposits
                 WHERE user_id = ? AND status = 'paid'), 0)
       - COALESCE((SELECT SUM(amount_paise) FROM wallet_withdrawal_requests
                   WHERE user_id = ? AND status IN ('pending', 'paid')), 0)
       + COALESCE((SELECT SUM(amount_paise) FROM owner_wallet_adjustments
                   WHERE user_id = ?), 0)
       - COALESCE((SELECT SUM(amount_paise) FROM wallet_purchase_debits
                   WHERE user_id = ?), 0) AS balance_paise`,
    [userId, userId, userId, userId],
  )
  const available = Number(rows[0]?.balance_paise ?? 0)
  if (!Number.isSafeInteger(available)) {
    throw new Error("The available wallet balance is outside the supported integer range.")
  }
  return Math.max(available, 0)
}

export async function getDailyWithdrawalRequestCount(userId: string): Promise<number> {
  const [rows] = await getMysqlPool().execute<(RowDataPacket & { request_count: number | string })[]>(
    `SELECT COUNT(*) AS request_count FROM wallet_withdrawal_requests
     WHERE user_id = ? AND request_date = ?`,
    [userId, indiaDateKey()],
  )
  const count = Number(rows[0]?.request_count ?? 0)
  if (!Number.isSafeInteger(count)) throw new Error("The daily withdrawal request count is invalid.")
  return count
}

export async function createWalletWithdrawalRequest(input: {
  userId: string
  amountPaise: number
  method: PayoutDetails["method"]
  destination: string
}): Promise<{ withdrawalId: string; remainingRequests: number }> {
  const withdrawalId = generateWalletTransactionId("WIT")
  const result = await withMysqlTransaction(async (connection) => {
    const [users] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM auth_users WHERE id = ? FOR UPDATE",
      [input.userId],
    )
    if (users.length === 0) throw new Error("The wallet account does not exist.")

    const requestDate = indiaDateKey()
    const [countRows] = await connection.execute<(RowDataPacket & {
      request_count: number | string
    })[]>(
      `SELECT COUNT(*) AS request_count FROM wallet_withdrawal_requests
       WHERE user_id = ? AND request_date = ?`,
      [input.userId, requestDate],
    )
    const requestCount = Number(countRows[0]?.request_count ?? 0)
    if (requestCount >= MAX_DAILY_WITHDRAWAL_REQUESTS) return { error: "daily_limit" as const }

    const [balanceRows] = await connection.execute<(RowDataPacket & {
      balance_paise: number | string | null
    })[]>(
      `SELECT
         COALESCE((SELECT SUM(amount_paise) FROM wallet_deposits
                   WHERE user_id = ? AND status = 'paid'), 0)
         - COALESCE((SELECT SUM(amount_paise) FROM wallet_withdrawal_requests
                     WHERE user_id = ? AND status IN ('pending', 'paid')), 0)
         + COALESCE((SELECT SUM(amount_paise) FROM owner_wallet_adjustments
                     WHERE user_id = ?), 0) AS balance_paise`,
      [input.userId, input.userId, input.userId, input.userId],
    )
    const balance = Number(balanceRows[0]?.balance_paise ?? 0)
    if (!Number.isSafeInteger(balance)) throw new Error("The wallet balance is outside the supported integer range.")
    if (input.amountPaise > Math.max(balance, 0)) return { error: "insufficient_balance" as const }

    await connection.execute<ResultSetHeader>(
      `INSERT INTO wallet_withdrawal_requests
        (request_id, withdrawal_id, user_id, amount_paise, method_type, payout_destination, request_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        withdrawalId,
        input.userId,
        input.amountPaise,
        input.method,
        input.destination,
        requestDate,
      ],
    )
    return {
      error: null,
      remainingRequests: MAX_DAILY_WITHDRAWAL_REQUESTS - requestCount - 1,
    } as const
  })

  if (result.error === "daily_limit") throw new WithdrawalRequestLimitError()
  if (result.error === "insufficient_balance") throw new WithdrawalAmountExceedsBalanceError()
  return { withdrawalId, remainingRequests: result.remainingRequests }
}

export async function listUserWalletWithdrawalRequests(userId: string): Promise<WalletWithdrawalRequest[]> {
  const rows = await selectMysqlRows<WithdrawalRow>(
    `SELECT withdrawal_id, amount_paise, method_type, payout_destination, status,
            created_at, owner_response, payment_reference
     FROM wallet_withdrawal_requests WHERE user_id = ?
     ORDER BY created_at DESC, request_id DESC`,
    [userId],
  )
  return rows.map((row) => ({
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
