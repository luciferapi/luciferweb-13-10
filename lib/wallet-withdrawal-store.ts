import { randomUUID } from "node:crypto"
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"
import { getDatabasePool } from "@/lib/database"
import type { PayoutDetails } from "@/lib/withdrawal-method-store"
import { generateWalletTransactionId } from "@/lib/wallet-transaction-id"

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
  const [rows] = await getDatabasePool().execute<(RowDataPacket & { available_paise: number | string })[]>(
    `SELECT
       COALESCE((SELECT SUM(amount_paise) FROM wallet_deposits WHERE user_id = ? AND status = 'paid'), 0)
       - COALESCE((SELECT SUM(amount_paise) FROM wallet_withdrawal_requests
                   WHERE user_id = ? AND status = 'paid'), 0)
       - COALESCE((SELECT SUM(amount_paise) FROM wallet_withdrawal_requests
                   WHERE user_id = ? AND status = 'pending'), 0)
       AS available_paise`,
    [userId, userId, userId],
  )
  const available = Number(rows[0]?.available_paise ?? 0)
  if (!Number.isSafeInteger(available)) {
    throw new Error("The available wallet balance is outside the supported integer range.")
  }
  return Math.max(available, 0)
}

export async function getDailyWithdrawalRequestCount(userId: string): Promise<number> {
  const [rows] = await getDatabasePool().execute<(RowDataPacket & { request_count: number | string })[]>(
    `SELECT COUNT(*) AS request_count
     FROM wallet_withdrawal_requests
     WHERE user_id = ? AND request_date = ?`,
    [userId, indiaDateKey()],
  )
  return Number(rows[0]?.request_count ?? 0)
}

export async function createWalletWithdrawalRequest(input: {
  userId: string
  amountPaise: number
  method: PayoutDetails["method"]
  destination: string
}): Promise<{ withdrawalId: string; remainingRequests: number }> {
  const connection = await getDatabasePool().getConnection()
  const requestId = randomUUID()
  const withdrawalId = generateWalletTransactionId("WIT")
  const requestDate = indiaDateKey()
  try {
    await connection.beginTransaction()
    await connection.execute(
      "SELECT id FROM auth_users WHERE id = ? FOR UPDATE",
      [input.userId],
    )

    const [countRows] = await connection.execute<(RowDataPacket & { request_count: number | string })[]>(
      `SELECT COUNT(*) AS request_count
       FROM wallet_withdrawal_requests
       WHERE user_id = ? AND request_date = ?`,
      [input.userId, requestDate],
    )
    const requestCount = Number(countRows[0]?.request_count ?? 0)
    if (requestCount >= MAX_DAILY_WITHDRAWAL_REQUESTS) throw new WithdrawalRequestLimitError()

    const [balanceRows] = await connection.execute<(RowDataPacket & {
      available_paise: number | string
    })[]>(
      `SELECT
         COALESCE((SELECT SUM(amount_paise) FROM wallet_deposits
                   WHERE user_id = ? AND status = 'paid'), 0)
         - COALESCE((SELECT SUM(amount_paise) FROM wallet_withdrawal_requests
                     WHERE user_id = ? AND status = 'paid'), 0)
         - COALESCE((SELECT SUM(amount_paise) FROM wallet_withdrawal_requests
                     WHERE user_id = ? AND status = 'pending'), 0)
         AS available_paise`,
      [input.userId, input.userId, input.userId],
    )
    const availablePaise = Number(balanceRows[0]?.available_paise ?? 0)
    if (!Number.isSafeInteger(availablePaise) || input.amountPaise > availablePaise) {
      throw new WithdrawalAmountExceedsBalanceError()
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO wallet_withdrawal_requests
       (request_id, withdrawal_id, user_id, amount_paise, method_type, payout_destination, request_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [requestId, withdrawalId, input.userId, input.amountPaise, input.method, input.destination, requestDate],
    )
    if (result.affectedRows !== 1) throw new Error("The withdrawal request was not saved.")

    await connection.commit()
    return {
      withdrawalId,
      remainingRequests: MAX_DAILY_WITHDRAWAL_REQUESTS - requestCount - 1,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function listUserWalletWithdrawalRequests(userId: string): Promise<WalletWithdrawalRequest[]> {
  const [rows] = await getDatabasePool().execute<(RowDataPacket & {
    withdrawal_id: string
    amount_paise: number | string
    method_type: PayoutDetails["method"]
    payout_destination: string
    status: WalletWithdrawalStatus
    created_at: Date | string
  })[]>(
    `SELECT withdrawal_id, amount_paise, method_type, payout_destination, status, created_at
     FROM wallet_withdrawal_requests
     WHERE user_id = ?
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
  }))
}
