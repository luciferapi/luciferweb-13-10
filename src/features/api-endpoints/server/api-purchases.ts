import "server-only"
import { getMysqlPool, selectMysqlRows } from "@/lib/mysql"
import type { ResultSetHeader, RowDataPacket } from "mysql2"

export type ApiEndpointPurchase = {
  orderId: string
  paymentId: string | null
  userId: string
  endpointId: string
  endpointName: string
  amountPaise: number
  status: "pending" | "paid" | "cancelled" | "expired" | "failed"
}

type ApiEndpointPurchaseRow = RowDataPacket & {
  order_id: string
  payment_id: string | null
  user_id: string
  endpoint_id: string
  endpoint_name: string
  amount_paise: number | string
  status: ApiEndpointPurchase["status"]
}

function toPurchase(row: ApiEndpointPurchaseRow): ApiEndpointPurchase {
  return {
    orderId: row.order_id,
    paymentId: row.payment_id,
    userId: row.user_id,
    endpointId: row.endpoint_id,
    endpointName: row.endpoint_name,
    amountPaise: Number(row.amount_paise),
    status: row.status,
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

export async function getApiEndpointPurchase(orderId: string, userId: string): Promise<ApiEndpointPurchase | null> {
  const [row] = await selectMysqlRows<ApiEndpointPurchaseRow>(
    `SELECT order_id, payment_id, user_id, endpoint_id, endpoint_name, amount_paise, status
     FROM api_endpoint_purchases WHERE order_id = ? AND user_id = ? LIMIT 1`,
    [orderId, userId],
  )
  return row ? toPurchase(row) : null
}

export async function savePaidApiEndpointPurchase(purchase: {
  paymentId: string
  orderId: string
  userId: string
  endpointId: string
  amountPaise: number
}): Promise<boolean> {
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `UPDATE api_endpoint_purchases
     SET payment_id = ?, status = 'paid', purchased_at = CURRENT_TIMESTAMP(3)
     WHERE order_id = ? AND user_id = ? AND endpoint_id = ? AND amount_paise = ?
       AND status IN ('pending', 'cancelled', 'expired', 'failed')`,
    [purchase.paymentId, purchase.orderId, purchase.userId, purchase.endpointId, purchase.amountPaise],
  )
  if (result.affectedRows > 0) return true

  const existing = await getApiEndpointPurchase(purchase.orderId, purchase.userId)
  return existing?.paymentId === purchase.paymentId &&
    existing.endpointId === purchase.endpointId &&
    existing.amountPaise === purchase.amountPaise &&
    existing.status === "paid"
}

export async function markApiEndpointPurchaseStopped(
  orderId: string,
  userId: string,
  status: "cancelled" | "failed",
): Promise<boolean> {
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `UPDATE api_endpoint_purchases SET status = ?
     WHERE order_id = ? AND user_id = ? AND status = 'pending'`,
    [status, orderId, userId],
  )
  if (result.affectedRows > 0) return true

  const existing = await getApiEndpointPurchase(orderId, userId)
  return existing?.status === status
}
