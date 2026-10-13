import "server-only"
import { randomUUID } from "node:crypto"
import { getMysqlPool, selectMysqlRows, withMysqlTransaction } from "@/lib/mysql"
import type { RowDataPacket } from "mysql2"

export const supportStatuses = ["open", "in_progress", "waiting_on_user", "resolved"] as const
export type SupportStatus = (typeof supportStatuses)[number]
export type SupportIssueType = "account" | "payment" | "project" | "api" | "other"
export type SupportTicketMessage = {
  id: string
  role: "customer" | "staff"
  authorName: string
  authorEmail: string | null
  body: string
  createdAt: string
}
export type SupportTicket = {
  id: string
  ticketCode: string
  userId: string
  userName: string
  userEmail: string | null
  publicUid: string | null
  issueType: SupportIssueType
  orderId: string | null
  initialMessage: string
  status: SupportStatus
  createdAt: string
  updatedAt: string
  messages: SupportTicketMessage[]
  escalatedAt?: string | null
  escalatedBy?: string | null
  escalationNote?: string | null
}

const primaryOwnerEmail = "kspgpraveen157@gmail.com"

type TicketRow = RowDataPacket & {
  id: string
  ticket_code: string
  user_id: string
  issue_type: string
  order_id: string | null
  initial_message: string
  status: string
  created_at: Date | string
  updated_at: Date | string
  escalated_at: Date | string | null
  escalated_by: string | null
  escalation_note: string | null
  name?: string | null
  email?: string | null
  public_uid?: string | null
}

function toIsoDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error("A support ticket has an invalid date.")
  return date.toISOString()
}

function isSupportStatus(value: string): value is SupportStatus {
  return supportStatuses.some((status) => status === value)
}

function isSupportIssueType(value: string): value is SupportIssueType {
  return value === "account" || value === "payment" || value === "project" || value === "api" || value === "other"
}

