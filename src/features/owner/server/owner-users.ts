import "server-only"
import { randomUUID } from "node:crypto"
import { selectMysqlRows, withMysqlTransaction } from "@/lib/mysql"
import type { PoolConnection, RowDataPacket } from "mysql2/promise"

const PAGE_SIZE = 25
const primaryOwnerEmail = "kspgpraveen157@gmail.com"

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
}

type UserRow = RowDataPacket & {
  id: string
  public_uid: string
  name: string
  email: string | null
  date_of_birth: Date | string | null
  telegram_username: string | null
  x_username: string | null
  name_edit_used: boolean | number
  date_of_birth_edit_used: boolean | number
  is_blocked: boolean | number
  blocked_at: Date | string | null
  created_at: Date | string
}

function normalizeDate(value: Date | string | null): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10)
}

function normalizeSearch(value: string): string {
  return value.replace(/[^\p{L}\p{N}@._+\- ]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80)
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

function toIsoDate(value: Date | string | null): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error("A user record has an invalid date.")
  return date.toISOString()
}

async function actorCanManage(connection: PoolConnection, actorUserId: string, module: string) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT u.email, u.is_blocked, a.allowed_modules
     FROM auth_users u LEFT JOIN owner_admins a ON a.user_id = u.id
     WHERE u.id = ? LIMIT 1`,
    [actorUserId],
  )
  const actor = rows[0] as {
    email: string | null
    is_blocked: boolean | number
    allowed_modules: string[] | string | null
  } | undefined
  if (!actor || Boolean(actor.is_blocked)) return false
  if (actor.email?.toLowerCase() === primaryOwnerEmail) return true
  let modules: unknown = actor.allowed_modules
  if (typeof modules === "string") modules = JSON.parse(modules)
  return Array.isArray(modules) && modules.includes(module)
}

export async function listOwnerUsers(page: number, search: string, status: "all" | "active" | "blocked") {
  const offset = (page - 1) * PAGE_SIZE
  const conditions: string[] = []
  const queryValues: (string | number)[] = []
  const term = normalizeSearch(search)
  if (term) {
    const pattern = `%${escapeLike(term)}%`
    conditions.push("(name LIKE ? OR email LIKE ? OR public_uid LIKE ? OR telegram_username LIKE ? OR x_username LIKE ?)")
    queryValues.push(pattern, pattern, pattern, pattern, pattern)
  }
  if (status === "active") conditions.push("is_blocked = FALSE")
  if (status === "blocked") conditions.push("is_blocked = TRUE")
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
  const [
    rows,
    filteredRows,
    totalRows,
    activeRows,
    blockedRows,
  ] = await Promise.all([
    selectMysqlRows<UserRow>(
      `SELECT id, public_uid, name, email, date_of_birth, telegram_username, x_username,
              name_edit_used, date_of_birth_edit_used, is_blocked, blocked_at, created_at
       FROM auth_users ${where}
       ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...queryValues, PAGE_SIZE, offset],
    ),
    selectMysqlRows<RowDataPacket & { total: number | string }>(
      `SELECT COUNT(*) AS total FROM auth_users ${where}`,
      queryValues,
    ),
    selectMysqlRows<RowDataPacket & { total: number | string }>("SELECT COUNT(*) AS total FROM auth_users"),
    selectMysqlRows<RowDataPacket & { total: number | string }>(
      "SELECT COUNT(*) AS total FROM auth_users WHERE is_blocked = FALSE",
    ),
    selectMysqlRows<RowDataPacket & { total: number | string }>(
      "SELECT COUNT(*) AS total FROM auth_users WHERE is_blocked = TRUE",
    ),
  ])
  const userIds = rows.map((row) => row.id)
  const idsIn = userIds.length ? `(${userIds.map(() => "?").join(", ")})` : ""
  const [identityRows, adminRows, referralRows] = userIds.length
    ? await Promise.all([
        selectMysqlRows<RowDataPacket & { user_id: string; provider: string }>(
          `SELECT user_id, provider FROM auth_identities WHERE user_id IN ${idsIn}`,
          userIds,
        ),
        selectMysqlRows<RowDataPacket & { user_id: string }>(
          `SELECT user_id FROM owner_admins WHERE user_id IN ${idsIn}`,
          userIds,
        ),
        selectMysqlRows<RowDataPacket & { referrer_id: string; referee_id: string }>(
          `SELECT referrer_id, referee_id FROM referrals WHERE referrer_id IN ${idsIn}`,
          userIds,
        ),
      ])
    : [[], [], []]

  const providersByUser = new Map<string, Set<string>>()
  for (const identity of identityRows) {
    const providers = providersByUser.get(identity.user_id) ?? new Set<string>()
    providers.add(identity.provider)
    providersByUser.set(identity.user_id, providers)
  }
  const adminIds = new Set(adminRows.map((admin) => admin.user_id))
  const referralRowsWithUsers = referralRows
  const refereeIds = [...new Set(referralRowsWithUsers.map((referral) => referral.referee_id))]
  const refereeProfiles = refereeIds.length
    ? await selectMysqlRows<RowDataPacket & { id: string; public_uid: string }>(
        `SELECT id, public_uid FROM auth_users WHERE id IN (${refereeIds.map(() => "?").join(", ")})`,
        refereeIds,
      )
    : []
  const publicUidByRefereeId = new Map(refereeProfiles.map((profile) => [profile.id, profile.public_uid]))
  const referralsByUser = new Map<string, { uid: string; publicUid: string }[]>()
  for (const referral of referralRowsWithUsers) {
    const publicUid = publicUidByRefereeId.get(referral.referee_id)
    if (!publicUid) continue
    const referrals = referralsByUser.get(referral.referrer_id) ?? []
    referrals.push({ uid: referral.referee_id, publicUid })
    referralsByUser.set(referral.referrer_id, referrals)
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
    blockedAt: toIsoDate(row.blocked_at),
    createdAt: toIsoDate(row.created_at)!,
    providers: [...(providersByUser.get(row.id) ?? [])].sort(),
    isOwnerAdmin: adminIds.has(row.id),
    referrals: referralsByUser.get(row.id) ?? [],
  }))

  const total = Number(totalRows[0]?.total ?? 0)
  const filteredTotal = Number(filteredRows[0]?.total ?? 0)
  const active = Number(activeRows[0]?.total ?? 0)
  const blocked = Number(blockedRows[0]?.total ?? 0)
  if (![filteredTotal, total, active, blocked].every(Number.isSafeInteger)) {
    throw new Error("User counts are outside the supported integer range.")
  }
  return { users, total: filteredTotal, page, pageSize: PAGE_SIZE, stats: { total, active, blocked } }
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
  return withMysqlTransaction(async (connection) => {
    if (!await actorCanManage(connection, actorUserId, "users")) throw new Error("You are not authorized to manage users.")
    const [currentRows] = await connection.execute<RowDataPacket[]>(
      "SELECT id, email, name FROM auth_users WHERE id = ? LIMIT 1 FOR UPDATE",
      [id],
    )
    const current = currentRows[0] as { id: string; email: string | null; name: string } | undefined
    if (!current) return "not_found"
    const isPrimaryOwner = current.email?.toLowerCase() === primaryOwnerEmail
    if (isPrimaryOwner && fields.email?.toLowerCase() !== current.email?.toLowerCase()) return "primary_owner"

    const [passwordIdentityRows] = await connection.execute<RowDataPacket[]>(
      "SELECT provider_user_id FROM auth_identities WHERE user_id = ? AND provider = 'password' LIMIT 1",
      [id],
    )
    if (passwordIdentityRows.length > 0 && !fields.email) return "email_required"
    if (fields.email && fields.email.toLowerCase() !== current.email?.toLowerCase()) {
      const [duplicateRows] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM auth_users WHERE email = ? AND id <> ? LIMIT 1",
        [fields.email.toLowerCase(), id],
      )
      if (duplicateRows.length > 0) throw new Error("That email address is already assigned to another user.")
    }

    try {
      await connection.execute(
        `UPDATE auth_users
         SET name = ?, email = ?, date_of_birth = ?, telegram_username = ?, x_username = ?
         WHERE id = ?`,
        [
          fields.name.trim(),
          fields.email?.trim().toLowerCase() ?? null,
          fields.dateOfBirth,
          fields.telegramUsername?.trim() || null,
          fields.xUsername?.trim() || null,
          id,
        ],
      )
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY") {
        throw new Error("That email address is already assigned to another user.")
      }
      throw error
    }
    const [adminRows] = await connection.execute<RowDataPacket[]>(
      "SELECT user_id FROM owner_admins WHERE user_id = ? LIMIT 1",
      [id],
    )
    await connection.execute(
      `INSERT INTO owner_audit_logs (actor_user_id, action, subject_user_id, details)
       VALUES (?, 'user.profile_updated', ?, ?)`,
      [
        actorUserId,
        id,
        JSON.stringify({
          emailChanged: fields.email !== current.email,
          nameChanged: fields.name !== current.name,
          ownerAdmin: adminRows.length > 0,
        }),
      ],
    )
    return "updated"
  })
}

