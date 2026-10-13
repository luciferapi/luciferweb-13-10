import "server-only"
import { getMysqlPool, selectMysqlRows, withMysqlTransaction } from "@/lib/mysql"
import {
  markWalletPurchaseDebitPaidInTransaction,
  releaseWalletPurchaseDebitInTransaction,
  reserveWalletPurchaseDebitInTransaction,
} from "@/features/wallet/server/wallet-purchase-store"
import type { ResultSetHeader, RowDataPacket } from "mysql2"

export type ProjectPurchase = {
  paymentId: string | null
  orderId: string
  projectCode: string
  projectTitle: string
  amountPaise: number
  walletAppliedPaise: number
  currency: string
  status: "pending" | "paid" | "cancelled" | "expired" | "failed"
  purchasedAt: string
}

type PurchaseRow = RowDataPacket & {
  payment_id: string | null
  order_id: string
  project_code: string
  project_title: string
  amount_paise: number | string
  wallet_applied_paise: number | string
  currency: string
  status: ProjectPurchase["status"]
  purchased_at: string | Date
}

export async function savePendingProjectPurchase(purchase: {
  orderId: string
  userId: string
  projectCode: string
  projectTitle: string
  amountPaise: number
}): Promise<boolean> {
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `INSERT INTO project_purchases
      (payment_id, order_id, user_id, project_code, project_title, amount_paise, currency, status)
     VALUES (NULL, ?, ?, ?, ?, ?, 'INR', 'pending')`,
    [purchase.orderId, purchase.userId, purchase.projectCode, purchase.projectTitle, purchase.amountPaise],
  )
  return result.affectedRows === 1
}

export async function saveWalletOnlyProjectPurchase(purchase: {
  orderId: string
  userId: string
  projectCode: string
  projectTitle: string
  amountPaise: number
}): Promise<boolean> {
  if (!Number.isSafeInteger(purchase.amountPaise) || purchase.amountPaise < 1) return false
  try {
    return await withMysqlTransaction(async (connection) => {
      const reserved = await reserveWalletPurchaseDebitInTransaction(connection, {
        userId: purchase.userId,
        purchaseKey: purchase.orderId,
        amountPaise: purchase.amountPaise,
      })
      if (!reserved) return false

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO project_purchases
          (payment_id, order_id, user_id, project_code, project_title, amount_paise, currency, status, purchased_at)
         VALUES (NULL, ?, ?, ?, ?, ?, 'INR', 'paid', CURRENT_TIMESTAMP(3))`,
        [purchase.orderId, purchase.userId, purchase.projectCode, purchase.projectTitle, purchase.amountPaise],
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

export async function saveProjectPurchase(purchase: {
  paymentId: string
  orderId: string
  userId: string
  projectCode: string
  projectTitle: string
  amountPaise: number
  walletAppliedPaise: number
}): Promise<boolean> {
  try {
    return await withMysqlTransaction(async (connection) => {
      const [existingRows] = await connection.execute<(RowDataPacket & {
        payment_id: string | null
        user_id: string
        project_code: string
        amount_paise: number | string
        status: ProjectPurchase["status"]
      })[]>(
        `SELECT payment_id, user_id, project_code, amount_paise, status
         FROM project_purchases WHERE order_id = ? FOR UPDATE`,
        [purchase.orderId],
      )
      const existing = existingRows[0]
      if (
        !existing ||
        existing.user_id !== purchase.userId ||
        existing.project_code !== purchase.projectCode ||
        Number(existing.amount_paise) !== purchase.amountPaise ||
        (existing.payment_id !== null && existing.payment_id !== purchase.paymentId)
      ) {
        return false
      }

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

      await connection.execute(
        `UPDATE project_purchases
         SET purchased_at = IF(status = 'paid', purchased_at, CURRENT_TIMESTAMP(3)),
             payment_id = ?, project_title = ?, status = 'paid'
         WHERE order_id = ? AND status IN ('pending', 'paid', 'cancelled', 'expired', 'failed')`,
        [purchase.paymentId, purchase.projectTitle, purchase.orderId],
      )
      return markWalletPurchaseDebitPaidInTransaction(connection, {
        userId: purchase.userId,
        purchaseKey: purchase.orderId,
        amountPaise: purchase.walletAppliedPaise,
      })
    })
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY") {
      return false
    }
    throw error
  }
}

export async function listPendingProjectPurchases(userId: string): Promise<string[]> {
  const rows = await selectMysqlRows<RowDataPacket & { order_id: string }>(
    `SELECT order_id FROM project_purchases
     WHERE user_id = ? AND status = 'pending'
     ORDER BY purchased_at DESC LIMIT 100`,
    [userId],
  )
  return rows.map((row) => row.order_id)
}

async function markPendingPurchase(orderId: string, userId: string, status: "cancelled" | "failed"): Promise<boolean> {
  return withMysqlTransaction(async (connection) => {
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE project_purchases SET status = ?
       WHERE order_id = ? AND user_id = ? AND status = 'pending'`,
      [status, orderId, userId],
    )
    if (result.affectedRows > 0) {
      await releaseWalletPurchaseDebitInTransaction(connection, orderId, userId)
      return true
    }
    const [rows] = await connection.execute<(RowDataPacket & { status: string })[]>(
      "SELECT status FROM project_purchases WHERE order_id = ? AND user_id = ? LIMIT 1",
      [orderId, userId],
    )
    if (rows[0]?.status !== status) return false
    await releaseWalletPurchaseDebitInTransaction(connection, orderId, userId)
    return true
  })
}