export async function createSupportTicket(input: {
  ticketCode: string
  userId: string
  issueType: SupportIssueType
  orderId: string | null
  message: string
}) {
  const id = randomUUID()
  await getMysqlPool().execute(
    `INSERT INTO support_tickets (id, ticket_code, user_id, issue_type, order_id, initial_message)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.ticketCode, input.userId, input.issueType, input.orderId, input.message],
  )
  return id
}

export async function listSupportTickets(input: {
  userId?: string
  status?: SupportStatus | "all"
  escalatedOnly?: boolean
  includeInternal?: boolean
}) {
  const conditions: string[] = []
  const values: (string | number)[] = []
  if (input.userId) {
    conditions.push("t.user_id = ?")
    values.push(input.userId)
  }
  if (input.status && input.status !== "all") {
    conditions.push("t.status = ?")
    values.push(input.status)
  }
  if (input.escalatedOnly) conditions.push("t.escalated_at IS NOT NULL")
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
  const tickets = await selectMysqlRows<TicketRow>(
    `SELECT t.id, t.ticket_code, t.user_id, t.issue_type, t.order_id, t.initial_message,
            t.status, t.created_at, t.updated_at, t.escalated_at, t.escalated_by,
            t.escalation_note, u.name, u.email, u.public_uid
     FROM support_tickets t
     LEFT JOIN auth_users u ON u.id = t.user_id
     ${where}
     ORDER BY t.updated_at DESC LIMIT 100`,
    values,
  )
  if (tickets.length === 0) return { tickets: [] as SupportTicket[], totalShown: 0, limit: 100 }

  const ticketIds = tickets.map((ticket) => ticket.id)
  const messages = await selectMysqlRows<RowDataPacket & {
    id: string
    ticket_id: string
    author_role: string
    author_name: string
    author_email: string | null
    body: string
    created_at: Date | string
  }>(
    `SELECT id, ticket_id, author_role, author_name, author_email, body, created_at
     FROM support_ticket_messages
     WHERE ticket_id IN (${ticketIds.map(() => "?").join(", ")})
     ORDER BY created_at ASC LIMIT 2000`,
    ticketIds,
  )
  const messagesByTicket = new Map<string, SupportTicketMessage[]>()
  for (const message of messages) {
    if (message.author_role !== "customer" && message.author_role !== "staff") {
      throw new Error(`Support ticket message ${message.id} has an invalid author role.`)
    }
    const group = messagesByTicket.get(message.ticket_id) ?? []
    group.push({
      id: message.id,
      role: message.author_role,
      authorName: message.author_name,
      authorEmail: message.author_email,
      body: message.body,
      createdAt: toIsoDate(message.created_at),
    })
    messagesByTicket.set(message.ticket_id, group)
  }

  const result: SupportTicket[] = tickets.map((ticket) => {
    if (!isSupportIssueType(ticket.issue_type)) throw new Error(`Support ticket ${ticket.ticket_code} has an invalid issue type.`)
    if (!isSupportStatus(ticket.status)) throw new Error(`Support ticket ${ticket.ticket_code} has an invalid status.`)
    const initialMessage: SupportTicketMessage = {
      id: `${ticket.id}:initial`,
      role: "customer",
      authorName: ticket.name ?? "Customer",
      authorEmail: ticket.email ?? null,
      body: ticket.initial_message,
      createdAt: toIsoDate(ticket.created_at),
    }
    return {
      id: ticket.id,
      ticketCode: ticket.ticket_code,
      userId: ticket.user_id,
      userName: ticket.name ?? "Deleted account",
      userEmail: ticket.email ?? null,
      publicUid: ticket.public_uid ?? null,
      issueType: ticket.issue_type,
      orderId: ticket.order_id,
      initialMessage: ticket.initial_message,
      status: ticket.status,
      createdAt: toIsoDate(ticket.created_at),
      updatedAt: toIsoDate(ticket.updated_at),
      messages: [initialMessage, ...(messagesByTicket.get(ticket.id) ?? [])],
      ...(input.includeInternal ? {
        escalatedAt: ticket.escalated_at ? toIsoDate(ticket.escalated_at) : null,
        escalatedBy: ticket.escalated_by,
        escalationNote: ticket.escalation_note,
      } : {}),
    }
  })
  return { tickets: result, totalShown: result.length, limit: 100 }
}

export async function getSupportTicketIdentity(ticketId: string) {
  const rows = await selectMysqlRows<TicketRow>(
    `SELECT t.id, t.ticket_code, t.user_id, t.issue_type, t.status, t.escalated_at, u.name, u.email
     FROM support_tickets t LEFT JOIN auth_users u ON u.id = t.user_id
     WHERE t.id = ? LIMIT 1`,
    [ticketId],
  )
  const ticket = rows[0]
  if (!ticket) return null
  if (!ticket.email) throw new Error("The support ticket customer has no account email.")
  if (!isSupportIssueType(ticket.issue_type)) throw new Error(`Support ticket ${ticket.ticket_code} has an invalid issue type.`)
  if (!isSupportStatus(ticket.status)) throw new Error(`Support ticket ${ticket.ticket_code} has an invalid status.`)
  return {
    id: ticket.id,
    ticketCode: ticket.ticket_code,
    userId: ticket.user_id,
    userName: ticket.name ?? "Customer",
    userEmail: ticket.email,
    issueType: ticket.issue_type,
    status: ticket.status,
    escalatedAt: ticket.escalated_at ? toIsoDate(ticket.escalated_at) : null,
  }
}

export async function updateSupportTicket(input: {
  ticketId: string
  actorUserId: string
  authorRole: "customer" | "staff"
  authorName: string
  authorEmail: string | null
  body: string | null
  status: SupportStatus | null
}) {
  if (input.body !== null && (input.body.trim().length < 1 || input.body.trim().length > 5000)) return "invalid_message"
  if (input.status !== null && !isSupportStatus(input.status)) return "invalid_status"
  if (input.body === null && input.status === null) return "invalid_message"

  return withMysqlTransaction(async (connection) => {
    const [ticketRows] = await connection.execute<RowDataPacket[]>(
      "SELECT user_id FROM support_tickets WHERE id = ? LIMIT 1 FOR UPDATE",
      [input.ticketId],
    )
    const ticket = ticketRows[0] as { user_id: string } | undefined
    if (!ticket) return "not_found"
    const [actorRows] = await connection.execute<RowDataPacket[]>(
      `SELECT u.email, u.is_blocked, a.allowed_modules
       FROM auth_users u LEFT JOIN owner_admins a ON a.user_id = u.id
       WHERE u.id = ? LIMIT 1`,
      [input.actorUserId],
    )
    const actor = actorRows[0] as {
      email: string | null
      is_blocked: boolean | number
      allowed_modules: string[] | string | null
    } | undefined
    if (!actor || Boolean(actor.is_blocked)) return "unauthorized"

    if (input.authorRole === "customer") {
      if (ticket.user_id !== input.actorUserId || input.status !== null) return "unauthorized"
    } else {
      let modules: unknown = actor.allowed_modules
      if (typeof modules === "string") modules = JSON.parse(modules)
      const authorized = actor.email?.toLowerCase() === primaryOwnerEmail ||
        (Array.isArray(modules) && (modules.includes("support") || modules.includes("escalations")))
      if (!authorized || !input.status) return "unauthorized"
    }

    if (input.body !== null) {
      await connection.execute(
        `INSERT INTO support_ticket_messages
          (id, ticket_id, author_user_id, author_role, author_name, author_email, body)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          input.ticketId,
          input.actorUserId,
          input.authorRole,
          input.authorName.trim().slice(0, 100),
          input.authorEmail?.trim().toLowerCase() ?? null,
          input.body.trim(),
        ],
      )
    }
    const nextStatus = input.status ?? "open"
    await connection.execute(
      "UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
      [nextStatus, input.ticketId],
    )
    return "updated"
  })
}