export async function setOwnerUserBlocked(
  actorUserId: string,
  targetUserId: string,
  isBlocked: boolean,
): Promise<string> {
  return withMysqlTransaction(async (connection) => {
    if (!await actorCanManage(connection, actorUserId, "users")) return "unauthorized"
    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT email, is_blocked FROM auth_users WHERE id = ? LIMIT 1 FOR UPDATE",
      [targetUserId],
    )
    const target = rows[0] as { email: string | null; is_blocked: boolean | number } | undefined
    if (!target) return "user_not_found"
    if (target.email?.toLowerCase() === primaryOwnerEmail) return "primary_admin"
    if (Boolean(target.is_blocked) === isBlocked) return "unchanged"
    if (isBlocked) {
      const [admins] = await connection.execute<RowDataPacket[]>(
        "SELECT user_id FROM owner_admins WHERE user_id = ? LIMIT 1",
        [targetUserId],
      )
      if (admins.length > 0) return "admin_must_be_revoked_first"
    }
    await connection.execute(
      "UPDATE auth_users SET is_blocked = ?, blocked_at = ? WHERE id = ?",
      [isBlocked, isBlocked ? new Date() : null, targetUserId],
    )
    await connection.execute(
      `INSERT INTO owner_audit_logs (actor_user_id, action, subject_user_id, details)
       VALUES (?, ?, ?, ?)`,
      [
        actorUserId,
        isBlocked ? "user.blocked" : "user.unblocked",
        targetUserId,
        JSON.stringify({ isBlocked }),
      ],
    )
    return "updated"
  })
}

