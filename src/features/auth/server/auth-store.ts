import "server-only"
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto"
import { promisify } from "node:util"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import type { PoolConnection } from "mysql2/promise"
import { getMysqlPool, selectMysqlRows, withMysqlTransaction } from "@/lib/mysql"
import { generatePublicUserId } from "@/features/auth/server/public-user-id"
import { SignupIpUnavailableError } from "@/features/auth/server/signup-ip"
import { isOwnerEmail } from "@/features/auth/server/owner-email"

const scrypt = promisify(scryptCallback)
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60
const EMAIL_OTP_DURATION_SECONDS = 10 * 60
const EMAIL_OTP_RESEND_SECONDS = 60
const EMAIL_REGISTRATION_DURATION_SECONDS = 30 * 60
const EMAIL_OTP_MAX_ATTEMPTS = 5
const OWNER_LOGIN_OTP_DURATION_SECONDS = 5 * 60
const OWNER_LOGIN_OTP_RESEND_SECONDS = 0
const OWNER_LOGIN_OTP_MAX_ATTEMPTS = 5
const PASSWORD_RESET_DURATION_SECONDS = 60 * 60

type ProfileRow = RowDataPacket & {
  id: string
  public_uid: string
  name: string
  email: string | null
  date_of_birth: string | Date | null
  telegram_username: string | null
  x_username: string | null
  name_edit_used: boolean | number
  date_of_birth_edit_used: boolean | number
}

type PendingRegistrationRow = RowDataPacket & {
  email: string
  auth_user_id: string
  password_hash: string
  name: string
  date_of_birth: string | Date | null
  signup_ip_hash: string | null
  referral_code: string | null
  otp_hash: string
  expires_at: string | Date
  resend_after: string | Date
  registration_expires_at: string | Date
  attempts: number | string
}

type SessionRecord = {
  token: string
  tokenHash: string
  expiresAt: Date
}

export class SignupIpAlreadyUsedError extends Error {
  constructor() {
    super("An account has already been created from this network.")
    this.name = "SignupIpAlreadyUsedError"
  }
}

export type AuthUser = {
  id: string
  publicUid: string
  name: string
  email: string | null
  dateOfBirth: string | null
  telegramUsername: string | null
  xUsername: string | null
  nameEditUsed: boolean
  dateOfBirthEditUsed: boolean
}

function normalizeDateOfBirth(value: string | Date | null | undefined): string | null {
  if (value == null) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10)
}

function toAuthUser(row: ProfileRow): AuthUser {
  return {
    id: row.id,
    publicUid: row.public_uid,
    name: row.name,
    email: row.email,
    dateOfBirth: normalizeDateOfBirth(row.date_of_birth),
    telegramUsername: row.telegram_username,
    xUsername: row.x_username,
    nameEditUsed: Boolean(row.name_edit_used),
    dateOfBirthEditUsed: Boolean(row.date_of_birth_edit_used),
  }
}

  function getOtpHashSecret(): string {
    const secret = [
      process.env.AUTH_OTP_HMAC_SECRET,
      process.env.AUTH_OTP_HMAC_SECRET_2,
      process.env.AUTH_OTP_HMAC_SECRET_3,
      process.env.AUTH_OTP_HMAC_SECRET_4,
    ].map((value) => value?.trim()).find(Boolean)
    if (!secret) throw new Error("AUTH_OTP_HMAC_SECRET is required to protect one-time codes.")
    return secret
  }

function otpHash(otp: string): string {
  return createHmac("sha256", getOtpHashSecret()).update(otp).digest("hex")
}

function equalHash(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "hex")
  const rightBytes = Buffer.from(right, "hex")
  return leftBytes.length === rightBytes.length &&
    leftBytes.length > 0 &&
    timingSafeEqual(leftBytes, rightBytes)
}

