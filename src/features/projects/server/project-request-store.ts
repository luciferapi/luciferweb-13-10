import "server-only"
import { getMysqlPool, selectMysqlRows, withMysqlTransaction } from "@/lib/mysql"
import type { ResultSetHeader, RowDataPacket } from "mysql2"

export const PROJECT_REQUEST_FEE_PAISE = 100

type ProjectRequestColumnRow = RowDataPacket & { columnName: string }

let projectRequestReviewSchemaSetup: Promise<void> | null = null

function isDuplicateColumnError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_FIELDNAME"
}

export async function ensureProjectRequestReviewSchema(): Promise<void> {
  if (!projectRequestReviewSchemaSetup) {
    projectRequestReviewSchemaSetup = (async () => {
      const columns = await selectMysqlRows<ProjectRequestColumnRow>(
        `SELECT COLUMN_NAME AS columnName
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'project_requests'
           AND COLUMN_NAME IN ('review_status', 'owner_message', 'reviewed_by', 'reviewed_at')`,
      )
      const existingColumns = new Set(columns.map((column) => column.columnName))
      const additions = [
        ["review_status", "VARCHAR(24) NOT NULL DEFAULT 'pending' AFTER status"],
        ["owner_message", "TEXT NULL AFTER review_status"],
        ["reviewed_by", "CHAR(36) NULL AFTER owner_message"],
        ["reviewed_at", "DATETIME(3) NULL AFTER reviewed_by"],
      ] as const

      for (const [name, definition] of additions) {
        if (existingColumns.has(name)) continue
        try {
          await getMysqlPool().execute(`ALTER TABLE project_requests ADD COLUMN ${name} ${definition}`)
        } catch (error) {
          if (!isDuplicateColumnError(error)) throw error
        }
      }
    })()
  }

  try {
    await projectRequestReviewSchemaSetup
  } catch (error) {
    projectRequestReviewSchemaSetup = null
    throw error
  }
}

type PaidProjectRequestRow = RowDataPacket & {
  request_number: number | string
  request_ref: string
  user_id: string
  email: string | null
  project_name: string
  description: string
  contact_email: string | null
  whatsapp_number: string | null
  telegram_id: string | null
  preferred_language: string | null
  desired_duration: string | null
  send_notification: boolean
}

export async function savePendingProjectRequest(input: {
  requestRef: string
  orderId: string
  userId: string
  projectName: string
  description: string
  contactEmail: string
  whatsappNumber: string
  telegramId: string
  preferredLanguage: string
  desiredDuration: string
}) {
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `INSERT INTO project_requests
      (request_ref, user_id, project_name, description, contact_email, whatsapp_number,
       telegram_id, preferred_language, desired_duration, order_id, payment_amount_paise)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.requestRef,
      input.userId,
      input.projectName,
      input.description,
      input.contactEmail || null,
      input.whatsappNumber || null,
      input.telegramId || null,
      input.preferredLanguage || null,
      input.desiredDuration || null,
      input.orderId,
      PROJECT_REQUEST_FEE_PAISE,
    ],
  )
  if (result.affectedRows !== 1) throw new Error("The project request payment was not recorded.")
}

export async function listPaidProjectRequests() {
  await ensureProjectRequestReviewSchema()
  const [rows] = await getMysqlPool().execute<(RowDataPacket & {
    id: number | string
    request_ref: string
    user_name: string | null
    user_email: string | null
    project_name: string
    description: string
    contact_email: string | null
    whatsapp_number: string | null
    telegram_id: string | null
    preferred_language: string | null
    desired_duration: string | null
    payment_amount_paise: number | string
    payment_status: string
    review_status: "pending" | "accepted" | "rejected"
    owner_message: string | null
    reviewed_at: Date | string | null
    created_at: Date | string
  })[]>(
    `SELECT requests.id, requests.request_ref, users.name AS user_name, users.email AS user_email,
            requests.project_name, requests.description, requests.contact_email, requests.whatsapp_number,
            requests.telegram_id, requests.preferred_language, requests.desired_duration,
            requests.payment_amount_paise, requests.payment_status, requests.review_status,
            requests.owner_message, requests.reviewed_at, requests.created_at
     FROM project_requests AS requests
     INNER JOIN auth_users AS users ON users.id = requests.user_id
     WHERE requests.payment_status = 'paid'
     ORDER BY CASE requests.review_status WHEN 'pending' THEN 0 ELSE 1 END,
              requests.created_at DESC`,
  )
  return rows.map((request) => ({
    id: Number(request.id),
    requestRef: request.request_ref,
    userName: request.user_name ?? "",
    userEmail: request.user_email ?? "",
    projectName: request.project_name,
    description: request.description,
    contactEmail: request.contact_email,
    whatsappNumber: request.whatsapp_number,
    telegramId: request.telegram_id,
    preferredLanguage: request.preferred_language,
    desiredDuration: request.desired_duration,
    paymentAmountPaise: Number(request.payment_amount_paise),
    paymentStatus: request.payment_status,
    reviewStatus: request.review_status,
    ownerMessage: request.owner_message,
    reviewedAt: request.reviewed_at instanceof Date ? request.reviewed_at.toISOString() : request.reviewed_at,
    createdAt: request.created_at instanceof Date ? request.created_at.toISOString() : request.created_at,
  }))
}

export async function listUserProjectRequests(userId: string) {
  await ensureProjectRequestReviewSchema()
  const [rows] = await getMysqlPool().execute<(RowDataPacket & {
    request_ref: string
    project_name: string
    description: string
    payment_amount_paise: number | string
    payment_status: string
    status: string
    review_status: "pending" | "accepted" | "rejected"
    owner_message: string | null
    reviewed_at: Date | string | null
    created_at: Date | string
  })[]>(
    `SELECT request_ref, project_name, description, payment_amount_paise,
            payment_status, status, review_status, owner_message, reviewed_at, created_at
     FROM project_requests
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId],
  )
  return rows.map((request) => ({
    requestRef: request.request_ref,
    projectName: request.project_name,
    description: request.description,
    paymentAmountPaise: Number(request.payment_amount_paise),
    paymentStatus: request.payment_status,
    status: request.status,
    reviewStatus: request.review_status,
    ownerMessage: request.owner_message,
    reviewedAt: request.reviewed_at instanceof Date ? request.reviewed_at.toISOString() : request.reviewed_at,
    createdAt: request.created_at instanceof Date ? request.created_at.toISOString() : request.created_at,
  }))
}

