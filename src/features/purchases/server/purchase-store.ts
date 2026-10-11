import "server-only"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

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

type PurchaseRow = {
  payment_id: string | null
  order_id: string
  project_code: string
  project_title: string
  amount_paise: number | string
  currency: string
  status: ProjectPurchase["status"]
  purchased_at: string | Date
}

function getAdminClient() {
  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase admin access is not configured.")
  return client
}

export async function savePendingProjectPurchase(purchase: {
  orderId: string
  userId: string
  projectCode: string
  projectTitle: string
  amountPaise: number
}): Promise<boolean> {
  const { data, error } = await getAdminClient()
    .from("project_purchases")
    .insert({
      payment_id: null,
      order_id: purchase.orderId,
      user_id: purchase.userId,
      project_code: purchase.projectCode,
      project_title: purchase.projectTitle,
      amount_paise: purchase.amountPaise,
      currency: "INR",
      status: "pending",
    })
    .select("order_id")
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

export async function saveProjectPurchase(purchase: {
  paymentId: string
  orderId: string
  userId: string
  projectCode: string
  projectTitle: string
  amountPaise: number
}): Promise<boolean> {
  const { data, error } = await getAdminClient().rpc("mark_project_purchase_paid", {
    p_payment_id: purchase.paymentId,
    p_order_id: purchase.orderId,
    p_user_id: purchase.userId,
    p_project_code: purchase.projectCode,
    p_project_title: purchase.projectTitle,
    p_amount_paise: purchase.amountPaise,
  })

  if (error) throw error
  return data === true
}

export async function listPendingProjectPurchases(userId: string): Promise<string[]> {
  const { data, error } = await getAdminClient()
    .from("project_purchases")
    .select("order_id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("purchased_at", { ascending: false })
    .limit(100)

  if (error) throw error
  return (data ?? []).map((row) => row.order_id)
}

async function markPendingPurchase(orderId: string, userId: string, status: "cancelled" | "failed"): Promise<boolean> {
  const client = getAdminClient()
  const { data: updated, error: updateError } = await client
    .from("project_purchases")
    .update({ status })
    .eq("order_id", orderId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("order_id")

  if (updateError) throw updateError
  if ((updated?.length ?? 0) > 0) return true

  const { data: existing, error: selectError } = await client
    .from("project_purchases")
    .select("status")
    .eq("order_id", orderId)
    .eq("user_id", userId)
    .maybeSingle()

  if (selectError) throw selectError
  return existing?.status === status
}

export async function markProjectPurchaseCancelled(orderId: string, userId: string): Promise<boolean> {
  return markPendingPurchase(orderId, userId, "cancelled")
}

export async function markProjectPurchaseExpired(orderId: string, userId: string): Promise<void> {
  const { error } = await getAdminClient()
    .from("project_purchases")
    .update({ status: "expired" })
    .eq("order_id", orderId)
    .eq("user_id", userId)
    .eq("status", "pending")

  if (error) throw error
}

export async function markProjectPurchaseFailed(orderId: string, userId: string): Promise<boolean> {
  return markPendingPurchase(orderId, userId, "failed")
}

export async function listUserProjectPurchases(userId: string): Promise<ProjectPurchase[]> {
  const { data, error } = await getAdminClient()
    .from("project_purchases")
    .select("payment_id, order_id, project_code, project_title, amount_paise, currency, status, purchased_at")
    .eq("user_id", userId)
    .order("purchased_at", { ascending: false })
    .order("order_id", { ascending: false })

  if (error) throw error
  return ((data ?? []) as PurchaseRow[]).map((row) => ({
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
