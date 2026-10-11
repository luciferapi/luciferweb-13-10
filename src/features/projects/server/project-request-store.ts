import "server-only"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

export const PROJECT_REQUEST_FEE_PAISE = 100

type PaidProjectRequestRow = {
  request_number: number | string
  request_ref: string
  user_id: string
  project_name: string
  description: string
  contact_email: string | null
  whatsapp_number: string | null
  telegram_id: string | null
  preferred_language: string | null
  desired_duration: string | null
  send_notification: boolean
}

function getAdminClient() {
  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase admin access is not configured.")
  return client
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
  const { data, error } = await getAdminClient()
    .from("project_requests")
    .insert({
      request_ref: input.requestRef,
      user_id: input.userId,
      project_name: input.projectName,
      description: input.description,
      contact_email: input.contactEmail || null,
      whatsapp_number: input.whatsappNumber || null,
      telegram_id: input.telegramId || null,
      preferred_language: input.preferredLanguage || null,
      desired_duration: input.desiredDuration || null,
      order_id: input.orderId,
      payment_amount_paise: PROJECT_REQUEST_FEE_PAISE,
    })
    .select("request_ref")
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error("The project request payment was not recorded.")
}

export async function listPaidProjectRequests() {
  const { data, error } = await getAdminClient()
    .from("project_requests")
    .select("id, project_name, description, contact_email, whatsapp_number, telegram_id, preferred_language, desired_duration, payment_amount_paise, created_at")
    .eq("payment_status", "paid")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) throw error
  return (data ?? []).map((request) => ({
    id: Number(request.id),
    projectName: request.project_name,
    description: request.description,
    contactEmail: request.contact_email,
    whatsappNumber: request.whatsapp_number,
    telegramId: request.telegram_id,
    preferredLanguage: request.preferred_language,
    desiredDuration: request.desired_duration,
    paymentAmountPaise: request.payment_amount_paise,
    createdAt: request.created_at,
  }))
}

export async function markProjectRequestCancelled(orderId: string, userId: string, status: "cancelled" | "failed") {
  const { data, error } = await getAdminClient()
    .from("project_requests")
    .update({ payment_status: status, status })
    .eq("order_id", orderId)
    .eq("user_id", userId)
    .eq("payment_status", "pending")
    .select("request_ref")

  if (error) throw error
  return (data?.length ?? 0) > 0
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
  const client = getAdminClient()
  const { data: user, error: userError } = await client
    .from("auth_users")
    .select("email")
    .eq("id", input.userId)
    .maybeSingle()
  if (userError) throw userError
  if (!user?.email) return null

  const { data, error } = await client.rpc("mark_project_request_paid", {
    p_order_id: input.orderId,
    p_payment_id: input.paymentId,
    p_user_id: input.userId,
    p_request_ref: input.requestRef,
  })

  if (error) throw error
  const request = (Array.isArray(data) ? data[0] : data) as PaidProjectRequestRow | null
  if (!request) return null

  return {
    requestNumber: Number(request.request_number),
    requestRef: request.request_ref,
    userId: request.user_id,
    email: user.email,
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
  const { data, error } = await getAdminClient()
    .from("project_requests")
    .update({ notification_status: status })
    .eq("request_ref", requestRef)
    .eq("payment_status", "paid")
    .select("request_ref")

  if (error) throw error
  if ((data?.length ?? 0) !== 1) throw new Error("Could not record project request notification status.")
}
