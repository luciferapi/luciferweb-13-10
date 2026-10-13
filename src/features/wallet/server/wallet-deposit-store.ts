import "server-only"
import { getMysqlPool, selectMysqlRows, withMysqlTransaction } from "@/lib/mysql"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { generateWalletTransactionId } from "@/features/wallet/server/wallet-transaction-id"

export type WalletDepositStatus = "pending" | "paid" | "cancelled" | "expired" | "failed"

export type WalletDeposit = {
  depositId: string
  paymentId: string | null
  orderId: string
  amountPaise: number
  currency: "INR"
  status: WalletDepositStatus
  createdAt: string
  paidAt: string | null
  paymentDetails: WalletDepositPaymentDetails | null
}

export type WalletDepositPaymentDetails = {
  method: string | null
  status: string
  captured: boolean
  international: boolean | null
  bank: string | null
  wallet: string | null
  vpa: string | null
  email: string | null
  contact: string | null
  feePaise: number | null
  taxPaise: number | null
  providerCreatedAt: string | null
  description: string | null
  reference: string | null
  cardNetwork: string | null
  cardLast4: string | null
}

type WalletDepositRow = RowDataPacket & {
  deposit_id: string
  payment_id: string | null
  order_id: string
  user_id: string
  amount_paise: number | string
  currency: "INR"
  status: WalletDepositStatus
  created_at: Date | string
  paid_at: Date | string | null
  payment_details: WalletDepositPaymentDetails | string | null
}

function toIsoString(value: Date | string | null): string | null {
  if (value === null) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function parsePaymentDetails(value: WalletDepositPaymentDetails | string | null): WalletDepositPaymentDetails | null {
  if (value === null) return null
  const details: unknown = typeof value === "string" ? JSON.parse(value) : value
  if (
    typeof details !== "object" ||
    details === null ||
    !("status" in details) ||
    typeof details.status !== "string" ||
    !("captured" in details) ||
    typeof details.captured !== "boolean" ||
    !("method" in details) ||
    !(details.method === null || typeof details.method === "string") ||
    !("international" in details) ||
    !(details.international === null || typeof details.international === "boolean") ||
    !("bank" in details) ||
    !(details.bank === null || typeof details.bank === "string") ||
    !("wallet" in details) ||
    !(details.wallet === null || typeof details.wallet === "string") ||
    !("vpa" in details) ||
    !(details.vpa === null || typeof details.vpa === "string") ||
    !("email" in details) ||
    !(details.email === null || typeof details.email === "string") ||
    !("contact" in details) ||
    !(details.contact === null || typeof details.contact === "string") ||
    !("feePaise" in details) ||
    !(details.feePaise === null || (typeof details.feePaise === "number" && Number.isSafeInteger(details.feePaise))) ||
    !("taxPaise" in details) ||
    !(details.taxPaise === null || (typeof details.taxPaise === "number" && Number.isSafeInteger(details.taxPaise))) ||
    !("providerCreatedAt" in details) ||
    !(details.providerCreatedAt === null || typeof details.providerCreatedAt === "string") ||
    !("description" in details) ||
    !(details.description === null || typeof details.description === "string") ||
    !("reference" in details) ||
    !(details.reference === null || typeof details.reference === "string") ||
    !("cardNetwork" in details) ||
    !(details.cardNetwork === null || typeof details.cardNetwork === "string") ||
    !("cardLast4" in details) ||
    !(details.cardLast4 === null || typeof details.cardLast4 === "string")
  ) {
    throw new Error("Stored Razorpay wallet payment details are invalid.")
  }
  return {
    method: details.method,
    status: details.status,
    captured: details.captured,
    international: details.international,
    bank: details.bank,
    wallet: details.wallet,
    vpa: details.vpa,
    email: details.email,
    contact: details.contact,
    feePaise: details.feePaise,
    taxPaise: details.taxPaise,
    providerCreatedAt: details.providerCreatedAt,
    description: details.description,
    reference: details.reference,
    cardNetwork: details.cardNetwork,
    cardLast4: details.cardLast4,
  }
}

export async function savePendingWalletDeposit(input: {
  orderId: string
  userId: string
  amountPaise: number
}): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const [result] = await getMysqlPool().execute<ResultSetHeader>(
        `INSERT INTO wallet_deposits
          (deposit_id, payment_id, order_id, user_id, amount_paise, currency, status)
         VALUES (?, NULL, ?, ?, ?, 'INR', 'pending')`,
        [
          generateWalletTransactionId("DEP"),
          input.orderId,
          input.userId,
          input.amountPaise,
        ],
      )
      if (result.affectedRows !== 1) throw new Error("The wallet deposit order was not saved.")
      return
    } catch (error) {
      const duplicate = typeof error === "object" && error !== null &&
        "code" in error && error.code === "ER_DUP_ENTRY"
      if (!duplicate || attempt === 2) throw error
    }
  }
}

