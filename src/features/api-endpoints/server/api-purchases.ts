import "server-only"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

export type ApiEndpointPurchase = {
  orderId: string
  paymentId: string | null
  userId: string
  endpointId: string
  endpointName: string
  amountPaise: number
  status: "pending" | "paid" | "cancelled" | "expired" | "failed"
}

type ApiEndpointPurchaseRow = {
  order_id: string
  payment_id: string | null
  user_id: string
  endpoint_id: string
  endpoint_name: string
  amount_paise: number | string
  status: ApiEndpointPurchase["status"]
}

function getAdminClient() {
  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase admin access is not configured.")
  return client
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

const purchaseColumns = "order_id, payment_id, user_id, endpoint_id, endpoint_name, amount_paise, status"

export async function listPaidApiEndpointIds(userId: string): Promise<string[]> {
  const { data, error } = await getAdminClient()
    .from("api_endpoint_purchases")
    .select("endpoint_id")
    .eq("user_id", userId)
    .eq("status", "paid")
    .limit(500)

  if (error) throw error
  return [...new Set((data ?? []).map((row) => row.endpoint_id))]
}

export async function hasPaidApiEndpointAccess(userId: string, endpointId: string): Promise<boolean> {
  const { data, error } = await getAdminClient()
    .from("api_endpoint_purchases")
    .select("order_id")
    .eq("user_id", userId)
    .eq("endpoint_id", endpointId)
    .eq("status", "paid")
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

export async function savePendingApiEndpointPurchase(purchase: {
  orderId: string
  userId: string
  endpointId: string
  endpointName: string
  amountPaise: number
}): Promise<boolean> {
  const { data, error } = await getAdminClient()
    .from("api_endpoint_purchases")
    .insert({
      order_id: purchase.orderId,
      user_id: purchase.userId,
      endpoint_id: purchase.endpointId,
      endpoint_name: purchase.endpointName,
      amount_paise: purchase.amountPaise,
      currency: "INR",
      status: "pending",
    })
    .select("order_id")
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

export async function getApiEndpointPurchase(orderId: string, userId: string): Promise<ApiEndpointPurchase | null> {
  const { data, error } = await getAdminClient()
    .from("api_endpoint_purchases")
    .select(purchaseColumns)
    .eq("order_id", orderId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw error
  return data ? toPurchase(data as ApiEndpointPurchaseRow) : null
}

export async function savePaidApiEndpointPurchase(purchase: {
  paymentId: string
  orderId: string
  userId: string
  endpointId: string
  amountPaise: number
}): Promise<boolean> {
  const client = getAdminClient()
  const { data, error } = await client
    .from("api_endpoint_purchases")
    .update({ payment_id: purchase.paymentId, status: "paid", purchased_at: new Date().toISOString() })
    .eq("order_id", purchase.orderId)
    .eq("user_id", purchase.userId)
    .eq("endpoint_id", purchase.endpointId)
    .eq("amount_paise", purchase.amountPaise)
    .in("status", ["pending", "cancelled", "expired", "failed"])
    .select("order_id")

  if (error) throw error
  if ((data?.length ?? 0) > 0) return true

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
  const client = getAdminClient()
  const { data, error } = await client
    .from("api_endpoint_purchases")
    .update({ status })
    .eq("order_id", orderId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("order_id")

  if (error) throw error
  if ((data?.length ?? 0) > 0) return true

  const existing = await getApiEndpointPurchase(orderId, userId)
  return existing?.status === status
}