export async function markProjectPurchaseCancelled(orderId: string, userId: string): Promise<boolean> {
  return markPendingPurchase(orderId, userId, "cancelled")
}

export async function markProjectPurchaseExpired(orderId: string, userId: string): Promise<void> {
  await withMysqlTransaction(async (connection) => {
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE project_purchases SET status = 'expired'
       WHERE order_id = ? AND user_id = ? AND status = 'pending'`,
      [orderId, userId],
    )
    if (result.affectedRows > 0) await releaseWalletPurchaseDebitInTransaction(connection, orderId, userId)
  })
}

export async function markProjectPurchaseFailed(orderId: string, userId: string): Promise<boolean> {
  return markPendingPurchase(orderId, userId, "failed")
}

export async function hasPaidProjectPurchase(userId: string, projectCode: string, paymentId: string): Promise<boolean> {
  const rows = await selectMysqlRows<RowDataPacket & { payment_id: string | null }>(
    `SELECT payment_id FROM project_purchases
     WHERE user_id = ? AND project_code = ? AND status = 'paid'
       AND (payment_id = ? OR (payment_id IS NULL AND order_id = ?))
     LIMIT 1`,
    [userId, projectCode, paymentId, paymentId],
  )
  return rows.length > 0
}

export async function listUserProjectPurchases(userId: string): Promise<ProjectPurchase[]> {
  const rows = await selectMysqlRows<PurchaseRow>(
    `SELECT p.payment_id, p.order_id, p.project_code, p.project_title, p.amount_paise,
            COALESCE(d.amount_paise, 0) AS wallet_applied_paise,
            p.currency, p.status, p.purchased_at
     FROM project_purchases p
     LEFT JOIN wallet_purchase_debits d ON d.purchase_key = p.order_id AND d.user_id = p.user_id
     WHERE p.user_id = ?
     ORDER BY p.purchased_at DESC, p.order_id DESC`,
    [userId],
  )
  return rows.map((row) => ({
    paymentId: row.payment_id,
    orderId: row.order_id,
    projectCode: row.project_code,
    projectTitle: row.project_title,
    amountPaise: Number(row.amount_paise),
    walletAppliedPaise: Number(row.wallet_applied_paise),
    currency: row.currency,
    status: row.status,
    purchasedAt: row.purchased_at instanceof Date ? row.purchased_at.toISOString() : row.purchased_at,
  }))
}