export async function adjustOwnerUserWallet(input: {
  actorUserId: string
  targetUserId: string
  direction: "credit" | "debit"
  amountPaise: number
  reason: string
}): Promise<{ status: string; balancePaise?: number }> {
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0 || input.reason.trim().length < 3 || input.reason.length > 500) {
    return { status: "invalid_adjustment" }
  }
  return withMysqlTransaction(async (connection) => {
    if (!await actorCanManage(connection, input.actorUserId, "wallet")) return { status: "unauthorized" }
    const [users] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM auth_users WHERE id = ? LIMIT 1 FOR UPDATE",
      [input.targetUserId],
    )
    if (users.length === 0) return { status: "user_not_found" }
    const [balanceRows] = await connection.execute<(RowDataPacket & { balance_paise: number | string })[]>(
      `SELECT
         COALESCE((SELECT SUM(amount_paise) FROM wallet_deposits WHERE user_id = ? AND status = 'paid'), 0)
         - COALESCE((SELECT SUM(amount_paise) FROM wallet_withdrawal_requests WHERE user_id = ? AND status IN ('pending', 'paid')), 0)
         + COALESCE((SELECT SUM(amount_paise) FROM owner_wallet_adjustments WHERE user_id = ?), 0) AS balance_paise`,
      [input.targetUserId, input.targetUserId, input.targetUserId],
    )
    const balance = Number(balanceRows[0]?.balance_paise ?? 0)
    if (!Number.isSafeInteger(balance)) throw new Error("The wallet balance is outside the supported integer range.")
    if (input.direction === "debit" && input.amountPaise > Math.max(balance, 0)) {
      return { status: "insufficient_balance" }
    }
    const signedAmount = input.direction === "credit" ? input.amountPaise : -input.amountPaise
    await connection.execute(
      `INSERT INTO owner_wallet_adjustments
        (id, user_id, actor_user_id, amount_paise, reason)
       VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), input.targetUserId, input.actorUserId, signedAmount, input.reason.trim()],
    )
    const updatedBalance = balance + signedAmount
    if (!Number.isSafeInteger(updatedBalance)) throw new Error("The updated wallet balance is outside the supported integer range.")
    await connection.execute(
      `INSERT INTO owner_audit_logs (actor_user_id, action, subject_user_id, details)
       VALUES (?, 'user.wallet_adjusted', ?, ?)`,
      [
        input.actorUserId,
        input.targetUserId,
        JSON.stringify({ direction: input.direction, amountPaise: input.amountPaise, reason: input.reason.trim() }),
      ],
    )
    return { status: "adjusted", balancePaise: Math.max(0, updatedBalance) }
  })
}

export async function deleteOwnerUser(
  actorUserId: string,
  targetUserId: string,
): Promise<"deleted" | "not_found" | "cannot_delete_self" | "protected_admin"> {
  if (actorUserId === targetUserId) return "cannot_delete_self"
  return withMysqlTransaction(async (connection) => {
    if (!await actorCanManage(connection, actorUserId, "users")) {
      throw new Error("You are not authorized to delete users.")
    }
    const [targetRows] = await connection.execute<RowDataPacket[]>(
      "SELECT email, public_uid FROM auth_users WHERE id = ? LIMIT 1 FOR UPDATE",
      [targetUserId],
    )
    const target = targetRows[0] as { email: string | null; public_uid: string } | undefined
    if (!target) return "not_found"
    if (target.email?.toLowerCase() === primaryOwnerEmail) return "protected_admin"
    const [adminRows] = await connection.execute<RowDataPacket[]>(
      "SELECT user_id FROM owner_admins WHERE user_id = ? LIMIT 1",
      [targetUserId],
    )
    if (adminRows.length > 0) return "protected_admin"

    await connection.execute(
      `INSERT INTO owner_audit_logs (actor_user_id, action, subject_user_id, details)
       VALUES (?, 'user.deleted', ?, ?)`,
      [actorUserId, targetUserId, JSON.stringify({ publicUid: target.public_uid, recordsCascadeDeleted: true })],
    )
    await connection.execute("DELETE FROM auth_users WHERE id = ?", [targetUserId])
    return "deleted"
  })
}
