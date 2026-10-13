import "server-only"
import { getMysqlPool, selectMysqlRows, withMysqlTransaction } from "@/lib/mysql"
import {
  markWalletPurchaseDebitPaidInTransaction,
  releaseWalletPurchaseDebitInTransaction,
  reserveWalletPurchaseDebitInTransaction,
} from "@/features/wallet/server/wallet-purchase-store"
import type { ResultSetHeader, RowDataPacket } from "mysql2"

export type ApiEndpointPurchase = {
  orderId: string
  paymentId: string | null
  userId: string
  endpointId: string
  endpointName: string
  amountPaise: number
  walletAppliedPaise: number
  status: "pending" | "paid" | "cancelled" | "expired" | "failed"
  purchasedAt: string
}

type ApiEndpointPurchaseRow = RowDataPacket & {
  order_id: string
  payment_id: string | null
  user_id: string
  endpoint_id: string
  endpoint_name: string
  amount_paise: number | string
  wallet_applied_paise: number | string
  status: ApiEndpointPurchase["status"]
  purchased_at: string | Date
}

function toPurchase(row: ApiEndpointPurchaseRow): ApiEndpointPurchase {
  return {
    orderId: row.order_id,
    paymentId: row.payment_id,
    userId: row.user_id,
    endpointId: row.endpoint_id,
    endpointName: row.endpoint_name,
    amountPaise: Number(row.amount_paise),
    walletAppliedPaise: Number(row.wallet_applied_paise),
    status: row.status,
    purchasedAt: row.purchased_at instanceof Date ? row.purchased_at.toISOString() : row.purchased_at,
  }
}

export async function listPaidApiEndpointIds(userId: string): Promise<string[]> {
  const rows = await selectMysqlRows<RowDataPacket & { endpoint_id: string }>(
    `SELECT endpoint_id FROM api_endpoint_purchases
     WHERE user_id = ? AND status = 'paid' LIMIT 500`,
    [userId],
  )
  return [...new Set(rows.map((row) => row.endpoint_id))]
}

export async function hasPaidApiEndpointAccess(userId: string, endpointId: string): Promise<boolean> {
  const rows = await selectMysqlRows<RowDataPacket & { order_id: string }>(
    `SELECT order_id FROM api_endpoint_purchases
     WHERE user_id = ? AND endpoint_id = ? AND status = 'paid' LIMIT 1`,
    [userId, endpointId],
  )
  return rows.length > 0
}

export async function savePendingApiEndpointPurchase(purchase: {
  orderId: string
  userId: string
  endpointId: string
  endpointName: string
  amountPaise: number
}): Promise<boolean> {
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `INSERT INTO api_endpoint_purchases
      (order_id, user_id, endpoint_id, endpoint_name, amount_paise, currency, status)
     VALUES (?, ?, ?, ?, ?, 'INR', 'pending')`,
    [purchase.orderId, purchase.userId, purchase.endpointId, purchase.endpointName, purchase.amountPaise],
  )
  return result.affectedRows === 1
}

