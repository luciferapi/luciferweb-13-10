import "server-only"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { getWithdrawalPayoutDetailsForUsers, type PayoutDetails } from "@/features/wallet/server/withdrawal-method-store"

const PAGE_LIMIT = 100

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

function getAdminClient() {
  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase admin access is not configured.")
  return client
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
  const client = getAdminClient()
  let requestsQuery = client
    .from("wallet_withdrawal_requests")
    .select("request_id, withdrawal_id, user_id, amount_paise, method_type, payout_destination, payment_reference, owner_response, owner_note, processed_at, status, created_at")
    .order("created_at", { ascending: false })
    .order("request_id", { ascending: false })
    .limit(PAGE_LIMIT)
  if (filter === "pending") requestsQuery = requestsQuery.eq("status", "pending")

  const [requestsResult, pendingCountResult] = await Promise.all([
    requestsQuery,
    client.from("wallet_withdrawal_requests").select("request_id", { count: "exact", head: true }).eq("status", "pending"),
  ])
  if (requestsResult.error) throw requestsResult.error
  if (pendingCountResult.error) throw pendingCountResult.error

  const rows = requestsResult.data ?? []
  const userIds = [...new Set(rows.map((row) => row.user_id))]
  const pendingUserIds = [...new Set(rows.filter((row) => row.status === "pending").map((row) => row.user_id))]
  const [profilesResult, payoutDetailsByUser] = await Promise.all([
    userIds.length
      ? client.from("auth_users").select("id, public_uid, name, email").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    getWithdrawalPayoutDetailsForUsers(pendingUserIds),
  ])
  if (profilesResult.error) throw profilesResult.error
  const profilesByUser = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]))

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

  return {
    requests,
    pendingCount: pendingCountResult.count ?? 0,
    limit: PAGE_LIMIT,
    totalShown: requests.length,
  }
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
  const { data, error } = await getAdminClient().rpc("owner_set_withdrawal_status", {
    p_actor_user_id: input.actorUserId,
    p_request_id: input.requestId,
    p_status: input.status,
    p_external_payment_confirmed: input.externalPaymentConfirmed,
    p_owner_response: input.ownerResponse,
    p_payment_reference: input.paymentReference,
    p_owner_note: input.ownerNote,
  })
  if (error) throw error
  if (typeof data !== "string") throw new Error("The payout status operation returned an invalid result.")
  return data
}
