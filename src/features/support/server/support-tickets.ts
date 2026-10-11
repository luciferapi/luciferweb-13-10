import "server-only"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

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

function getAdminClient() {
  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase admin access is not configured.")
  return client
}

function toIsoDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error("A support ticket has an invalid date.")
  return date.toISOString()
}

export async function createSupportTicket(input: {
  ticketCode: string
  userId: string
  issueType: SupportIssueType
  orderId: string | null
  message: string
}) {
  const { data, error } = await getAdminClient()
    .from("support_tickets")
    .insert({
      ticket_code: input.ticketCode,
      user_id: input.userId,
      issue_type: input.issueType,
      order_id: input.orderId,
      initial_message: input.message,
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export async function listSupportTickets(input: {
  userId?: string
  status?: SupportStatus | "all"
  escalatedOnly?: boolean
  includeInternal?: boolean
}) {
  const client = getAdminClient()
  let ticketQuery = client
    .from("support_tickets")
    .select("id, ticket_code, user_id, issue_type, order_id, initial_message, status, created_at, updated_at, escalated_at, escalated_by, escalation_note")
    .order("updated_at", { ascending: false })
    .limit(100)
  if (input.userId) ticketQuery = ticketQuery.eq("user_id", input.userId)
  if (input.status && input.status !== "all") ticketQuery = ticketQuery.eq("status", input.status)
  if (input.escalatedOnly) ticketQuery = ticketQuery.not("escalated_at", "is", null)
  const { data: tickets, error: ticketsError } = await ticketQuery
  if (ticketsError) throw ticketsError

  const rows = tickets ?? []
  if (rows.length === 0) return { tickets: [] as SupportTicket[], totalShown: 0, limit: 100 }
  const ticketIds = rows.map((ticket) => ticket.id)
  const userIds = [...new Set(rows.map((ticket) => ticket.user_id))]
  const [messagesResult, profilesResult] = await Promise.all([
    client
      .from("support_ticket_messages")
      .select("id, ticket_id, author_role, author_name, author_email, body, created_at")
      .in("ticket_id", ticketIds)
      .order("created_at", { ascending: true })
      .limit(2000),
    client
      .from("auth_users")
      .select("id, name, email, public_uid")
      .in("id", userIds),
  ])
  if (messagesResult.error) throw messagesResult.error
  if (profilesResult.error) throw profilesResult.error

  const messagesByTicket = new Map<string, SupportTicketMessage[]>()
  for (const message of messagesResult.data ?? []) {
    if (message.author_role !== "customer" && message.author_role !== "staff") {
      throw new Error(`Support ticket message ${message.id} has an invalid author role.`)
    }
    const ticketMessages = messagesByTicket.get(message.ticket_id) ?? []
    ticketMessages.push({
      id: message.id,
      role: message.author_role,
      authorName: message.author_name,
      authorEmail: message.author_email,
      body: message.body,
      createdAt: toIsoDate(message.created_at),
    })
    messagesByTicket.set(message.ticket_id, ticketMessages)
  }
  const profilesById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]))

  const result: SupportTicket[] = rows.map((ticket) => {
    if (!["account", "payment", "project", "api", "other"].includes(ticket.issue_type)) {
      throw new Error(`Support ticket ${ticket.ticket_code} has an invalid issue type.`)
    }
    if (!supportStatuses.includes(ticket.status as SupportStatus)) {
      throw new Error(`Support ticket ${ticket.ticket_code} has an invalid status.`)
    }
    const profile = profilesById.get(ticket.user_id)
    const initialMessage: SupportTicketMessage = {
      id: `${ticket.id}:initial`,
      role: "customer",
      authorName: profile?.name ?? "Customer",
      authorEmail: profile?.email ?? null,
      body: ticket.initial_message,
      createdAt: toIsoDate(ticket.created_at),
    }
    return {
      id: ticket.id,
      ticketCode: ticket.ticket_code,
      userId: ticket.user_id,
      userName: profile?.name ?? "Deleted account",
      userEmail: profile?.email ?? null,
      publicUid: profile?.public_uid ?? null,
      issueType: ticket.issue_type as SupportIssueType,
      orderId: ticket.order_id,
      initialMessage: ticket.initial_message,
      status: ticket.status as SupportStatus,
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
  const client = getAdminClient()
  const { data: ticket, error: ticketError } = await client
    .from("support_tickets")
    .select("id, ticket_code, user_id, issue_type, status, escalated_at")
    .eq("id", ticketId)
    .maybeSingle()
  if (ticketError) throw ticketError
  if (!ticket) return null

  const { data: profile, error: profileError } = await client
    .from("auth_users")
    .select("name, email")
    .eq("id", ticket.user_id)
    .maybeSingle()
  if (profileError) throw profileError
  if (!profile?.email) throw new Error("The support ticket customer has no account email.")

  return {
    id: ticket.id,
    ticketCode: ticket.ticket_code,
    userId: ticket.user_id,
    userName: profile.name,
    userEmail: profile.email,
    issueType: ticket.issue_type as SupportIssueType,
    status: ticket.status as SupportStatus,
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
  const { data, error } = await getAdminClient().rpc("support_update_ticket", {
    p_ticket_id: input.ticketId,
    p_actor_user_id: input.actorUserId,
    p_author_role: input.authorRole,
    p_author_name: input.authorName,
    p_author_email: input.authorEmail,
    p_body: input.body,
    p_status: input.status,
  })
  if (error) throw error
  if (typeof data !== "string") throw new Error("The support ticket update returned an invalid result.")
  return data
}

export async function forwardSupportTicket(input: {
  ticketId: string
  actorUserId: string
  note: string
}) {
  const { data, error } = await getAdminClient().rpc("owner_forward_support_ticket", {
    p_ticket_id: input.ticketId,
    p_actor_user_id: input.actorUserId,
    p_escalation_note: input.note,
  })
  if (error) throw error
  if (typeof data !== "string") throw new Error("The support escalation returned an invalid result.")
  return data
}