export async function getWalletDepositForOrder(orderId: string, userId: string): Promise<{
  depositId: string
  amountPaise: number
  status: WalletDepositStatus
  paymentId: string | null
} | null> {
  const rows = await selectMysqlRows<RowDataPacket & {
    deposit_id: string
    amount_paise: number | string
    status: WalletDepositStatus
    payment_id: string | null
  }>(
    `SELECT deposit_id, amount_paise, status, payment_id FROM wallet_deposits
     WHERE order_id = ? AND user_id = ? LIMIT 1`,
    [orderId, userId],
  )
  const row = rows[0]
  return row
    ? {
        depositId: row.deposit_id,
        amountPaise: Number(row.amount_paise),
        status: row.status,
        paymentId: row.payment_id,
      }
    : null
}

export async function markWalletDepositPaid(input: {
  orderId: string
  paymentId: string
  userId: string
  amountPaise: number
  paymentDetails: WalletDepositPaymentDetails
}): Promise<boolean> {
  return withMysqlTransaction(async (connection) => {
    const [rows] = await connection.execute<(RowDataPacket & {
      user_id: string
      amount_paise: number | string
      payment_id: string | null
      status: WalletDepositStatus
    })[]>(
      `SELECT user_id, amount_paise, payment_id, status
       FROM wallet_deposits WHERE order_id = ? FOR UPDATE`,
      [input.orderId],
    )
    const current = rows[0]
    if (
      !current ||
      current.user_id !== input.userId ||
      Number(current.amount_paise) !== input.amountPaise ||
      (current.payment_id !== null && current.payment_id !== input.paymentId)
    ) {
      return false
    }
    if (current.status === "paid") return current.payment_id === input.paymentId
    if (current.status !== "pending") return false

    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE wallet_deposits
       SET payment_id = ?, status = 'paid', payment_details = ?,
           paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP(3))
       WHERE order_id = ? AND user_id = ? AND amount_paise = ?
         AND status = 'pending' AND (payment_id IS NULL OR payment_id = ?)`,
      [
        input.paymentId,
        JSON.stringify(input.paymentDetails),
        input.orderId,
        input.userId,
        input.amountPaise,
        input.paymentId,
      ],
    )
    return result.affectedRows === 1
  })
}

export async function updatePendingWalletDepositStatus(
  orderId: string,
  userId: string,
  status: "cancelled" | "failed",
): Promise<boolean> {
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `UPDATE wallet_deposits SET status = ?
     WHERE order_id = ? AND user_id = ? AND status = 'pending'`,
    [status, orderId, userId],
  )
  return result.affectedRows === 1
}

export async function listUserWalletDeposits(userId: string): Promise<WalletDeposit[]> {
  const rows = await selectMysqlRows<WalletDepositRow>(
    `SELECT deposit_id, payment_id, order_id, user_id, amount_paise, currency, status,
            created_at, paid_at, payment_details
     FROM wallet_deposits WHERE user_id = ?
     ORDER BY created_at DESC, order_id DESC`,
    [userId],
  )
  return rows.map((row) => ({
    depositId: row.deposit_id,
    paymentId: row.payment_id,
    orderId: row.order_id,
    amountPaise: Number(row.amount_paise),
    currency: row.currency,
    status: row.status,
    createdAt: toIsoString(row.created_at)!,
    paidAt: toIsoString(row.paid_at),
    paymentDetails: parsePaymentDetails(row.payment_details),
  }))
}
