import "server-only"
import { getMysqlPool, selectMysqlRows, withMysqlTransaction } from "@/lib/mysql"
import type { ResultSetHeader, RowDataPacket } from "mysql2"

export type ProjectPurchase = {
  paymentId: string | null
  orderId: string
  projectCode: string
  projectTitle: string
  amountPaise: number
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

export async function saveProjectPurchase(purchase: {
  paymentId: string
  orderId: string
  userId: string
  projectCode: string
  projectTitle: string
  amountPaise: number
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

      await connection.execute(
        `UPDATE project_purchases
         SET purchased_at = IF(status = 'paid', purchased_at, CURRENT_TIMESTAMP(3)),
             payment_id = ?, project_title = ?, status = 'paid'
         WHERE order_id = ? AND status IN ('pending', 'paid', 'cancelled', 'expired', 'failed')`,
        [purchase.paymentId, purchase.projectTitle, purchase.orderId],
      )
      return true
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
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `UPDATE project_purchases SET status = ?
     WHERE order_id = ? AND user_id = ? AND status = 'pending'`,
    [status, orderId, userId],
  )
  if (result.affectedRows > 0) return true
  const rows = await selectMysqlRows<RowDataPacket & { status: string }>(
    "SELECT status FROM project_purchases WHERE order_id = ? AND user_id = ? LIMIT 1",
    [orderId, userId],
  )
  return rows[0]?.status === status
}

export async function markProjectPurchaseCancelled(orderId: string, userId: string): Promise<boolean> {
  return markPendingPurchase(orderId, userId, "cancelled")
}

export async function markProjectPurchaseExpired(orderId: string, userId: string): Promise<void> {
  await getMysqlPool().execute(
    `UPDATE project_purchases SET status = 'expired'
     WHERE order_id = ? AND user_id = ? AND status = 'pending'`,
    [orderId, userId],
  )
}

export async function markProjectPurchaseFailed(orderId: string, userId: string): Promise<boolean> {
  return markPendingPurchase(orderId, userId, "failed")
}

export async function hasPaidProjectPurchase(userId: string, projectCode: string, paymentId: string): Promise<boolean> {
  const rows = await selectMysqlRows<RowDataPacket & { payment_id: string | null }>(
    `SELECT payment_id FROM project_purchases
     WHERE user_id = ? AND project_code = ? AND payment_id = ? AND status = 'paid'
     LIMIT 1`,
    [userId, projectCode, paymentId],
  )
  return Boolean(rows[0]?.payment_id)
}

export async function listUserProjectPurchases(userId: string): Promise<ProjectPurchase[]> {
  const rows = await selectMysqlRows<PurchaseRow>(
    `SELECT payment_id, order_id, project_code, project_title, amount_paise,
            currency, status, purchased_at
     FROM project_purchases WHERE user_id = ?
     ORDER BY purchased_at DESC, order_id DESC`,
    [userId],
  )
  return rows.map((row) => ({
    paymentId: row.payment_id,
    orderId: row.order_id,
    projectCode: row.project_code,
    projectTitle: row.project_title,
    amountPaise: Number(row.amount_paise),
    currency: row.currency,
    status: row.status,
    purchasedAt: row.purchased_at instanceof Date ? row.purchased_at.toISOString() : row.purchased_at,
  }))
}