export async function reviewPaidProjectRequest(input: {
  requestRef: string
  decision: "accepted" | "rejected"
  ownerMessage: string | null
  reviewedBy: string
}): Promise<{ ok: true } | { ok: false; reason: "not_found" | "not_paid" | "already_reviewed" }> {
  await ensureProjectRequestReviewSchema()
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `UPDATE project_requests
     SET review_status = ?, owner_message = ?, reviewed_by = ?,
         reviewed_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3)
     WHERE request_ref = ? AND payment_status = 'paid' AND review_status = 'pending'`,
    [input.decision, input.ownerMessage, input.reviewedBy, input.requestRef],
  )
  if (result.affectedRows === 1) return { ok: true }

  const [rows] = await getMysqlPool().execute<(RowDataPacket & {
    payment_status: string
    review_status: string
  })[]>(
    "SELECT payment_status, review_status FROM project_requests WHERE request_ref = ? LIMIT 1",
    [input.requestRef],
  )
  const current = rows[0]
  if (!current) return { ok: false, reason: "not_found" }
  if (current.payment_status !== "paid") return { ok: false, reason: "not_paid" }
  return { ok: false, reason: "already_reviewed" }
}

export async function markProjectRequestCancelled(orderId: string, userId: string, status: "cancelled" | "failed") {
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `UPDATE project_requests SET payment_status = ?, status = ?
     WHERE order_id = ? AND user_id = ? AND payment_status = 'pending'`,
    [status, status, orderId, userId],
  )
  return result.affectedRows > 0
}

export async function markProjectRequestPaid(input: {
  orderId: string
  paymentId: string
  userId: string
  requestRef: string
}): Promise<{
  requestNumber: number
  requestRef: string
  userId: string
  email: string
  projectName: string
  description: string
  contactEmail: string
  whatsappNumber: string
  telegramId: string
  preferredLanguage: string
  desiredDuration: string
  sendNotification: boolean
} | null> {
  const request = await withMysqlTransaction(async (connection) => {
    const [rows] = await connection.execute<(PaidProjectRequestRow & {
      payment_id: string | null
      payment_status: string
      notification_status: string
    })[]>(
      `SELECT requests.id AS request_number, requests.request_ref, requests.user_id, requests.project_name,
              requests.description, requests.contact_email, requests.whatsapp_number, requests.telegram_id,
              requests.preferred_language, requests.desired_duration, requests.payment_id,
              requests.payment_status, requests.notification_status, users.email
       FROM project_requests AS requests
       INNER JOIN auth_users AS users ON users.id = requests.user_id
       WHERE requests.order_id = ? AND requests.user_id = ? AND requests.request_ref = ?
       FOR UPDATE`,
      [input.orderId, input.userId, input.requestRef],
    )
    const current = rows[0]
    if (!current?.email) return null

    let sendNotification = false
    if (current.payment_id !== null) {
      if (current.payment_id !== input.paymentId) return null
      if (current.notification_status === "failed" || current.notification_status === "pending") {
        const [updateResult] = await connection.execute<ResultSetHeader>(
          `UPDATE project_requests SET notification_status = 'sending'
           WHERE id = ? AND notification_status IN ('failed', 'pending')`,
          [current.request_number],
        )
        sendNotification = updateResult.affectedRows === 1
      }
    } else {
      const [updateResult] = await connection.execute<ResultSetHeader>(
        `UPDATE project_requests
         SET payment_id = ?, payment_status = 'paid', status = 'pending',
             notification_status = 'sending', updated_at = CURRENT_TIMESTAMP(3)
         WHERE id = ? AND payment_status = 'pending'`,
        [input.paymentId, current.request_number],
      )
      if (updateResult.affectedRows !== 1) return null
      sendNotification = true
    }

    return {
      ...current,
      email: current.email,
      send_notification: sendNotification,
    }
  })
  if (!request) return null

  return {
    requestNumber: Number(request.request_number),
    requestRef: request.request_ref,
    userId: request.user_id,
    email: request.email,
    projectName: request.project_name,
    description: request.description,
    contactEmail: request.contact_email ?? "",
    whatsappNumber: request.whatsapp_number ?? "",
    telegramId: request.telegram_id ?? "",
    preferredLanguage: request.preferred_language ?? "",
    desiredDuration: request.desired_duration ?? "",
    sendNotification: request.send_notification,
  }
}

export async function markProjectRequestNotification(requestRef: string, status: "sent" | "failed") {
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `UPDATE project_requests SET notification_status = ?
     WHERE request_ref = ? AND payment_status = 'paid'`,
    [status, requestRef],
  )
  if (result.affectedRows === 1) return
  const [rows] = await getMysqlPool().execute<(RowDataPacket & { request_ref: string })[]>(
    `SELECT request_ref FROM project_requests
     WHERE request_ref = ? AND payment_status = 'paid' LIMIT 1`,
    [requestRef],
  )
  if (rows.length !== 1) throw new Error("Could not record project request notification status.")
}