export async function saveWalletOnlyApiEndpointPurchase(purchase: {
  orderId: string
  userId: string
  endpointId: string
  endpointName: string
  amountPaise: number
}): Promise<boolean> {
  if (!Number.isSafeInteger(purchase.amountPaise) || purchase.amountPaise < 1) return false
  try {
    return await withMysqlTransaction(async (connection) => {
      const [existingAccess] = await connection.execute<(RowDataPacket & { order_id: string })[]>(
        `SELECT order_id FROM api_endpoint_purchases
         WHERE user_id = ? AND endpoint_id = ? AND status = 'paid' FOR UPDATE`,
        [purchase.userId, purchase.endpointId],
      )
      if (existingAccess.length > 0) return false

      const reserved = await reserveWalletPurchaseDebitInTransaction(connection, {
        userId: purchase.userId,
        purchaseKey: purchase.orderId,
        amountPaise: purchase.amountPaise,
      })
      if (!reserved) return false

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO api_endpoint_purchases
          (order_id, payment_id, user_id, endpoint_id, endpoint_name, amount_paise, currency, status, purchased_at)
         VALUES (?, NULL, ?, ?, ?, ?, 'INR', 'paid', CURRENT_TIMESTAMP(3))`,
        [purchase.orderId, purchase.userId, purchase.endpointId, purchase.endpointName, purchase.amountPaise],
      )
      if (result.affectedRows !== 1) return false
      const markedPaid = await markWalletPurchaseDebitPaidInTransaction(connection, {
        userId: purchase.userId,
        purchaseKey: purchase.orderId,
        amountPaise: purchase.amountPaise,
      })
      if (!markedPaid) throw new Error("Could not finalize the wallet purchase debit.")
      return true
    })
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY") return false
    throw error
  }
}

export async function getApiEndpointPurchase(orderId: string, userId: string): Promise<ApiEndpointPurchase | null> {
  const [row] = await selectMysqlRows<ApiEndpointPurchaseRow>(
    `SELECT p.order_id, p.payment_id, p.user_id, p.endpoint_id, p.endpoint_name,
            p.amount_paise, COALESCE(d.amount_paise, 0) AS wallet_applied_paise,
            p.status, p.purchased_at
     FROM api_endpoint_purchases p
     LEFT JOIN wallet_purchase_debits d ON d.purchase_key = p.order_id AND d.user_id = p.user_id
     WHERE p.order_id = ? AND p.user_id = ? LIMIT 1`,
    [orderId, userId],
  )
  return row ? toPurchase(row) : null
}

export async function listUserApiEndpointPurchases(userId: string): Promise<ApiEndpointPurchase[]> {
  const rows = await selectMysqlRows<ApiEndpointPurchaseRow>(
    `SELECT p.order_id, p.payment_id, p.user_id, p.endpoint_id, p.endpoint_name,
            p.amount_paise, COALESCE(d.amount_paise, 0) AS wallet_applied_paise,
            p.status, p.purchased_at
     FROM api_endpoint_purchases p
     LEFT JOIN wallet_purchase_debits d ON d.purchase_key = p.order_id AND d.user_id = p.user_id
     WHERE p.user_id = ?
     ORDER BY p.purchased_at DESC, p.order_id DESC LIMIT 100`,
    [userId],
  )
  return rows.map(toPurchase)
}

export async function savePaidApiEndpointPurchase(purchase: {
  paymentId: string
  orderId: string
  userId: string
  endpointId: string
  amountPaise: number
  walletAppliedPaise: number
}): Promise<boolean> {
  return withMysqlTransaction(async (connection) => {
    const [existingRows] = await connection.execute<(RowDataPacket & {
      payment_id: string | null
      user_id: string
      endpoint_id: string
      amount_paise: number | string
      status: ApiEndpointPurchase["status"]
    })[]>(
      `SELECT payment_id, user_id, endpoint_id, amount_paise, status
       FROM api_endpoint_purchases WHERE order_id = ? FOR UPDATE`,
      [purchase.orderId],
    )
    const existing = existingRows[0]
    if (
      !existing ||
      existing.user_id !== purchase.userId ||
      existing.endpoint_id !== purchase.endpointId ||
      Number(existing.amount_paise) !== purchase.amountPaise ||
      (existing.payment_id !== null && existing.payment_id !== purchase.paymentId)
    ) return false

    const [debitRows] = await connection.execute<(RowDataPacket & {
      amount_paise: number | string
      status: "reserved" | "paid" | "released"
    })[]>(
      "SELECT amount_paise, status FROM wallet_purchase_debits WHERE purchase_key = ? AND user_id = ? FOR UPDATE",
      [purchase.orderId, purchase.userId],
    )
    const debit = debitRows[0]
    const reservedWalletPaise = debit ? Number(debit.amount_paise) : 0
    let debitStatus = debit?.status
    if (purchase.walletAppliedPaise > 0 && debitStatus === "released") {
      const reReserved = await reserveWalletPurchaseDebitInTransaction(connection, {
        userId: purchase.userId,
        purchaseKey: purchase.orderId,
        amountPaise: purchase.walletAppliedPaise,
      })
      if (!reReserved) return false
      debitStatus = "reserved"
    }
    if (reservedWalletPaise !== purchase.walletAppliedPaise ||
      (purchase.walletAppliedPaise > 0 && debitStatus !== "reserved" && debitStatus !== "paid")) return false

    if (existing.status === "paid") return existing.payment_id === purchase.paymentId

    await connection.execute(
      `UPDATE api_endpoint_purchases
       SET payment_id = ?, status = 'paid', purchased_at = CURRENT_TIMESTAMP(3)
       WHERE order_id = ? AND user_id = ? AND endpoint_id = ? AND amount_paise = ?
         AND status IN ('pending', 'cancelled', 'expired', 'failed')`,
      [purchase.paymentId, purchase.orderId, purchase.userId, purchase.endpointId, purchase.amountPaise],
    )
    return markWalletPurchaseDebitPaidInTransaction(connection, {
      userId: purchase.userId,
      purchaseKey: purchase.orderId,
      amountPaise: purchase.walletAppliedPaise,
    })
  })
}

export async function markApiEndpointPurchaseStopped(
  orderId: string,
  userId: string,
  status: "cancelled" | "failed",
): Promise<boolean> {
  return withMysqlTransaction(async (connection) => {
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE api_endpoint_purchases SET status = ?
       WHERE order_id = ? AND user_id = ? AND status = 'pending'`,
      [status, orderId, userId],
    )
    if (result.affectedRows > 0) {
      await releaseWalletPurchaseDebitInTransaction(connection, orderId, userId)
      return true
    }

    const [existing] = await connection.execute<(RowDataPacket & { status: string })[]>(
      "SELECT status FROM api_endpoint_purchases WHERE order_id = ? AND user_id = ? LIMIT 1",
      [orderId, userId],
    )
    if (existing[0]?.status !== status) return false
    await releaseWalletPurchaseDebitInTransaction(connection, orderId, userId)
    return true
  })
}