export async function forwardSupportTicket(input: {
  ticketId: string
  actorUserId: string
  note: string
}) {
  const note = input.note.trim()
  if (note.length < 3 || note.length > 1000) return "invalid_note"
  return withMysqlTransaction(async (connection) => {
    const [actorRows] = await connection.execute<RowDataPacket[]>(
      `SELECT u.email, u.is_blocked, a.allowed_modules
       FROM auth_users u LEFT JOIN owner_admins a ON a.user_id = u.id
       WHERE u.id = ? LIMIT 1 FOR UPDATE`,
      [input.actorUserId],
    )
    const actor = actorRows[0] as {
      email: string | null
      is_blocked: boolean | number
      allowed_modules: string[] | string | null
    } | undefined
    if (!actor || Boolean(actor.is_blocked)) return "unauthorized"
    let modules: unknown = actor.allowed_modules
    if (typeof modules === "string") modules = JSON.parse(modules)
    const authorized = actor.email?.toLowerCase() === primaryOwnerEmail ||
      (Array.isArray(modules) && modules.includes("support"))
    if (!authorized) return "unauthorized"

    const [ticketRows] = await connection.execute<RowDataPacket[]>(
      "SELECT user_id, escalated_at FROM support_tickets WHERE id = ? LIMIT 1 FOR UPDATE",
      [input.ticketId],
    )
    const ticket = ticketRows[0] as { user_id: string; escalated_at: Date | string | null } | undefined
    if (!ticket) return "not_found"
    if (ticket.escalated_at) return "already_forwarded"

    await connection.execute(
      `UPDATE support_tickets
       SET escalated_at = CURRENT_TIMESTAMP(3), escalated_by = ?, escalation_note = ?,
           updated_at = CURRENT_TIMESTAMP(3)
       WHERE id = ?`,
      [input.actorUserId, note, input.ticketId],
    )
    await connection.execute(
      `INSERT INTO owner_audit_logs (actor_user_id, action, subject_user_id, details)
       VALUES (?, 'support.ticket_forwarded', ?, ?)`,
      [input.actorUserId, ticket.user_id, JSON.stringify({ ticketId: input.ticketId, note })],
    )
    return "forwarded"
  })
}
