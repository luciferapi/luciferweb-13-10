import "server-only"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const PAGE_SIZE = 25

export type OwnerUser = {
  id: string
  publicUid: string
  name: string
  email: string | null
  dateOfBirth: string | null
  telegramUsername: string | null
  xUsername: string | null
  nameEditUsed: boolean
  dateOfBirthEditUsed: boolean
  isBlocked: boolean
  blockedAt: string | null
  createdAt: string
  providers: string[]
  isOwnerAdmin: boolean
  referrals: { uid: string; publicUid: string }[]
  walletBalancePaise: number
}

function getAdminClient() {
  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase admin access is not configured.")
  return client
}

function normalizeDate(value: string | null): string | null {
  return value ? value.slice(0, 10) : null
}

function normalizeSearch(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}@._+\- ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
}

export async function listOwnerUsers(page: number, search: string, status: "all" | "active" | "blocked") {
  const client = getAdminClient()
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  let query = client
    .from("auth_users")
    .select(
      "id, public_uid, name, email, date_of_birth, telegram_username, x_username, name_edit_used, date_of_birth_edit_used, is_blocked, blocked_at, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to)

  const term = normalizeSearch(search)
  if (term) {
    const pattern = `*${term}*`
    query = query.or([
      `name.ilike.${pattern}`,
      `email.ilike.${pattern}`,
      `public_uid.ilike.${pattern}`,
      `telegram_username.ilike.${pattern}`,
      `x_username.ilike.${pattern}`,
    ].join(","))
  }
  if (status === "active") query = query.eq("is_blocked", false)
  if (status === "blocked") query = query.eq("is_blocked", true)

  const [{ data, error, count }, totalResult, activeResult, blockedResult] = await Promise.all([
    query,
    client.from("auth_users").select("id", { count: "exact", head: true }),
    client.from("auth_users").select("id", { count: "exact", head: true }).eq("is_blocked", false),
    client.from("auth_users").select("id", { count: "exact", head: true }).eq("is_blocked", true),
  ])

  if (error) throw error
  if (totalResult.error) throw totalResult.error
  if (activeResult.error) throw activeResult.error
  if (blockedResult.error) throw blockedResult.error

  const rows = data ?? []
  const userIds = rows.map((row) => row.id)
  const [identityResult, adminResult, referralResult, walletResult] = await Promise.all([
    userIds.length
      ? client.from("auth_identities").select("user_id, provider").in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? client.from("owner_admins").select("user_id").in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? client.from("referrals").select("referrer_id, referee_id").in("referrer_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? client.rpc("owner_user_wallet_balances", { p_user_ids: userIds })
      : Promise.resolve({ data: [], error: null }),
  ])
  if (identityResult.error) throw identityResult.error
  if (adminResult.error) throw adminResult.error
  if (referralResult.error) throw referralResult.error
  if (walletResult.error) throw walletResult.error

  const providersByUser = new Map<string, Set<string>>()
  for (const identity of identityResult.data ?? []) {
    const providers = providersByUser.get(identity.user_id) ?? new Set<string>()
    providers.add(identity.provider)
    providersByUser.set(identity.user_id, providers)
  }
  const adminIds = new Set((adminResult.data ?? []).map((admin) => admin.user_id))
  const referralsByUser = new Map<string, { uid: string; publicUid: string }[]>()
  const referralRows = referralResult.data ?? []
  const refereeIds = [...new Set(referralRows.map((referral) => referral.referee_id))]
  const { data: refereeProfiles, error: refereeProfilesError } = refereeIds.length
    ? await client.from("auth_users").select("id, public_uid").in("id", refereeIds)
    : { data: [], error: null }
  if (refereeProfilesError) throw refereeProfilesError

  const publicUidByRefereeId = new Map((refereeProfiles ?? []).map((profile) => [profile.id, profile.public_uid]))
  for (const referral of referralRows) {
    const publicUid = publicUidByRefereeId.get(referral.referee_id)
    if (!publicUid) continue
    const referredUsers = referralsByUser.get(referral.referrer_id) ?? []
    referredUsers.push({ uid: referral.referee_id, publicUid })
    referralsByUser.set(referral.referrer_id, referredUsers)
  }

  const walletBalanceByUser = new Map<string, number>()
  for (const wallet of walletResult.data ?? []) {
    const balance = Number(wallet.balance_paise)
    if (!Number.isSafeInteger(balance)) {
      throw new Error(`Wallet balance for user ${wallet.user_id} is outside the supported integer range.`)
    }
    walletBalanceByUser.set(wallet.user_id, Math.max(0, balance))
  }

  const users: OwnerUser[] = rows.map((row) => ({
    id: row.id,
    publicUid: row.public_uid,
    name: row.name,
    email: row.email,
    dateOfBirth: normalizeDate(row.date_of_birth),
    telegramUsername: row.telegram_username,
    xUsername: row.x_username,
    nameEditUsed: Boolean(row.name_edit_used),
    dateOfBirthEditUsed: Boolean(row.date_of_birth_edit_used),
    isBlocked: Boolean(row.is_blocked),
    blockedAt: row.blocked_at,
    createdAt: row.created_at,
    providers: [...(providersByUser.get(row.id) ?? [])].sort(),
    isOwnerAdmin: adminIds.has(row.id),
    referrals: referralsByUser.get(row.id) ?? [],
    walletBalancePaise: walletBalanceByUser.get(row.id) ?? 0,
  }))

  return {
    users,
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    stats: {
      total: totalResult.count ?? 0,
      active: activeResult.count ?? 0,
      blocked: blockedResult.count ?? 0,
    },
  }
}

export async function updateOwnerUser(
  actorUserId: string,
  id: string,
  fields: {
    name: string
    email: string | null
    dateOfBirth: string | null
    telegramUsername: string | null
    xUsername: string | null
  },
): Promise<"updated" | "not_found" | "primary_owner" | "email_required"> {
  const client = getAdminClient()
  const { data: current, error: currentError } = await client
    .from("auth_users")
    .select("id, email, name")
    .eq("id", id)
    .maybeSingle()
  if (currentError) throw currentError
  if (!current) return "not_found"

  const { data: adminRecord, error: adminError } = await client
    .from("owner_admins")
    .select("user_id")
    .eq("user_id", id)
    .maybeSingle()
  if (adminError) throw adminError

  const isPrimaryOwner = current.email?.toLowerCase() === "kspgpraveen157@gmail.com"
  if (isPrimaryOwner && fields.email?.toLowerCase() !== current.email?.toLowerCase()) return "primary_owner"

  const { data: identity, error: identityError } = await client
    .from("auth_identities")
    .select("provider_user_id")
    .eq("user_id", id)
    .eq("provider", "supabase")
    .maybeSingle()
  if (identityError) throw identityError

  if (identity && !fields.email) return "email_required"

  if (fields.email && fields.email.toLowerCase() !== current.email?.toLowerCase()) {
    const { data: duplicate, error: duplicateError } = await client
      .from("auth_users")
      .select("id")
      .ilike("email", fields.email)
      .neq("id", id)
      .maybeSingle()
    if (duplicateError) throw duplicateError
    if (duplicate) throw new Error("That email address is already assigned to another user.")
  }

  let authEmailUpdated = false
  if (identity && fields.email !== current.email) {
    const supabaseAuthId = identity.provider_user_id
    const { error: authUpdateError } = await client.auth.admin.updateUserById(supabaseAuthId, {
      email: fields.email!,
      email_confirm: true,
    })
    if (authUpdateError) throw authUpdateError
    authEmailUpdated = true
  }

  const { data: updated, error: updateError } = await client
    .from("auth_users")
    .update({
      name: fields.name,
      email: fields.email,
      date_of_birth: fields.dateOfBirth,
      telegram_username: fields.telegramUsername,
      x_username: fields.xUsername,
    })
    .eq("id", id)
    .select("id")

  if (updateError) {
    if (authEmailUpdated && current.email) {
      const { error: rollbackError } = await client.auth.admin.updateUserById(identity!.provider_user_id, {
        email: current.email,
        email_confirm: true,
      })
      if (rollbackError) {
        console.error("Could not restore the Supabase Auth email after a profile update failed.", rollbackError)
      }
    }
    if ("code" in updateError && updateError.code === "23505") {
      throw new Error("That email address is already assigned to another user.")
    }
    throw updateError
  }

  if (!updated?.length) return "not_found"

  const { error: auditError } = await client.from("owner_audit_logs").insert({
    actor_user_id: actorUserId,
    action: "user.profile_updated",
    subject_user_id: id,
    details: {
      emailChanged: fields.email !== current.email,
      nameChanged: fields.name !== current.name,
      ownerAdmin: Boolean(adminRecord),
    },
  })
  if (auditError) throw auditError

  return "updated"
}

export async function setOwnerUserBlocked(
  actorUserId: string,
  targetUserId: string,
  isBlocked: boolean,
): Promise<string> {
  const { data, error } = await getAdminClient().rpc("owner_set_user_block_status", {
    p_actor_user_id: actorUserId,
    p_target_user_id: targetUserId,
    p_is_blocked: isBlocked,
  })
  if (error) throw error
  return data as string
}

export async function adjustOwnerUserWallet(input: {
  actorUserId: string
  targetUserId: string
  direction: "credit" | "debit"
  amountPaise: number
  reason: string
}): Promise<{ status: string; balancePaise?: number }> {
  const { data, error } = await getAdminClient().rpc("owner_adjust_user_wallet", {
    p_actor_user_id: input.actorUserId,
    p_target_user_id: input.targetUserId,
    p_direction: input.direction,
    p_amount_paise: input.amountPaise,
    p_reason: input.reason,
  })
  if (error) throw error

  if (typeof data !== "object" || data === null || !("status" in data) || typeof data.status !== "string") {
    throw new Error("The wallet adjustment returned an invalid result.")
  }

  if (data.status !== "adjusted") return { status: data.status }
  if (!("balance_paise" in data)) throw new Error("The wallet adjustment did not return the updated balance.")

  const balancePaise = Number(data.balance_paise)
  if (!Number.isSafeInteger(balancePaise)) {
    throw new Error("The updated wallet balance is outside the supported integer range.")
  }
  return { status: data.status, balancePaise: Math.max(0, balancePaise) }
}

export async function deleteOwnerUser(
  actorUserId: string,
  targetUserId: string,
): Promise<"deleted" | "not_found" | "cannot_delete_self" | "protected_admin"> {
  if (actorUserId === targetUserId) return "cannot_delete_self"

  const client = getAdminClient()
  const { data: target, error: targetError } = await client
    .from("auth_users")
    .select("id, email, public_uid")
    .eq("id", targetUserId)
    .maybeSingle()
  if (targetError) throw targetError
  if (!target) return "not_found"
  if (target.email?.toLowerCase() === "kspgpraveen157@gmail.com") return "protected_admin"

  const { data: adminRecord, error: adminError } = await client
    .from("owner_admins")
    .select("user_id")
    .eq("user_id", targetUserId)
    .maybeSingle()
  if (adminError) throw adminError
  if (adminRecord) return "protected_admin"

  const { data: identity, error: identityError } = await client
    .from("auth_identities")
    .select("provider_user_id")
    .eq("user_id", targetUserId)
    .eq("provider", "supabase")
    .maybeSingle()
  if (identityError) throw identityError

  if (identity) {
    const { error: authDeleteError } = await client.auth.admin.deleteUser(identity.provider_user_id)
    if (authDeleteError && !/user not found/i.test(authDeleteError.message)) throw authDeleteError
  }

  const { data: deleted, error: deleteError } = await client
    .from("auth_users")
    .delete()
    .eq("id", targetUserId)
    .select("id")
  if (deleteError) throw deleteError
  if (!deleted?.length) return "not_found"

  const { error: auditError } = await client.from("owner_audit_logs").insert({
    actor_user_id: actorUserId,
    action: "user.deleted",
    details: { publicUid: target.public_uid, recordsCascadeDeleted: true },
  })
  if (auditError) {
    console.error("The user was deleted, but the deletion audit entry could not be saved.", auditError)
    throw new Error("The user was deleted, but the audit log could not be saved.")
  }

  return "deleted"
}