function sessionToken(): SessionRecord {
  const token = randomBytes(32).toString("base64url")
  return {
    token,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + SESSION_DURATION_SECONDS * 1000),
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function dateValue(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

async function findProfileById(
  connection: PoolConnection,
  userId: string,
  forUpdate = false,
): Promise<ProfileRow | null> {
  const [rows] = await connection.execute<ProfileRow[]>(
    `SELECT id, public_uid, name, email, date_of_birth, telegram_username, x_username,
            name_edit_used, date_of_birth_edit_used
     FROM auth_users WHERE id = ? LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
    [userId],
  )
  return rows[0] ?? null
}

async function createSessionRecord(
  connection: PoolConnection,
  userId: string,
  authMethod: string,
  session: SessionRecord,
): Promise<void> {
  await connection.execute(
    `INSERT INTO auth_sessions (token_hash, user_id, expires_at, auth_method)
     VALUES (?, ?, ?, ?)`,
    [session.tokenHash, userId, session.expiresAt, authMethod],
  )
}

async function attachReferral(
  connection: PoolConnection,
  referralCode: string | null,
  refereeId: string,
): Promise<void> {
  if (!referralCode) return
  const [owners] = await connection.execute<(RowDataPacket & { user_id: string })[]>(
    "SELECT user_id FROM referral_profiles WHERE referral_code = ? LIMIT 1",
    [referralCode.trim().toUpperCase()],
  )
  const ownerId = owners[0]?.user_id
  if (!ownerId || ownerId === refereeId) return

  const [settingsRows] = await connection.execute<(RowDataPacket & {
    referrer_reward_type: "fixed" | "percentage"
    referrer_reward_amount: number | string
    valid_until: Date | string | null
    max_referrals: number | string | null
  })[]>(
    `SELECT referrer_reward_type, referrer_reward_amount, valid_until, max_referrals FROM referral_program_settings
     WHERE program_id = 1 LIMIT 1`,
  )
  const settings = settingsRows[0]
  if (!settings) return
  if (settings.valid_until && dateValue(settings.valid_until).getTime() <= Date.now()) return

  if (settings.max_referrals !== null) {
    const [counts] = await connection.execute<(RowDataPacket & { referral_count: number | string })[]>(
      "SELECT COUNT(*) AS referral_count FROM referrals WHERE referrer_id = ?",
      [ownerId],
    )
    if (Number(counts[0]?.referral_count ?? 0) >= Number(settings.max_referrals)) return
  }

  await connection.execute(
    `INSERT INTO referrals (id, referrer_id, referee_id, status, status_reason)
     VALUES (?, ?, ?, 'active', 'Activated after verified signup; inviter reward credited')`,
    [randomUUID(), ownerId, refereeId],
  )
  const rewardPaise = settings.referrer_reward_type === "fixed"
    ? Math.round(Number(settings.referrer_reward_amount) * 100)
    : 0
  if (Number.isSafeInteger(rewardPaise) && rewardPaise > 0) {
    await connection.execute(
      `INSERT INTO owner_wallet_adjustments (id, user_id, actor_user_id, amount_paise, reason)
       VALUES (?, ?, NULL, ?, 'Referral reward for verified signup')`,
      [randomUUID(), ownerId, rewardPaise],
    )
  }
}

async function grantSignupBonus(connection: PoolConnection, userId: string): Promise<void> {
  await connection.execute(
    `INSERT INTO owner_wallet_adjustments (id, user_id, actor_user_id, amount_paise, reason)
     VALUES (?, ?, NULL, 2500, 'Verified signup bonus')`,
    [randomUUID(), userId],
  )
}

function isDuplicateEntry(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "code" in error && error.code === "ER_DUP_ENTRY"
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = (await scrypt(password, salt, 64)) as Buffer
  return `${salt.toString("hex")}:${key.toString("hex")}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, keyHex, ...extra] = storedHash.split(":")
  if (extra.length || !/^[0-9a-f]{32}$/i.test(saltHex ?? "") || !/^[0-9a-f]{128}$/i.test(keyHex ?? "")) {
    return false
  }

  const expectedKey = Buffer.from(keyHex, "hex")
  const actualKey = (await scrypt(password, Buffer.from(saltHex, "hex"), expectedKey.length)) as Buffer
  return timingSafeEqual(actualKey, expectedKey)
}

export async function createUser(input: {
  name: string
  email: string
  password: string
  dateOfBirth?: string
  signupIpHash: string
}): Promise<AuthUser> {
  const id = randomUUID()
  const email = normalizeEmail(input.email)
  const passwordHash = await hashPassword(input.password)
  try {
    return await withMysqlTransaction(async (connection) => {
      const [duplicateIps] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM auth_users WHERE signup_ip_hash = ? LIMIT 1",
        [input.signupIpHash],
      )
      if (duplicateIps.length > 0) throw new SignupIpAlreadyUsedError()
      await connection.execute(
        `INSERT INTO auth_users (id, public_uid, name, email, password_hash, date_of_birth, signup_ip_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, generatePublicUserId(), input.name, email, passwordHash, input.dateOfBirth ?? null, input.signupIpHash],
      )
      await connection.execute(
        "INSERT INTO auth_identities (provider, provider_user_id, user_id) VALUES ('password', ?, ?)",
        [id, id],
      )
      const profile = await findProfileById(connection, id)
      if (!profile) throw new Error("The MySQL account record could not be read after creation.")
      return toAuthUser(profile)
    })
  } catch (error) {
    if (isDuplicateEntry(error)) {
      throw new Error("A user with this email address has already been registered.")
    }
    throw error
  }
}

export async function beginEmailVerification(input: {
  name: string
  email: string
  password: string
  dateOfBirth?: string
  signupIpHash: string
  referralCode?: string
}): Promise<{ otp: string }> {
  const email = normalizeEmail(input.email)
  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0")
  const now = Date.now()
  const passwordHash = await hashPassword(input.password)
  try {
    await withMysqlTransaction(async (connection) => {
      const [existingUsers] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM auth_users WHERE email = ? LIMIT 1",
        [email],
      )
      if (existingUsers.length > 0) {
        throw new Error("A user with this email address has already been registered.")
      }
      const [usedIps] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM auth_users WHERE signup_ip_hash = ? LIMIT 1",
        [input.signupIpHash],
      )
      if (usedIps.length > 0) throw new SignupIpAlreadyUsedError()
      await connection.execute(
        `INSERT INTO auth_pending_registrations
          (email, auth_user_id, password_hash, name, date_of_birth, signup_ip_hash,
           referral_code, otp_hash, expires_at, resend_after, registration_expires_at, attempts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          email,
          randomUUID(),
          passwordHash,
          input.name,
          input.dateOfBirth ?? null,
          input.signupIpHash,
          input.referralCode?.trim().toUpperCase() || null,
          otpHash(otp),
          new Date(now + EMAIL_OTP_DURATION_SECONDS * 1000),
          new Date(now + EMAIL_OTP_RESEND_SECONDS * 1000),
          new Date(now + EMAIL_REGISTRATION_DURATION_SECONDS * 1000),
        ],
      )
    })
    return { otp }
  } catch (error) {
    if (isDuplicateEntry(error)) {
      throw new Error("A user with this email address has already been registered.")
    }
    throw error
  }
}

export async function resendPendingRegistrationOtp(
  email: string,
): Promise<
  | { status: "sent"; otp: string; name: string }
  | { status: "cooldown"; retryAfterSeconds: number }
  | { status: "missing" | "expired" }
> {
  const normalizedEmail = normalizeEmail(email)
  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0")
  return withMysqlTransaction(async (connection) => {
    const [rows] = await connection.execute<PendingRegistrationRow[]>(
      "SELECT * FROM auth_pending_registrations WHERE email = ? FOR UPDATE",
      [normalizedEmail],
    )
    const pending = rows[0]
    if (!pending) return { status: "missing" as const }

    const now = Date.now()
    const registrationExpiry = dateValue(pending.registration_expires_at).getTime()
    if (registrationExpiry <= now || Number(pending.attempts) >= EMAIL_OTP_MAX_ATTEMPTS) {
      await connection.execute("DELETE FROM auth_pending_registrations WHERE email = ?", [normalizedEmail])
      return { status: "expired" as const }
    }

    const resendAfter = dateValue(pending.resend_after).getTime()
    if (resendAfter > now) {
      return {
        status: "cooldown" as const,
        retryAfterSeconds: Math.max(1, Math.ceil((resendAfter - now) / 1000)),
      }
    }

    await connection.execute(
      `UPDATE auth_pending_registrations
       SET otp_hash = ?, expires_at = ?, resend_after = ?, attempts = 0
       WHERE email = ?`,
      [
        otpHash(otp),
        new Date(now + EMAIL_OTP_DURATION_SECONDS * 1000),
        new Date(now + EMAIL_OTP_RESEND_SECONDS * 1000),
        normalizedEmail,
      ],
    )
    return { status: "sent" as const, otp, name: pending.name }
  })
}

export async function discardPendingRegistration(email: string): Promise<void> {
  await getMysqlPool().execute(
    "DELETE FROM auth_pending_registrations WHERE email = ?",
    [normalizeEmail(email)],
  )
}

export async function verifyEmailRegistration(
  email: string,
  otp: string,
): Promise<
  | { status: "verified"; user: AuthUser; token: string; expiresAt: Date }
  | { status: "invalid" | "missing" | "expired" | "attempts-exceeded" | "already-registered" | "ip-already-registered" }
> {
  const normalizedEmail = normalizeEmail(email)
  const session = sessionToken()
  const result = await withMysqlTransaction(async (connection) => {
    const [rows] = await connection.execute<PendingRegistrationRow[]>(
      "SELECT * FROM auth_pending_registrations WHERE email = ? FOR UPDATE",
      [normalizedEmail],
    )
    const pending = rows[0]
    if (!pending) return { status: "missing" as const }

    const now = Date.now()
    if (dateValue(pending.registration_expires_at).getTime() <= now) {
      await connection.execute("DELETE FROM auth_pending_registrations WHERE email = ?", [normalizedEmail])
      return { status: "expired" as const }
    }
    if (dateValue(pending.expires_at).getTime() <= now) {
      return { status: "expired" as const }
    }
    if (Number(pending.attempts) >= EMAIL_OTP_MAX_ATTEMPTS) {
      await connection.execute("DELETE FROM auth_pending_registrations WHERE email = ?", [normalizedEmail])
      return { status: "attempts-exceeded" as const }
    }
    if (!equalHash(pending.otp_hash, otpHash(otp))) {
      const attempts = Number(pending.attempts) + 1
      if (attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
        await connection.execute("DELETE FROM auth_pending_registrations WHERE email = ?", [normalizedEmail])
        return { status: "attempts-exceeded" as const }
      }
      await connection.execute(
        "UPDATE auth_pending_registrations SET attempts = ? WHERE email = ?",
        [attempts, normalizedEmail],
      )
      return { status: "invalid" as const }
    }

    const [duplicates] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM auth_users WHERE email = ? LIMIT 1",
      [normalizedEmail],
    )
    if (duplicates.length > 0) {
      await connection.execute("DELETE FROM auth_pending_registrations WHERE email = ?", [normalizedEmail])
      return { status: "already-registered" as const }
    }
    if (pending.signup_ip_hash) {
      const [usedIps] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM auth_users WHERE signup_ip_hash = ? LIMIT 1",
        [pending.signup_ip_hash],
      )
      if (usedIps.length > 0) {
        await connection.execute("DELETE FROM auth_pending_registrations WHERE email = ?", [normalizedEmail])
        return { status: "ip-already-registered" as const }
      }
    }

    const profileId = pending.auth_user_id
    const publicUid = generatePublicUserId()
    await connection.execute(
      `INSERT INTO auth_users
        (id, public_uid, name, email, password_hash, date_of_birth, signup_ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        profileId,
        publicUid,
        pending.name,
        normalizedEmail,
        pending.password_hash,
        pending.date_of_birth,
        pending.signup_ip_hash,
      ],
    )
    await connection.execute(
      "INSERT INTO auth_identities (provider, provider_user_id, user_id) VALUES ('password', ?, ?)",
      [profileId, profileId],
    )
    await grantSignupBonus(connection, profileId)
    await attachReferral(connection, pending.referral_code, profileId)
    await createSessionRecord(connection, profileId, "password", session)
    await connection.execute("DELETE FROM auth_pending_registrations WHERE email = ?", [normalizedEmail])
    const profile = await findProfileById(connection, profileId)
    if (!profile) throw new Error("The registered account could not be read after creation.")
    return { status: "verified" as const, user: toAuthUser(profile) }
  })

  if (result.status !== "verified") return result
  return { ...result, token: session.token, expiresAt: session.expiresAt }
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  const normalizedEmail = normalizeEmail(email)
  const [rows] = await getMysqlPool().execute<(ProfileRow & {
    password_hash: string | null
    is_blocked: boolean | number
  })[]>(
    `SELECT id, public_uid, name, email, date_of_birth, telegram_username, x_username,
            name_edit_used, date_of_birth_edit_used, password_hash, is_blocked
     FROM auth_users WHERE email = ? LIMIT 1`,
    [normalizedEmail],
  )
  const user = rows[0]
  if (!user || user.is_blocked || !user.password_hash) return null
  return await verifyPassword(password, user.password_hash) ? toAuthUser(user) : null
}

export type OtpLoginType = "owner" | "staff"

async function getOtpLoginType(
  user: { id: string; email: string | null },
  connection?: PoolConnection,
): Promise<OtpLoginType | null> {
  if (isOwnerEmail(user.email)) return "owner"
  const rows = connection
    ? (await connection.execute<(RowDataPacket & { user_id: string })[]>(
        "SELECT user_id FROM owner_admins WHERE user_id = ? LIMIT 1",
        [user.id],
      ))[0]
    : await selectMysqlRows<RowDataPacket & { user_id: string }>(
        "SELECT user_id FROM owner_admins WHERE user_id = ? LIMIT 1",
        [user.id],
      )
  return rows.length > 0 ? "staff" : null
}

export async function getOtpLoginTypeByEmail(email: string): Promise<OtpLoginType | null> {
  const normalizedEmail = normalizeEmail(email)
  if (isOwnerEmail(normalizedEmail)) return "owner"
  const rows = await selectMysqlRows<RowDataPacket & {
    id: string
    email: string | null
    is_blocked: boolean | number
  }>(
    "SELECT id, email, is_blocked FROM auth_users WHERE email = ? LIMIT 1",
    [normalizedEmail],
  )
  const user = rows[0]
  if (!user || user.is_blocked) return null
  return getOtpLoginType(user)
}

export async function getOtpLoginTypeByUserId(userId: string): Promise<OtpLoginType | null> {
  const rows = await selectMysqlRows<RowDataPacket & {
    id: string
    email: string | null
    is_blocked: boolean | number
  }>(
    "SELECT id, email, is_blocked FROM auth_users WHERE id = ? LIMIT 1",
    [userId],
  )
  const user = rows[0]
  if (!user || user.is_blocked) return null
  return getOtpLoginType(user)
}

export async function requestPrivilegedLoginOtp(
  email: string,
): Promise<
  | { status: "sent"; otp: string; name: string; retryAfterSeconds: number }
  | { status: "missing" }
  | { status: "cooldown"; retryAfterSeconds: number }
> {
  const normalizedEmail = normalizeEmail(email)
  const rows = await selectMysqlRows<RowDataPacket & {
    id: string
    name: string
    email: string | null
    is_blocked: boolean | number
  }>(
    "SELECT id, name, email, is_blocked FROM auth_users WHERE email = ? LIMIT 1",
    [normalizedEmail],
  )
  const user = rows[0]
  if (!user || user.is_blocked || !await getOtpLoginType(user)) return { status: "missing" }

  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0")
  const now = Date.now()
  return withMysqlTransaction(async (connection) => {
    const [existingRows] = await connection.execute<(RowDataPacket & {
      resend_after: Date | string
    })[]>(
      "SELECT resend_after FROM auth_owner_login_otps WHERE email = ? FOR UPDATE",
      [normalizedEmail],
    )
    const resendAfter = existingRows[0] ? dateValue(existingRows[0].resend_after).getTime() : 0
    if (resendAfter > now) {
      return {
        status: "cooldown" as const,
        retryAfterSeconds: Math.max(1, Math.ceil((resendAfter - now) / 1000)),
      }
    }

    await connection.execute(
      `INSERT INTO auth_owner_login_otps (email, user_id, otp_hash, expires_at, resend_after, attempts)
       VALUES (?, ?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), otp_hash = VALUES(otp_hash),
         expires_at = VALUES(expires_at), resend_after = VALUES(resend_after), attempts = 0`,
      [
        normalizedEmail,
        user.id,
        otpHash(otp),
        new Date(now + OWNER_LOGIN_OTP_DURATION_SECONDS * 1000),
        new Date(now + OWNER_LOGIN_OTP_RESEND_SECONDS * 1000),
      ],
    )
    return {
      status: "sent" as const,
      otp,
      name: user.name,
      retryAfterSeconds: OWNER_LOGIN_OTP_RESEND_SECONDS,
    }
  })
}

export async function verifyPrivilegedLoginOtp(
  email: string,
  otp: string,
): Promise<
  | { status: "verified"; user: AuthUser; token: string; expiresAt: Date }
  | { status: "invalid" | "missing" | "expired" | "attempts-exceeded" }
> {
  const normalizedEmail = normalizeEmail(email)
  const session = sessionToken()
  const result = await withMysqlTransaction(async (connection) => {
    const [rows] = await connection.execute<(RowDataPacket & {
      user_id: string
      otp_hash: string
      expires_at: Date | string
      attempts: number | string
    })[]>(
      "SELECT user_id, otp_hash, expires_at, attempts FROM auth_owner_login_otps WHERE email = ? FOR UPDATE",
      [normalizedEmail],
    )
    const otpRecord = rows[0]
    if (!otpRecord) return { status: "missing" as const }
    if (dateValue(otpRecord.expires_at).getTime() <= Date.now()) {
      await connection.execute("DELETE FROM auth_owner_login_otps WHERE email = ?", [normalizedEmail])
      return { status: "expired" as const }
    }
    if (Number(otpRecord.attempts) >= OWNER_LOGIN_OTP_MAX_ATTEMPTS) {
      await connection.execute("DELETE FROM auth_owner_login_otps WHERE email = ?", [normalizedEmail])
      return { status: "attempts-exceeded" as const }
    }
    if (!equalHash(otpRecord.otp_hash, otpHash(otp))) {
      const attempts = Number(otpRecord.attempts) + 1
      if (attempts >= OWNER_LOGIN_OTP_MAX_ATTEMPTS) {
        await connection.execute("DELETE FROM auth_owner_login_otps WHERE email = ?", [normalizedEmail])
        return { status: "attempts-exceeded" as const }
      }
      await connection.execute(
        "UPDATE auth_owner_login_otps SET attempts = ? WHERE email = ?",
        [attempts, normalizedEmail],
      )
      return { status: "invalid" as const }
    }

    const profile = await findProfileById(connection, otpRecord.user_id, true)
    if (!profile) {
      await connection.execute("DELETE FROM auth_owner_login_otps WHERE email = ?", [normalizedEmail])
      return { status: "missing" as const }
    }
    const [accountRows] = await connection.execute<(RowDataPacket & {
      email: string | null
      is_blocked: boolean | number
    })[]>(
      "SELECT email, is_blocked FROM auth_users WHERE id = ? LIMIT 1",
      [profile.id],
    )
    const account = accountRows[0]
    if (!account || account.is_blocked ||
      !await getOtpLoginType({ id: profile.id, email: account.email }, connection)) {
      await connection.execute("DELETE FROM auth_owner_login_otps WHERE email = ?", [normalizedEmail])
      return { status: "missing" as const }
    }

    await createSessionRecord(connection, profile.id, "email_otp", session)
    await connection.execute("DELETE FROM auth_owner_login_otps WHERE email = ?", [normalizedEmail])
    return { status: "verified" as const, user: toAuthUser(profile) }
  })
  if (result.status !== "verified") return result
  return { ...result, token: session.token, expiresAt: session.expiresAt }
}

export type OAuthProvider = "google" | "twitter" | "telegram"

export class OAuthSignupRequiredError extends Error {
  constructor() {
    super("Create an account before using this provider to sign in.")
    this.name = "OAuthSignupRequiredError"
  }
}

export async function getOrCreateOAuthUser(input: {
  provider: OAuthProvider
  providerUserId: string
  name: string
  email?: string | null
  emailVerified?: boolean
  allowCreate?: boolean
  dateOfBirth?: string
  referralCode?: string
  signupIpHash?: string
}): Promise<AuthUser> {
  const providerUserId = input.providerUserId.trim()
  const name = input.name.trim().slice(0, 100)
  const email = input.email?.trim().toLowerCase() || null
  if (!providerUserId || !name || (email && !input.emailVerified)) {
    throw new Error("The provider did not return a valid verified identity.")
  }
  if (input.allowCreate && !input.signupIpHash) throw new SignupIpUnavailableError()

  try {
    return await withMysqlTransaction(async (connection) => {
      const [identities] = await connection.execute<(RowDataPacket & { user_id: string })[]>(
        `SELECT user_id FROM auth_identities
         WHERE provider = ? AND provider_user_id = ? LIMIT 1`,
        [input.provider, providerUserId],
      )
      if (identities[0]) {
        const profile = await findProfileById(connection, identities[0].user_id)
        if (!profile) throw new Error("The linked social identity has no account profile.")
        return toAuthUser(profile)
      }
      if (!input.allowCreate) throw new OAuthSignupRequiredError()
      if (input.signupIpHash) {
        const [usedIps] = await connection.execute<RowDataPacket[]>(
          "SELECT id FROM auth_users WHERE signup_ip_hash = ? LIMIT 1",
          [input.signupIpHash],
        )
        if (usedIps.length > 0) throw new SignupIpAlreadyUsedError()
      }
      const userId = randomUUID()
      await connection.execute(
        `INSERT INTO auth_users
          (id, public_uid, name, email, date_of_birth, signup_ip_hash)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          generatePublicUserId(),
          name,
          email,
          input.dateOfBirth ?? null,
          input.signupIpHash ?? null,
        ],
      )
      await connection.execute(
        `INSERT INTO auth_identities (provider, provider_user_id, user_id)
         VALUES (?, ?, ?)`,
        [input.provider, providerUserId, userId],
      )
      if (email && input.emailVerified) {
        await grantSignupBonus(connection, userId)
        await attachReferral(connection, input.referralCode?.trim().toUpperCase() ?? null, userId)
      }
      const profile = await findProfileById(connection, userId)
      if (!profile) throw new Error("The social account could not be read after creation.")
      return toAuthUser(profile)
    })
  } catch (error) {
    if (isDuplicateEntry(error)) {
      const [identities] = await getMysqlPool().execute<(RowDataPacket & { user_id: string })[]>(
        `SELECT user_id FROM auth_identities
         WHERE provider = ? AND provider_user_id = ? LIMIT 1`,
        [input.provider, providerUserId],
      )
      if (identities[0]) {
        const [profiles] = await getMysqlPool().execute<ProfileRow[]>(
          `SELECT id, public_uid, name, email, date_of_birth, telegram_username, x_username,
                  name_edit_used, date_of_birth_edit_used
           FROM auth_users WHERE id = ? LIMIT 1`,
          [identities[0].user_id],
        )
        if (profiles[0]) return toAuthUser(profiles[0])
      }
    }
    throw error
  }
}

