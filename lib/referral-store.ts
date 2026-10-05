import { randomBytes } from "node:crypto"
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"
import { getDatabasePool } from "@/lib/database"
import type { ReferralEntry, ReferralProgram, ReferralStatus } from "@/lib/referral-types"

export type { ReferralEntry, ReferralProgram, ReferralStatus } from "@/lib/referral-types"

type ReferralRow = RowDataPacket & {
  id: string
  referrer_id: string
  referee_id: string
  name: string
  email: string
  status: ReferralStatus
  depth: number
  created_at: Date | string
}
type ReferralProgramRow = RowDataPacket & {
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

export async function findReferralOwner(code: string): Promise<string | null> {
  const [rows] = await getDatabasePool().execute<(RowDataPacket & { user_id: string })[]>(
    "SELECT user_id FROM referral_profiles WHERE referral_code = ? LIMIT 1",
    [code.trim().toUpperCase()],
  )
  return rows[0]?.user_id ?? null
}

export async function isReferralCodeAvailable(code: string): Promise<boolean> {
  const [rows] = await getDatabasePool().execute<(RowDataPacket & {
    owner_id: string
    max_referrals: number | string | null
    referral_count: number | string
    not_expired: number | string | boolean
  })[]>(
    `SELECT profiles.user_id AS owner_id, settings.max_referrals,
            COUNT(referrals.id) AS referral_count,
            (settings.valid_until IS NULL OR settings.valid_until > CURRENT_TIMESTAMP) AS not_expired
     FROM referral_profiles AS profiles
     INNER JOIN referral_program_settings AS settings ON settings.program_id = 1
     LEFT JOIN referrals ON referrals.referrer_id = profiles.user_id
     WHERE profiles.referral_code = ?
     GROUP BY profiles.user_id, settings.max_referrals, settings.valid_until`,
    [code.trim().toUpperCase()],
  )
  const row = rows[0]
  return Boolean(
    row &&
    Number(row.not_expired) === 1 &&
    (row.max_referrals === null || Number(row.referral_count) < Number(row.max_referrals)),
  )
}

export async function getReferralProgram(): Promise<ReferralProgram> {
  const [rows] = await getDatabasePool().execute<ReferralProgramRow[]>(
    `SELECT referrer_reward_type, referrer_reward_amount, referrer_reward_currency,
            referee_reward_type, referee_reward_amount, referee_reward_currency,
            min_purchase_amount, valid_until, max_referrals
     FROM referral_program_settings WHERE program_id = 1 LIMIT 1`,
  )
  const row = rows[0]
  if (!row) throw new Error("The referral program settings have not been initialized.")

  return {
    referrerReward: {
      type: row.referrer_reward_type,
      amount: Number(row.referrer_reward_amount),
      currency: row.referrer_reward_currency,
    },
    refereeReward: {
      type: row.referee_reward_type,
      amount: Number(row.referee_reward_amount),
      currency: row.referee_reward_currency,
    },
    conditions: {
      minPurchaseAmount: row.min_purchase_amount === null ? null : Number(row.min_purchase_amount),
      validUntil: row.valid_until ? new Date(row.valid_until).toISOString() : null,
      maxReferrals: row.max_referrals === null ? null : Number(row.max_referrals),
    },
  }
}

export async function updateReferralProgram(program: ReferralProgram): Promise<void> {
  const validUntil = program.conditions.validUntil
    ? new Date(program.conditions.validUntil)
    : null
  if (validUntil && Number.isNaN(validUntil.getTime())) throw new Error("The program expiry date is invalid.")

  await getDatabasePool().execute(
    `UPDATE referral_program_settings
     SET referrer_reward_type = ?, referrer_reward_amount = ?, referrer_reward_currency = ?,
         referee_reward_type = ?, referee_reward_amount = ?, referee_reward_currency = ?,
         min_purchase_amount = ?, valid_until = ?, max_referrals = ?
     WHERE program_id = 1`,
    [
      program.referrerReward.type,
      program.referrerReward.amount,
      program.referrerReward.type === "fixed" ? program.referrerReward.currency : "USD",
      program.refereeReward.type,
      program.refereeReward.amount,
      program.refereeReward.type === "fixed" ? program.refereeReward.currency : "USD",
      program.conditions.minPurchaseAmount,
      validUntil,
      program.conditions.maxReferrals,
    ],
  )
}

export async function createReferralCode(userId: string): Promise<string> {
  const [existing] = await getDatabasePool().execute<(RowDataPacket & { referral_code: string })[]>(
    "SELECT referral_code FROM referral_profiles WHERE user_id = ? LIMIT 1",
    [userId],
  )
  if (existing[0]) return existing[0].referral_code

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomBytes(6).toString("hex").toUpperCase()
    try {
      await getDatabasePool().execute(
        "INSERT INTO referral_profiles (user_id, referral_code) VALUES (?, ?)",
        [userId, code],
      )
      return code
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY") {
        const [profile] = await getDatabasePool().execute<(RowDataPacket & { referral_code: string })[]>(
          "SELECT referral_code FROM referral_profiles WHERE user_id = ? LIMIT 1",
          [userId],
        )
        if (profile[0]) return profile[0].referral_code
        continue
      }
      throw error
    }
  }
  throw new Error("Could not generate a unique referral code.")
}

export async function getUserReferralTree(userId: string): Promise<{ code: string; referrals: ReferralEntry[] }> {
  const code = await createReferralCode(userId)
  const [rows] = await getDatabasePool().execute<ReferralRow[]>(
    `WITH RECURSIVE referral_tree AS (
       SELECT id, referrer_id, referee_id, status, created_at, 0 AS depth
       FROM referrals WHERE referrer_id = ?
       UNION ALL
       SELECT child.id, child.referrer_id, child.referee_id, child.status, child.created_at, parent.depth + 1
       FROM referrals AS child
       INNER JOIN referral_tree AS parent ON child.referrer_id = parent.referee_id
       WHERE parent.depth < 9
     )
     SELECT tree.id, tree.referrer_id, tree.referee_id, tree.status, tree.created_at, tree.depth,
            users.name, users.email
     FROM referral_tree AS tree
     INNER JOIN auth_users AS users ON users.id = tree.referee_id
     ORDER BY tree.depth, tree.created_at DESC`,
    [userId],
  )

  return {
    code,
    referrals: rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      depth: Number(row.depth),
      createdAt: new Date(row.created_at).toISOString(),
    })),
  }
}

export async function listAllReferrals(): Promise<ReferralEntry[]> {
  const [rows] = await getDatabasePool().execute<ReferralRow[]>(
    `SELECT referrals.id, referrals.referrer_id, referrals.referee_id, referrals.status, referrals.created_at,
            0 AS depth, invited.name, invited.email
     FROM referrals
     INNER JOIN auth_users AS invited ON invited.id = referrals.referee_id
     ORDER BY referrals.created_at DESC`,
  )

  return rows.map((row) => ({
    id: row.id,
    name: `${row.name} (${row.email})`,
    status: row.status,
    depth: 0,
    createdAt: new Date(row.created_at).toISOString(),
  }))
}

export async function updateReferralStatus(id: string, status: ReferralStatus): Promise<boolean> {
  const [result] = await getDatabasePool().execute<ResultSetHeader>(
    `UPDATE referrals SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, id],
  )
  return result.affectedRows === 1
}
