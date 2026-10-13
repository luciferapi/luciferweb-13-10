import "server-only"
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise"
import { withMysqlTransaction } from "@/lib/mysql"

export type WalletPurchaseDebit = {
  amountPaise: number
  status: "reserved" | "paid" | "released"
}

export async function reserveWalletPurchaseDebitInTransaction(
  connection: PoolConnection,
  input: { userId: string; purchaseKey: string; amountPaise: number },
): Promise<boolean> {
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise < 1) {
    throw new Error("Wallet amount must be a positive whole number of paise.")
  }

  let reactivatingReleasedDebit = false
  const [existing] = await connection.execute<(RowDataPacket & {
    user_id: string
    amount_paise: number | string
    status: WalletPurchaseDebit["status"]
  })[]>(
    "SELECT user_id, amount_paise, status FROM wallet_purchase_debits WHERE purchase_key = ? FOR UPDATE",
    [input.purchaseKey],
  )
  if (existing.length > 0) {
    if (existing[0].user_id !== input.userId || Number(existing[0].amount_paise) !== input.amountPaise) return false
    if (existing[0].status === "reserved" || existing[0].status === "paid") return true
    reactivatingReleasedDebit = true
  }

  const [users] = await connection.execute<(RowDataPacket & { id: string })[]>(
    "SELECT id FROM auth_users WHERE id = ? FOR UPDATE",
    [input.userId],
  )
  if (users.length === 0) return false

  const [balances] = await connection.execute<(RowDataPacket & { balance_paise: number | string | null })[]>(
    `SELECT
       COALESCE((SELECT SUM(amount_paise) FROM wallet_deposits WHERE user_id = ? AND status = 'paid'), 0)
       - COALESCE((SELECT SUM(amount_paise) FROM wallet_withdrawal_requests WHERE user_id = ? AND status IN ('pending', 'paid')), 0)
       + COALESCE((SELECT SUM(amount_paise) FROM owner_wallet_adjustments WHERE user_id = ?), 0)
       - COALESCE((SELECT SUM(amount_paise) FROM wallet_purchase_debits WHERE user_id = ? AND status IN ('reserved', 'paid')), 0) AS balance_paise`,
    [input.userId, input.userId, input.userId, input.userId],
  )
  const balancePaise = Math.max(Number(balances[0]?.balance_paise ?? 0), 0)
  if (!Number.isSafeInteger(balancePaise)) throw new Error("Wallet balance is invalid.")
  if (input.amountPaise > balancePaise) return false

  if (reactivatingReleasedDebit) {
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE wallet_purchase_debits SET status = 'reserved'
       WHERE purchase_key = ? AND user_id = ? AND amount_paise = ? AND status = 'released'`,
      [input.purchaseKey, input.userId, input.amountPaise],
    )
    return result.affectedRows === 1
  }

  await connection.execute<ResultSetHeader>(
    "INSERT INTO wallet_purchase_debits (purchase_key, user_id, amount_paise, status) VALUES (?, ?, ?, 'reserved')",
    [input.purchaseKey, input.userId, input.amountPaise],
  )
  return true
}

export async function markWalletPurchaseDebitPaidInTransaction(
  connection: PoolConnection,
  input: { userId: string; purchaseKey: string; amountPaise: number },
): Promise<boolean> {
  if (input.amountPaise === 0) return true
  const [result] = await connection.execute<ResultSetHeader>(
    `UPDATE wallet_purchase_debits SET status = 'paid'
     WHERE purchase_key = ? AND user_id = ? AND amount_paise = ? AND status IN ('reserved', 'paid')`,
    [input.purchaseKey, input.userId, input.amountPaise],
  )
  if (result.affectedRows > 0) return true
  const [existing] = await connection.execute<(RowDataPacket & { status: string; amount_paise: number | string })[]>(
    "SELECT status, amount_paise FROM wallet_purchase_debits WHERE purchase_key = ? AND user_id = ? LIMIT 1",
    [input.purchaseKey, input.userId],
  )
  return existing[0]?.status === "paid" && Number(existing[0].amount_paise) === input.amountPaise
}

export async function releaseWalletPurchaseDebitInTransaction(
  connection: PoolConnection,
  purchaseKey: string,
  userId: string,
): Promise<void> {
  await connection.execute(
    `UPDATE wallet_purchase_debits SET status = 'released'
     WHERE purchase_key = ? AND user_id = ? AND status = 'reserved'`,
    [purchaseKey, userId],
  )
}

export async function reserveWalletPurchaseDebit(input: {
  userId: string
  purchaseKey: string
  amountPaise: number
}): Promise<boolean> {
  return withMysqlTransaction((connection) => reserveWalletPurchaseDebitInTransaction(connection, input))
}

export async function getWalletPurchaseDebit(purchaseKey: string, userId: string): Promise<WalletPurchaseDebit | null> {
  return withMysqlTransaction(async (connection) => {
    const [rows] = await connection.execute<(RowDataPacket & {
      amount_paise: number | string
      status: WalletPurchaseDebit["status"]
    })[]>(
      "SELECT amount_paise, status FROM wallet_purchase_debits WHERE purchase_key = ? AND user_id = ? LIMIT 1",
      [purchaseKey, userId],
    )
    if (!rows[0]) return null
    const amountPaise = Number(rows[0].amount_paise)
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 1) throw new Error("Wallet purchase amount is invalid.")
    return { amountPaise, status: rows[0].status }
  })
}

export async function releaseWalletPurchaseDebit(purchaseKey: string, userId: string): Promise<void> {
  await withMysqlTransaction((connection) => releaseWalletPurchaseDebitInTransaction(connection, purchaseKey, userId))
}
