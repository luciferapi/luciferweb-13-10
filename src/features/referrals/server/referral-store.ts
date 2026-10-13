import "server-only"
import { randomBytes } from "node:crypto"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import type { ReferralEntry, ReferralProgram, ReferralStatus } from "@/features/referrals/server/referral-types"

export type { ReferralEntry, ReferralProgram, ReferralStatus } from "@/features/referrals/server/referral-types"

type ReferralRow = {
  id: string
  referrer_id: string
  referee_id: string
  name: string
  email: string
  status: ReferralStatus
  status_reason: string | null
  depth: number
  created_at: Date | string
  signup_at: Date | string
}

type ReferralProgramRow = {
  referrer_reward_type: "fixed" | "percentage"
  referrer_reward_amount: number | string
  referrer_reward_currency: string
  referee_reward_type: "fixed" | "percentage"
  referee_reward_amount: number | string
  referee_reward_currency: string
  min_purchase_amount: number | string | null
  valid_until: Date | string | null
  max_referrals: number | string | null
}

function getAdminClient() {
  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase admin access is not configured.")
  return client
}

export async function findReferralOwner(code: string): Promise<string | null> {
  const { data, error } = await getAdminClient()
    .from("referral_profiles")
    .select("user_id")
    .eq("referral_code", code.trim().toUpperCase())
    .maybeSingle()
  if (error) throw error
  return data?.user_id ?? null
}

export async function isReferralCodeAvailable(code: string): Promise<boolean> {
  const client = getAdminClient()
  const owner = await client
    .from("referral_profiles")
    .select("user_id")
    .eq("referral_code", code.trim().toUpperCase())
    .maybeSingle()
  if (owner.error) throw owner.error
  if (!owner.data) return false

  const [settings, referrals] = await Promise.all([
    client
      .from("referral_program_settings")
      .select("max_referrals, valid_until")
      .eq("program_id", 1)
      .maybeSingle(),
    client
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", owner.data.user_id),
  ])
  if (settings.error) throw settings.error
  if (referrals.error) throw referrals.error
  if (!settings.data) return false

  const notExpired = settings.data.valid_until === null ||
    new Date(settings.data.valid_until).getTime() > Date.now()
  return Boolean(
    notExpired &&
    (settings.data.max_referrals === null || (referrals.count ?? 0) < Number(settings.data.max_referrals)),
  )
}

export async function getReferralProgram(): Promise<ReferralProgram> {
  const { data: row, error } = await getAdminClient()
    .from("referral_program_settings")
    .select("referrer_reward_type, referrer_reward_amount, referrer_reward_currency, referee_reward_type, referee_reward_amount, referee_reward_currency, min_purchase_amount, valid_until, max_referrals")
    .eq("program_id", 1)
    .maybeSingle()
  if (error) throw error
  if (!row) throw new Error("The referral program settings have not been initialized.")

  const settings = row as ReferralProgramRow
  return {
    referrerReward: {
      type: settings.referrer_reward_type,
      amount: Number(settings.referrer_reward_amount),
      currency: settings.referrer_reward_currency,
    },
    refereeReward: {
      type: settings.referee_reward_type,
      amount: Number(settings.referee_reward_amount),
      currency: settings.referee_reward_currency,
    },
    conditions: {
      minPurchaseAmount: settings.min_purchase_amount === null ? null : Number(settings.min_purchase_amount),
      validUntil: settings.valid_until ? new Date(settings.valid_until).toISOString() : null,
      maxReferrals: settings.max_referrals === null ? null : Number(settings.max_referrals),
    },
  }
}

export async function updateReferralProgram(program: ReferralProgram): Promise<void> {
  const validUntil = program.conditions.validUntil
    ? new Date(program.conditions.validUntil)
    : null
  if (validUntil && Number.isNaN(validUntil.getTime())) throw new Error("The program expiry date is invalid.")

  const { error } = await getAdminClient()
    .from("referral_program_settings")
    .update({
      referrer_reward_type: program.referrerReward.type,
      referrer_reward_amount: program.referrerReward.amount,
      referrer_reward_currency: "INR",
      referee_reward_type: program.refereeReward.type,
      referee_reward_amount: program.refereeReward.amount,
      referee_reward_currency: "INR",
      min_purchase_amount: program.conditions.minPurchaseAmount,
      valid_until: validUntil?.toISOString() ?? null,
      max_referrals: program.conditions.maxReferrals,
    })
    .eq("program_id", 1)
  if (error) throw error
}

export async function createReferralCode(userId: string): Promise<string> {
  const client = getAdminClient()
  const { data: existing, error: lookupError } = await client
    .from("referral_profiles")
    .select("referral_code")
    .eq("user_id", userId)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (existing) return existing.referral_code

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomBytes(6).toString("hex").toUpperCase()
    const { error } = await client.from("referral_profiles").insert({ user_id: userId, referral_code: code })
    if (!error) return code
    if (error.code !== "23505") throw error

    const { data: concurrentProfile, error: concurrentLookupError } = await client
      .from("referral_profiles")
      .select("referral_code")
      .eq("user_id", userId)
      .maybeSingle()
    if (concurrentLookupError) throw concurrentLookupError
    if (concurrentProfile) return concurrentProfile.referral_code
  }
  throw new Error("Could not generate a unique referral code.")
}

export async function getUserReferralTree(userId: string): Promise<{ code: string; referrals: ReferralEntry[] }> {
  const code = await createReferralCode(userId)
  const { data, error } = await getAdminClient().rpc("get_user_referral_tree", {
    p_user_id: userId,
  })
  if (error) throw error
  const rows = (data ?? []) as ReferralRow[]
  return {
    code,
    referrals: rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      statusReason: row.status_reason,
      depth: Number(row.depth),
      createdAt: new Date(row.created_at).toISOString(),
      signupAt: new Date(row.signup_at).toISOString(),
    })),
  }
}

export async function listAllReferrals(): Promise<ReferralEntry[]> {
  const client = getAdminClient()
  const { data: referrals, error: referralsError } = await client
    .from("referrals")
    .select("id, referrer_id, referee_id, status, status_reason, created_at")
    .order("created_at", { ascending: false })
  if (referralsError) throw referralsError
  if (!referrals?.length) return []

  const refereeIds = [...new Set(referrals.map((row) => row.referee_id))]
  const { data: users, error: usersError } = await client
    .from("auth_users")
    .select("id, name, email, created_at")
    .in("id", refereeIds)
  if (usersError) throw usersError
  const usersById = new Map((users ?? []).map((user) => [user.id, user]))

  return referrals.flatMap((row) => {
    const user = usersById.get(row.referee_id)
    if (!user) return []
    return [{
      id: row.id,
      name: `${user.name} (${user.email})`,
      status: row.status as ReferralStatus,
      statusReason: row.status_reason,
      depth: 0,
      createdAt: new Date(row.created_at).toISOString(),
      signupAt: new Date(user.created_at).toISOString(),
    }]
  })
}

export async function updateReferralStatus(id: string, status: ReferralStatus, reason: string | null): Promise<boolean> {
  const { data, error } = await getAdminClient()
    .from("referrals")
    .update({ status, status_reason: reason, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
  if (error) throw error
  return (data?.length ?? 0) === 1
}