export async function createSession(
  userId: string,
  authMethod: "password" | "oauth" | "telegram",
): Promise<{ token: string; expiresAt: Date }> {
  const session = sessionToken()
  await getMysqlPool().execute(
    `INSERT INTO auth_sessions (token_hash, user_id, expires_at, auth_method)
     VALUES (?, ?, ?, ?)`,
    [session.tokenHash, userId, session.expiresAt, authMethod],
  )
  return { token: session.token, expiresAt: session.expiresAt }
}

export async function createPasswordResetToken(email: string): Promise<string | null> {
  const normalizedEmail = normalizeEmail(email)
  const token = randomBytes(32).toString("base64url")
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const userRows = await selectMysqlRows<RowDataPacket & { id: string }>(
    "SELECT id FROM auth_users WHERE email = ? LIMIT 1",
    [normalizedEmail],
  )
  const user = userRows[0]
  if (!user) return null
  await withMysqlTransaction(async (connection) => {
    await connection.execute("DELETE FROM auth_password_resets WHERE user_id = ?", [user.id])
    await connection.execute(
      `INSERT INTO auth_password_resets (token_hash, user_id, expires_at)
       VALUES (?, ?, ?)`,
      [tokenHash, user.id, new Date(Date.now() + PASSWORD_RESET_DURATION_SECONDS * 1000)],
    )
  })
  return token
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  const tokenHash = createHash("sha256").update(token).digest("hex")
  await getMysqlPool().execute(
    "DELETE FROM auth_password_resets WHERE token_hash = ?",
    [tokenHash],
  )
}

