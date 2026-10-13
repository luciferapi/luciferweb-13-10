import "server-only"
import { randomBytes } from "node:crypto"
import { getMysqlPool, selectMysqlRows } from "@/lib/mysql"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import type { ReferralEntry, ReferralProgram, ReferralStatus } from "@/features/referrals/server/referral-types"

export type { ReferralEntry, ReferralProgram, ReferralStatus } from "@/features/referrals/server/referral-types"

type ReferralRow = RowDataPacket & {
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
  const rows = await selectMysqlRows<RowDataPacket & { user_id: string }>(
    "SELECT user_id FROM referral_profiles WHERE referral_code = ? LIMIT 1",
    [code.trim().toUpperCase()],
  )
  return rows[0]?.user_id ?? null
}

export async function isReferralCodeAvailable(code: string): Promise<boolean> {
  const pool = getMysqlPool()
  const owners = await selectMysqlRows<RowDataPacket & { user_id: string }>(
    "SELECT user_id FROM referral_profiles WHERE referral_code = ? LIMIT 1",
    [code.trim().toUpperCase()],
  )
  const owner = owners[0]
  if (!owner) return false

  const [settingsRows] = await pool.execute<(RowDataPacket & {
    max_referrals: number | string | null
    valid_until: Date | string | null
  })[]>(
    "SELECT max_referrals, valid_until FROM referral_program_settings WHERE program_id = 1 LIMIT 1",
  )
  const [countRows] = await pool.execute<(RowDataPacket & {
    referral_count: number | string
  })[]>(
    "SELECT COUNT(*) AS referral_count FROM referrals WHERE referrer_id = ?",
    [owner.user_id],
  )
  const settings = settingsRows[0]
  if (!settings) return false
  const notExpired = settings.valid_until === null ||
    new Date(settings.valid_until).getTime() > Date.now()
  const referralCount = Number(countRows[0]?.referral_count ?? 0)
  return Boolean(
    notExpired &&
    (settings.max_referrals === null || referralCount < Number(settings.max_referrals)),
  )
}

export async function getReferralProgram(): Promise<ReferralProgram> {
  const rows = await selectMysqlRows<ReferralProgramRow>(
    `SELECT referrer_reward_type, referrer_reward_amount, referrer_reward_currency,
            referee_reward_type, referee_reward_amount, referee_reward_currency,
            min_purchase_amount, valid_until, max_referrals
     FROM referral_program_settings WHERE program_id = 1 LIMIT 1`,
  )
  const row = rows[0]
  if (!row) throw new Error("The referral program settings have not been initialized.")

  const settings = row
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

  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `UPDATE referral_program_settings
     SET referrer_reward_type = ?, referrer_reward_amount = ?, referrer_reward_currency = 'INR',
         referee_reward_type = ?, referee_reward_amount = ?, referee_reward_currency = 'INR',
         min_purchase_amount = ?, valid_until = ?, max_referrals = ?, updated_at = CURRENT_TIMESTAMP(3)
     WHERE program_id = 1`,
    [
      program.referrerReward.type,
      program.referrerReward.amount,
      program.refereeReward.type,
      program.refereeReward.amount,
      program.conditions.minPurchaseAmount,
      validUntil?.toISOString() ?? null,
      program.conditions.maxReferrals,
    ],
  )
  if (result.affectedRows === 0) {
    const existing = await selectMysqlRows<RowDataPacket & { program_id: number }>(
      "SELECT program_id FROM referral_program_settings WHERE program_id = 1 LIMIT 1",
    )
    if (existing.length === 0) throw new Error("The referral program settings have not been initialized.")
  }
}

export async function createReferralCode(userId: string): Promise<string> {
  const pool = getMysqlPool()
  const existingRows = await selectMysqlRows<RowDataPacket & { referral_code: string }>(
    "SELECT referral_code FROM referral_profiles WHERE user_id = ? LIMIT 1",
    [userId],
  )
  const existing = existingRows[0]
  if (existing) return existing.referral_code

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomBytes(6).toString("hex").toUpperCase()
    try {
      await pool.execute(
        "INSERT INTO referral_profiles (user_id, referral_code) VALUES (?, ?)",
        [userId, code],
      )
      return code
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY")) {
        throw error
      }
    }

    const concurrentRows = await selectMysqlRows<RowDataPacket & { referral_code: string }>(
      "SELECT referral_code FROM referral_profiles WHERE user_id = ? LIMIT 1",
      [userId],
    )
    const concurrentProfile = concurrentRows[0]
    if (concurrentProfile) return concurrentProfile.referral_code
  }
  throw new Error("Could not generate a unique referral code.")
}

export async function getUserReferralTree(userId: string): Promise<{ code: string; referrals: ReferralEntry[] }> {
  const code = await createReferralCode(userId)
  const rows = await selectMysqlRows<ReferralRow>(
    `WITH RECURSIVE referral_tree
       (id, referrer_id, referee_id, status, status_reason, created_at, depth, visited_ids) AS (
       SELECT referrals.id, referrals.referrer_id, referrals.referee_id, referrals.status,
              referrals.status_reason, referrals.created_at, 1,
              CAST(CONCAT(',', referrals.referrer_id, ',', referrals.referee_id, ',') AS CHAR(8000))
       FROM referrals WHERE referrals.referrer_id = ?
       UNION ALL
       SELECT child.id, child.referrer_id, child.referee_id, child.status,
              child.status_reason, child.created_at, referral_tree.depth + 1,
              CONCAT(referral_tree.visited_ids, child.referee_id, ',')
       FROM referrals AS child
       INNER JOIN referral_tree ON child.referrer_id = referral_tree.referee_id
       WHERE LOCATE(CONCAT(',', child.referee_id, ','), referral_tree.visited_ids) = 0
     )
     SELECT referral_tree.id, users.name, users.email, referral_tree.status,
            referral_tree.status_reason, referral_tree.depth, referral_tree.created_at,
            users.created_at AS signup_at
     FROM referral_tree
     INNER JOIN auth_users AS users ON users.id = referral_tree.referee_id
     ORDER BY referral_tree.depth, referral_tree.created_at DESC`,
    [userId],
  )
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
  const rows = await selectMysqlRows<ReferralRow>(
    `SELECT referrals.id, referrals.referrer_id, referrals.referee_id, users.name, users.email,
            referrals.status, referrals.status_reason, 0 AS depth,
            referrals.created_at, users.created_at AS signup_at
     FROM referrals
     INNER JOIN auth_users AS users ON users.id = referrals.referee_id
     ORDER BY referrals.created_at DESC`,
  )
  return rows.map((row) => ({
      id: row.id,
      name: `${row.name} (${row.email})`,
      status: row.status,
      statusReason: row.status_reason,
      depth: 0,
      createdAt: new Date(row.created_at).toISOString(),
      signupAt: new Date(row.signup_at).toISOString(),
    }))
}

export async function updateReferralStatus(id: string, status: ReferralStatus, reason: string | null): Promise<boolean> {
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `UPDATE referrals SET status = ?, status_reason = ?, updated_at = CURRENT_TIMESTAMP(3)
     WHERE id = ?`,
    [status, reason, id],
  )
  if (result.affectedRows > 0) return true
  const rows = await selectMysqlRows<RowDataPacket & { id: string }>(
    "SELECT id FROM referrals WHERE id = ? LIMIT 1",
    [id],
  )
  return rows.length === 1
}
