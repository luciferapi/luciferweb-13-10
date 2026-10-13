import "server-only"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
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

type WalletDepositRow = {
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

function getAdminClient() {
  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase admin access is not configured.")
  return client
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
  const client = getAdminClient()
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await client.from("wallet_deposits").insert({
      deposit_id: generateWalletTransactionId("DEP"),
      payment_id: null,
      order_id: input.orderId,
      user_id: input.userId,
      amount_paise: input.amountPaise,
      currency: "INR",
      status: "pending",
    })
    if (!error) return
    if (error.code === "23505" && attempt < 2) continue
    throw error
  }
}

export async function getWalletDepositForOrder(orderId: string, userId: string): Promise<{
  depositId: string
  amountPaise: number
  status: WalletDepositStatus
  paymentId: string | null
} | null> {
  const { data, error } = await getAdminClient()
    .from("wallet_deposits")
    .select("deposit_id, amount_paise, status, payment_id")
    .eq("order_id", orderId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return data
    ? {
        depositId: data.deposit_id,
        amountPaise: Number(data.amount_paise),
        status: data.status as WalletDepositStatus,
        paymentId: data.payment_id,
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
  const { data, error } = await getAdminClient().rpc("mark_wallet_deposit_paid", {
    p_order_id: input.orderId,
    p_payment_id: input.paymentId,
    p_user_id: input.userId,
    p_amount_paise: input.amountPaise,
    p_payment_details: input.paymentDetails,
  })
  if (error) throw error
  return data === true
}

export async function updatePendingWalletDepositStatus(
  orderId: string,
  userId: string,
  status: "cancelled" | "failed",
): Promise<boolean> {
  const { data, error } = await getAdminClient().rpc("set_pending_wallet_deposit_status", {
    p_order_id: orderId,
    p_user_id: userId,
    p_status: status,
  })
  if (error) throw error
  return data === true
}

export async function listUserWalletDeposits(userId: string): Promise<WalletDeposit[]> {
  const { data, error } = await getAdminClient()
    .from("wallet_deposits")
    .select("deposit_id, payment_id, order_id, user_id, amount_paise, currency, status, created_at, paid_at, payment_details")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("order_id", { ascending: false })
  if (error) throw error
  return ((data ?? []) as WalletDepositRow[]).map((row) => ({
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