export async function resetPassword(token: string, password: string): Promise<boolean> {
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const passwordHash = await hashPassword(password)
  return withMysqlTransaction(async (connection) => {
    const [rows] = await connection.execute<(RowDataPacket & {
      user_id: string
      expires_at: Date | string
    })[]>(
      "SELECT user_id, expires_at FROM auth_password_resets WHERE token_hash = ? FOR UPDATE",
      [tokenHash],
    )
    const reset = rows[0]
    if (!reset || dateValue(reset.expires_at).getTime() <= Date.now()) {
      if (reset) await connection.execute("DELETE FROM auth_password_resets WHERE token_hash = ?", [tokenHash])
      return false
    }
    const [updateResult] = await connection.execute<ResultSetHeader>(
      "UPDATE auth_users SET password_hash = ? WHERE id = ?",
      [passwordHash, reset.user_id],
    )
    if (updateResult.affectedRows !== 1) return false
    await connection.execute("DELETE FROM auth_sessions WHERE user_id = ?", [reset.user_id])
    await connection.execute("DELETE FROM auth_password_resets WHERE token_hash = ?", [tokenHash])
    return true
  })
}

export async function findUserBySession(token: string): Promise<AuthUser | null> {
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const rows = await selectMysqlRows<ProfileRow>(
    `SELECT users.id, users.public_uid, users.name, users.email, users.date_of_birth,
            users.telegram_username, users.x_username, users.name_edit_used,
            users.date_of_birth_edit_used
     FROM auth_sessions AS sessions
     INNER JOIN auth_users AS users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > CURRENT_TIMESTAMP(3)
       AND users.is_blocked = FALSE
     LIMIT 1`,
    [tokenHash],
  )
  return rows[0] ? toAuthUser(rows[0]) : null
}

