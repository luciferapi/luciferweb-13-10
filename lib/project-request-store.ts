import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"
import { getDatabasePool } from "@/lib/database"

export const PROJECT_REQUEST_FEE_PAISE = 100

type ProjectRequestRow = RowDataPacket & {
  id: number
  request_ref: string
  user_id: string
  email: string
  project_name: string
  description: string
  contact_email: string | null
  whatsapp_number: string | null
  telegram_id: string | null
  preferred_language: string | null
  desired_duration: string | null
  payment_id: string | null
  notification_status: "pending" | "sending" | "sent" | "failed"
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
  const [result] = await getDatabasePool().execute<ResultSetHeader>(
    `INSERT INTO project_requests (
       request_ref, user_id, project_name, description, contact_email, whatsapp_number,
       telegram_id, preferred_language, desired_duration, order_id, payment_amount_paise
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

export async function markProjectRequestCancelled(orderId: string, userId: string, status: "cancelled" | "failed") {
  const paymentStatus = status
  const [result] = await getDatabasePool().execute<ResultSetHeader>(
    `UPDATE project_requests
     SET payment_status = ?, status = ?
     WHERE order_id = ? AND user_id = ? AND payment_status = 'pending'`,
    [paymentStatus, status, orderId, userId],
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
  const pool = getDatabasePool()
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<ProjectRequestRow[]>(
      `SELECT r.id, r.request_ref, r.user_id, u.email, r.project_name, r.description,
              r.contact_email, r.whatsapp_number, r.telegram_id, r.preferred_language,
              r.desired_duration, r.payment_id, r.notification_status
       FROM project_requests r
       JOIN auth_users u ON u.id = r.user_id
       WHERE r.order_id = ? AND r.user_id = ? AND r.request_ref = ?
       LIMIT 1 FOR UPDATE`,
      [input.orderId, input.userId, input.requestRef],
    )
    const request = rows[0]
    if (!request) {
      await connection.rollback()
      return null
    }

    let sendNotification = false
    if (request.payment_id) {
      if (request.payment_id !== input.paymentId) {
        await connection.rollback()
        return null
      }
      if (request.notification_status === "failed" || request.notification_status === "pending") {
        const [updated] = await connection.execute<ResultSetHeader>(
          `UPDATE project_requests SET notification_status = 'sending'
           WHERE id = ? AND notification_status IN ('failed', 'pending')`,
          [request.id],
        )
        sendNotification = updated.affectedRows === 1
      }
    } else {
      const [updated] = await connection.execute<ResultSetHeader>(
        `UPDATE project_requests
         SET payment_id = ?, payment_status = 'paid', status = 'pending', notification_status = 'sending'
         WHERE id = ? AND payment_status = 'pending'`,
        [input.paymentId, request.id],
      )
      if (updated.affectedRows !== 1) {
        await connection.rollback()
        return null
      }
      sendNotification = true
    }

    await connection.commit()
    return {
      requestNumber: request.id,
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
      sendNotification,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function markProjectRequestNotification(requestRef: string, status: "sent" | "failed") {
  const [result] = await getDatabasePool().execute<ResultSetHeader>(
    `UPDATE project_requests SET notification_status = ?
     WHERE request_ref = ? AND payment_status = 'paid'`,
    [status, requestRef],
  )
  if (result.affectedRows !== 1) throw new Error("Could not record project request notification status.")
}
