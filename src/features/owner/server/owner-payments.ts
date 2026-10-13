import "server-only"
import { getWithdrawalPayoutDetailsForUsers, type PayoutDetails } from "@/features/wallet/server/withdrawal-method-store"
import { selectMysqlRows, withMysqlTransaction } from "@/lib/mysql"
import type { RowDataPacket } from "mysql2"

const PAGE_LIMIT = 100
const primaryOwnerEmail = "kspgpraveen157@gmail.com"

export type OwnerPayoutRequest = {
  requestId: string
  withdrawalId: string
  userId: string
  publicUid: string
  userName: string
  email: string | null
  amountPaise: number
  method: PayoutDetails["method"]
  destination: PayoutDetails | null
  maskedDestination: string
  paymentReference: string | null
  ownerResponse: string | null
  ownerNote: string | null
  processedAt: string | null
  status: "pending" | "paid" | "rejected" | "cancelled"
  createdAt: string
}

type PayoutRow = RowDataPacket & {
  request_id: string
  withdrawal_id: string
  user_id: string
  amount_paise: number | string
  method_type: PayoutDetails["method"]
  payout_destination: string
  payment_reference: string | null
  owner_response: string | null
  owner_note: string | null
  processed_at: Date | string | null
  status: OwnerPayoutRequest["status"]
  created_at: Date | string
}

function safeAmount(value: number | string): number {
  const amount = Number(value)
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("A payout request has an invalid amount.")
  return amount
}

function isoDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error("A payout request has an invalid date.")
  return date.toISOString()
}

export async function listOwnerPayoutRequests(filter: "pending" | "all") {
  const where = filter === "pending" ? "WHERE status = 'pending'" : ""
  const [rows, counts] = await Promise.all([
    selectMysqlRows<PayoutRow>(
      `SELECT request_id, withdrawal_id, user_id, amount_paise, method_type, payout_destination,
              payment_reference, owner_response, owner_note, processed_at, status, created_at
       FROM wallet_withdrawal_requests ${where}
       ORDER BY created_at DESC, request_id DESC LIMIT ?`,
      [PAGE_LIMIT],
    ),
    selectMysqlRows<RowDataPacket & { pending_count: number | string }>(
      "SELECT COUNT(*) AS pending_count FROM wallet_withdrawal_requests WHERE status = 'pending'",
    ),
  ])

  const userIds = [...new Set(rows.map((row) => row.user_id))]
  const pendingUserIds = [...new Set(rows.filter((row) => row.status === "pending").map((row) => row.user_id))]
  const [profiles, payoutDetailsByUser] = await Promise.all([
    userIds.length
      ? selectMysqlRows<RowDataPacket & { id: string; public_uid: string; name: string; email: string | null }>(
          `SELECT id, public_uid, name, email FROM auth_users WHERE id IN (${userIds.map(() => "?").join(", ")})`,
          userIds,
        )
      : Promise.resolve([]),
    getWithdrawalPayoutDetailsForUsers(pendingUserIds),
  ])
  const profilesByUser = new Map(profiles.map((profile) => [profile.id, profile]))
  const requests: OwnerPayoutRequest[] = rows.map((row) => {
    const profile = profilesByUser.get(row.user_id)
    const destination = row.status === "pending" ? payoutDetailsByUser.get(row.user_id) ?? null : null
    if (row.status === "pending" && (!destination || destination.method !== row.method_type)) {
      throw new Error(`Payout details for withdrawal ${row.withdrawal_id} are unavailable or inconsistent.`)
    }
    return {
      requestId: row.request_id,
      withdrawalId: row.withdrawal_id,
      userId: row.user_id,
      publicUid: profile?.public_uid ?? row.user_id,
      userName: profile?.name ?? "Deleted user",
      email: profile?.email ?? null,
      amountPaise: safeAmount(row.amount_paise),
      method: row.method_type,
      destination,
      maskedDestination: row.payout_destination,
      paymentReference: row.payment_reference,
      ownerResponse: row.owner_response,
      ownerNote: row.owner_note,
      processedAt: row.processed_at ? isoDate(row.processed_at) : null,
      status: row.status,
      createdAt: isoDate(row.created_at),
    }
  })

  const pendingCount = Number(counts[0]?.pending_count ?? 0)
  if (!Number.isSafeInteger(pendingCount)) throw new Error("The pending payout count is invalid.")
  return { requests, pendingCount, limit: PAGE_LIMIT, totalShown: requests.length }
}

export async function setOwnerPayoutStatus(input: {
  actorUserId: string
  requestId: string
  status: "paid" | "rejected"
  externalPaymentConfirmed: boolean
  ownerResponse: string
  paymentReference: string | null
  ownerNote: string | null
}) {
  if (input.status !== "paid" && input.status !== "rejected") return "invalid_status"
  if (input.ownerResponse.trim().length < 3 || input.ownerResponse.trim().length > 1000) return "invalid_response"
  if (input.ownerNote && input.ownerNote.length > 1000) return "invalid_owner_note"
  if (input.status === "paid" && !input.externalPaymentConfirmed) return "payment_confirmation_required"
  if (
    (input.status === "paid" && (!input.paymentReference || input.paymentReference.length < 3 || input.paymentReference.length > 120)) ||
    (input.status === "rejected" && input.paymentReference)
  ) return "invalid_payment_reference"

  return withMysqlTransaction(async (connection) => {
    const [actors] = await connection.execute<RowDataPacket[]>(
      `SELECT u.email, a.allowed_modules
       FROM auth_users u LEFT JOIN owner_admins a ON a.user_id = u.id
       WHERE u.id = ? AND u.is_blocked = FALSE LIMIT 1 FOR UPDATE`,
      [input.actorUserId],
    )
    const actor = actors[0] as { email: string | null; allowed_modules: string[] | string | null } | undefined
    let authorized = actor?.email?.toLowerCase() === primaryOwnerEmail
    if (actor && !authorized && actor.allowed_modules) {
      const modules: unknown = typeof actor.allowed_modules === "string"
        ? JSON.parse(actor.allowed_modules)
        : actor.allowed_modules
      authorized = Array.isArray(modules) && modules.includes("payments")
    }
    if (!authorized) return "unauthorized"

    const [requestRows] = await connection.execute<RowDataPacket[]>(
      `SELECT user_id, status FROM wallet_withdrawal_requests
       WHERE request_id = ? LIMIT 1 FOR UPDATE`,
      [input.requestId],
    )
    const request = requestRows[0] as { user_id: string; status: string } | undefined
    if (!request || request.status !== "pending") return "not_pending"

    await connection.execute(
      `UPDATE wallet_withdrawal_requests
       SET status = ?, owner_response = ?, payment_reference = ?, owner_note = ?,
           processed_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3)
       WHERE request_id = ?`,
      [
        input.status,
        input.ownerResponse.trim(),
        input.paymentReference,
        input.ownerNote?.trim() || null,
        input.requestId,
      ],
    )
    await connection.execute(
      `INSERT INTO owner_audit_logs (actor_user_id, action, subject_user_id, details)
       VALUES (?, 'wallet.withdrawal_status_updated', ?, ?)`,
      [
        input.actorUserId,
        request.user_id,
        JSON.stringify({
          requestId: input.requestId,
          status: input.status,
          paymentReference: input.paymentReference,
          ownerNote: input.ownerNote?.trim() || null,
        }),
      ],
    )
    return "updated"
  })
}