export async function isEmailOtpSession(token: string): Promise<boolean> {
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const rows = await selectMysqlRows<RowDataPacket & { auth_method: string }>(
    `SELECT auth_method FROM auth_sessions
     WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP(3) LIMIT 1`,
    [tokenHash],
  )
  return rows[0]?.auth_method === "email_otp"
}

export class ProfileOneTimeEditError extends Error {
  constructor(field: "name" | "dateOfBirth") {
    super(field === "name"
      ? "Your display name has already used its one-time change."
      : "Your date of birth has already used its one-time change.")
    this.name = "ProfileOneTimeEditError"
  }
}

export async function updateUserProfile(
  userId: string,
  profile: {
    name?: string
    dateOfBirth?: string
    telegramUsername?: string | null
    xUsername?: string | null
  },
): Promise<void> {
  await withMysqlTransaction(async (connection) => {
    const [rows] = await connection.execute<(RowDataPacket & {
      name: string
      date_of_birth: string | Date | null
      telegram_username: string | null
      x_username: string | null
      name_edit_used: boolean | number
      date_of_birth_edit_used: boolean | number
    })[]>(
      `SELECT name, date_of_birth, telegram_username, x_username,
              name_edit_used, date_of_birth_edit_used
       FROM auth_users WHERE id = ? FOR UPDATE`,
      [userId],
    )
    const current = rows[0]
    if (!current) throw new Error("The account profile was not found.")

    const updateName = profile.name !== undefined && profile.name !== current.name
    const oldBirthDate = normalizeDateOfBirth(current.date_of_birth)
    const updateBirthDate = profile.dateOfBirth !== undefined && profile.dateOfBirth !== oldBirthDate
    if (updateName && current.name_edit_used) throw new ProfileOneTimeEditError("name")
    if (updateBirthDate && current.date_of_birth_edit_used) throw new ProfileOneTimeEditError("dateOfBirth")

    await connection.execute(
      `UPDATE auth_users
       SET name = ?, date_of_birth = ?, telegram_username = ?, x_username = ?,
           name_edit_used = ?, date_of_birth_edit_used = ?
       WHERE id = ?`,
      [
        profile.name ?? current.name,
        profile.dateOfBirth ?? current.date_of_birth,
        profile.telegramUsername === undefined ? current.telegram_username : profile.telegramUsername,
        profile.xUsername === undefined ? current.x_username : profile.xUsername,
        Boolean(current.name_edit_used) || updateName,
        Boolean(current.date_of_birth_edit_used) || updateBirthDate,
        userId,
      ],
    )
  })
}

export async function deleteSession(token: string): Promise<void> {
  const tokenHash = createHash("sha256").update(token).digest("hex")
  await getMysqlPool().execute("DELETE FROM auth_sessions WHERE token_hash = ?", [tokenHash])
}

export { SESSION_DURATION_SECONDS }
