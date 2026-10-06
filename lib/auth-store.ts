import { createHash, randomBytes, randomInt, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"
import { getDatabasePool } from "@/lib/database"
import { generatePublicUserId } from "@/lib/public-user-id"
import { SignupIpUnavailableError } from "@/lib/signup-ip"

const scrypt = promisify(scryptCallback)
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60
const EMAIL_OTP_DURATION_SECONDS = 5 * 60
const EMAIL_OTP_RESEND_SECONDS = 120
const EMAIL_REGISTRATION_DURATION_SECONDS = 30 * 60
const EMAIL_OTP_MAX_ATTEMPTS = 5

type UserRow = RowDataPacket & {
  id: string
  public_uid: string
  name: string
  email: string | null
  date_of_birth: string | Date | null
  telegram_username: string | null
  x_username: string | null
  name_edit_used: number | boolean
  date_of_birth_edit_used: number | boolean
  password_hash?: string | null
}

type SessionRow = RowDataPacket & {
  id: string
  public_uid: string
  name: string
  email: string | null
  date_of_birth: string | Date | null
  telegram_username: string | null
  x_username: string | null
  name_edit_used: number | boolean
  date_of_birth_edit_used: number | boolean
  expires_at: Date
}

type PendingRegistrationRow = RowDataPacket & {
  name: string
  email: string
  password_hash: string
  date_of_birth: string
  otp_hash: string
  expires_at: Date | string
  resend_after: Date | string
  registration_expires_at: Date | string
  attempts: number
  otp_valid?: number | string | boolean
  registration_valid?: number | string | boolean
  retry_after_seconds?: number | string
  referral_code: string | null
  signup_ip_hash: string | null
}

export class SignupIpAlreadyUsedError extends Error {
  constructor() {
    super("An account has already been created from this network.")
    this.name = "SignupIpAlreadyUsedError"
  }
}

function isSignupIpUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ER_DUP_ENTRY" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.includes("auth_users_signup_ip_hash_uq")
  )
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

function normalizeDateOfBirth(value: string | Date | null): string | null {
  if (value === null) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10)
}

function toAuthUser(row: UserRow | SessionRow): AuthUser {
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
  dateOfBirth: string
  signupIpHash: string
}): Promise<AuthUser> {
  const id = randomUUID()
  const publicUid = generatePublicUserId()
  const passwordHash = await hashPassword(input.password)
  const [result] = await getDatabasePool().execute<ResultSetHeader>(
    `INSERT INTO auth_users (id, public_uid, name, email, password_hash, date_of_birth, signup_ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, publicUid, input.name, input.email, passwordHash, input.dateOfBirth, input.signupIpHash],
  )
  if (result.affectedRows !== 1) throw new Error("The new account was not saved.")
  return {
    id,
    publicUid,
    name: input.name,
    email: input.email,
    dateOfBirth: input.dateOfBirth,
    telegramUsername: null,
    xUsername: null,
    nameEditUsed: false,
    dateOfBirthEditUsed: false,
  }
}

export async function beginEmailVerification(input: {
  name: string
  email: string
  password: string
  dateOfBirth: string
  signupIpHash: string
  referralCode?: string
}): Promise<{ otp: string }> {
  const [existingUsers] = await getDatabasePool().execute<(RowDataPacket & { id: string })[]>(
    "SELECT id FROM auth_users WHERE signup_ip_hash = ? LIMIT 1",
    [input.signupIpHash],
  )
  if (existingUsers.length > 0) throw new SignupIpAlreadyUsedError()

  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0")
  const [passwordHash, otpHash] = await Promise.all([
    hashPassword(input.password),
    hashPassword(otp),
  ])

  await getDatabasePool().execute(
    `INSERT INTO auth_pending_registrations
       (email, name, password_hash, date_of_birth, signup_ip_hash, referral_code, otp_hash, expires_at, resend_after, registration_expires_at, attempts)
     VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? SECOND),
       DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? SECOND),
       DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? SECOND), 0)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       password_hash = VALUES(password_hash),
       date_of_birth = VALUES(date_of_birth),
       signup_ip_hash = VALUES(signup_ip_hash),
       referral_code = VALUES(referral_code),
       otp_hash = VALUES(otp_hash),
       expires_at = VALUES(expires_at),
       resend_after = VALUES(resend_after),
       registration_expires_at = VALUES(registration_expires_at),
       attempts = 0`,
    [
      input.email,
      input.name,
      passwordHash,
      input.dateOfBirth,
      input.signupIpHash,
      input.referralCode ?? null,
      otpHash,
      EMAIL_OTP_DURATION_SECONDS,
      EMAIL_OTP_RESEND_SECONDS,
      EMAIL_REGISTRATION_DURATION_SECONDS,
    ],
  )
  return { otp }
}

export async function resendPendingRegistrationOtp(
  email: string,
): Promise<
  | { status: "sent"; otp: string }
  | { status: "cooldown"; retryAfterSeconds: number }
  | { status: "missing" | "expired" }
> {
  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0")
  const otpHash = await hashPassword(otp)
  const connection = await getDatabasePool().getConnection()

  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<PendingRegistrationRow[]>(
      `SELECT name, email, password_hash, date_of_birth, otp_hash, expires_at, resend_after, registration_expires_at, attempts,
              registration_expires_at > CURRENT_TIMESTAMP AS registration_valid,
              GREATEST(0, TIMESTAMPDIFF(SECOND, CURRENT_TIMESTAMP, resend_after)) AS retry_after_seconds
       FROM auth_pending_registrations WHERE email = ? FOR UPDATE`,
      [email],
    )
    const pending = rows[0]
    if (!pending) {
      await connection.rollback()
      return { status: "missing" }
    }

    if (Number(pending.registration_valid) !== 1) {
      await connection.execute("DELETE FROM auth_pending_registrations WHERE email = ?", [email])
      await connection.commit()
      return { status: "expired" }
    }

    const retryAfterSeconds = Number(pending.retry_after_seconds)
    if (retryAfterSeconds > 0) {
      await connection.rollback()
      return { status: "cooldown", retryAfterSeconds }
    }

    await connection.execute(
      `UPDATE auth_pending_registrations
       SET otp_hash = ?, expires_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? SECOND),
           resend_after = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? SECOND), attempts = 0
       WHERE email = ?`,
      [otpHash, EMAIL_OTP_DURATION_SECONDS, EMAIL_OTP_RESEND_SECONDS, email],
    )
    await connection.commit()
    return { status: "sent", otp }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function discardPendingRegistration(email: string): Promise<void> {
  await getDatabasePool().execute("DELETE FROM auth_pending_registrations WHERE email = ?", [email])
}

export async function verifyEmailRegistration(
  email: string,
  otp: string,
): Promise<
  | { status: "verified"; user: AuthUser; token: string; expiresAt: Date }
  | { status: "invalid" | "missing" | "expired" | "attempts-exceeded" | "already-registered" | "ip-already-registered" }
> {
  const connection = await getDatabasePool().getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<PendingRegistrationRow[]>(
      `SELECT name, email, password_hash, date_of_birth, signup_ip_hash, referral_code, otp_hash, expires_at, registration_expires_at, attempts,
              expires_at > CURRENT_TIMESTAMP AS otp_valid,
              registration_expires_at > CURRENT_TIMESTAMP AS registration_valid
       FROM auth_pending_registrations WHERE email = ? FOR UPDATE`,
      [email],
    )
    const pending = rows[0]
    if (!pending) {
      await connection.rollback()
      return { status: "missing" }
    }
    if (Number(pending.registration_valid) !== 1) {
      await connection.execute("DELETE FROM auth_pending_registrations WHERE email = ?", [email])
      await connection.commit()
      return { status: "expired" }
    }
    if (!pending.signup_ip_hash) {
      await connection.execute("DELETE FROM auth_pending_registrations WHERE email = ?", [email])
      await connection.commit()
      return { status: "expired" }
    }
    if (Number(pending.otp_valid) !== 1) {
      await connection.rollback()
      return { status: "expired" }
    }
    if (pending.attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
      await connection.execute("DELETE FROM auth_pending_registrations WHERE email = ?", [email])
      await connection.commit()
      return { status: "attempts-exceeded" }
    }
    if (!await verifyPassword(otp, pending.otp_hash)) {
      const attempts = pending.attempts + 1
      await connection.execute(
        attempts >= EMAIL_OTP_MAX_ATTEMPTS
          ? "DELETE FROM auth_pending_registrations WHERE email = ?"
          : "UPDATE auth_pending_registrations SET attempts = ? WHERE email = ?",
        attempts >= EMAIL_OTP_MAX_ATTEMPTS ? [email] : [attempts, email],
      )
      await connection.commit()
      return { status: attempts >= EMAIL_OTP_MAX_ATTEMPTS ? "attempts-exceeded" : "invalid" }
    }

    const [existingUsers] = await connection.execute<UserRow[]>(
      "SELECT id, public_uid, name, email, date_of_birth FROM auth_users WHERE email = ? LIMIT 1",
      [email],
    )
    if (existingUsers.length > 0) {
      await connection.execute("DELETE FROM auth_pending_registrations WHERE email = ?", [email])
      await connection.commit()
      return { status: "already-registered" }
    }

    const id = randomUUID()
    const publicUid = generatePublicUserId()
    await connection.execute(
      `INSERT INTO auth_users (id, public_uid, name, email, password_hash, date_of_birth, signup_ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, publicUid, pending.name, email, pending.password_hash, pending.date_of_birth, pending.signup_ip_hash],
    )
    if (pending.referral_code) {
      const [referrers] = await connection.execute<(RowDataPacket & { user_id: string })[]>(
        "SELECT user_id FROM referral_profiles WHERE referral_code = ? FOR UPDATE",
        [pending.referral_code],
      )
      const referrerId = referrers[0]?.user_id
      if (referrerId && referrerId !== id) {
        await connection.execute(
          `INSERT INTO referrals (id, referrer_id, referee_id, status, status_reason)
           VALUES (?, ?, ?, 'pending', 'Awaiting manual review')`,
          [randomUUID(), referrerId, id],
        )
      }
    }
    await connection.execute("DELETE FROM auth_pending_registrations WHERE email = ?", [email])

    const token = randomBytes(32).toString("base64url")
    const tokenHash = createHash("sha256").update(token).digest("hex")
    const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000)
    await connection.execute(
      "INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
      [tokenHash, id, expiresAt],
    )
    await connection.commit()

    return {
      status: "verified",
      user: {
        id,
        publicUid,
        name: pending.name,
        email,
        dateOfBirth: pending.date_of_birth,
        telegramUsername: null,
        xUsername: null,
        nameEditUsed: false,
        dateOfBirthEditUsed: false,
      },
      token,
      expiresAt,
    }
  } catch (error) {
    await connection.rollback()
    if (isSignupIpUniqueViolation(error)) return { status: "ip-already-registered" }
    throw error
  } finally {
    connection.release()
  }
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  const [rows] = await getDatabasePool().execute<UserRow[]>(
    `SELECT id, public_uid, name, email, date_of_birth, telegram_username, x_username,
            name_edit_used, date_of_birth_edit_used, password_hash
     FROM auth_users WHERE email = ? LIMIT 1`,
    [email],
  )
  const row = rows[0]
  if (!row?.password_hash || !await verifyPassword(password, row.password_hash)) return null
  return toAuthUser(row)
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

  const connection = await getDatabasePool().getConnection()
  try {
    await connection.beginTransaction()
    const [identities] = await connection.execute<(RowDataPacket & {
      id: string
      public_uid: string
      name: string
      email: string | null
      date_of_birth: string | Date | null
      telegram_username: string | null
      x_username: string | null
      name_edit_used: number | boolean
      date_of_birth_edit_used: number | boolean
    })[]>(
      `SELECT users.id, users.public_uid, users.name, users.email, users.date_of_birth,
              users.telegram_username, users.x_username,
              users.name_edit_used, users.date_of_birth_edit_used
       FROM auth_identities AS identities
       JOIN auth_users AS users ON users.id = identities.user_id
       WHERE identities.provider = ? AND identities.provider_user_id = ?
       LIMIT 1 FOR UPDATE`,
      [input.provider, providerUserId],
    )
    if (identities[0]) {
      await connection.commit()
      return {
        id: identities[0].id,
        publicUid: identities[0].public_uid,
        name: identities[0].name,
        email: identities[0].email,
        dateOfBirth: normalizeDateOfBirth(identities[0].date_of_birth),
        telegramUsername: identities[0].telegram_username,
        xUsername: identities[0].x_username,
        nameEditUsed: Boolean(identities[0].name_edit_used),
        dateOfBirthEditUsed: Boolean(identities[0].date_of_birth_edit_used),
      }
    }

    let user: {
      id: string
      public_uid: string
      name: string
      email: string | null
      date_of_birth: string | Date | null
      telegram_username: string | null
      x_username: string | null
      name_edit_used: number | boolean
      date_of_birth_edit_used: number | boolean
    } | undefined
    let createdUser = false
    if (email && input.emailVerified) {
      const [users] = await connection.execute<(RowDataPacket & {
        id: string
        public_uid: string
        name: string
        email: string | null
        date_of_birth: string | Date | null
        telegram_username: string | null
        x_username: string | null
        name_edit_used: number | boolean
        date_of_birth_edit_used: number | boolean
      })[]>(
        `SELECT id, public_uid, name, email, date_of_birth, telegram_username, x_username,
                name_edit_used, date_of_birth_edit_used
         FROM auth_users WHERE email = ? LIMIT 1 FOR UPDATE`,
        [email],
      )
      user = users[0]
    }

    if (!user) {
      if (!input.allowCreate || !input.dateOfBirth) throw new OAuthSignupRequiredError()
      if (!input.signupIpHash) throw new SignupIpUnavailableError()
      user = {
        id: randomUUID(),
        public_uid: generatePublicUserId(),
        name,
        email,
        date_of_birth: input.dateOfBirth,
        telegram_username: null,
        x_username: null,
        name_edit_used: false,
        date_of_birth_edit_used: false,
      }
      createdUser = true
      await connection.execute(
        `INSERT INTO auth_users (id, public_uid, name, email, password_hash, date_of_birth, signup_ip_hash)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`,
        [user.id, user.public_uid, user.name, user.email, input.dateOfBirth, input.signupIpHash],
      )
    }
    if (createdUser && input.referralCode) {
      const [referrers] = await connection.execute<(RowDataPacket & { user_id: string })[]>(
        "SELECT user_id FROM referral_profiles WHERE referral_code = ? FOR UPDATE",
        [input.referralCode.trim().toUpperCase()],
      )
      const referrerId = referrers[0]?.user_id
      if (referrerId && referrerId !== user.id) {
        await connection.execute(
          `INSERT INTO referrals (id, referrer_id, referee_id, status, status_reason)
           VALUES (?, ?, ?, 'pending', 'Awaiting manual review')`,
          [randomUUID(), referrerId, user.id],
        )
      }
    }
    await connection.execute(
      "INSERT INTO auth_identities (provider, provider_user_id, user_id) VALUES (?, ?, ?)",
      [input.provider, providerUserId, user.id],
    )
    await connection.commit()
    return {
      id: user.id,
      publicUid: user.public_uid,
      name: user.name,
      email: user.email,
      dateOfBirth: normalizeDateOfBirth(user.date_of_birth),
      telegramUsername: user.telegram_username,
      xUsername: user.x_username,
      nameEditUsed: Boolean(user.name_edit_used),
      dateOfBirthEditUsed: Boolean(user.date_of_birth_edit_used),
    }
  } catch (error) {
    await connection.rollback()
    if (isSignupIpUniqueViolation(error)) throw new SignupIpAlreadyUsedError()
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      const [identities] = await getDatabasePool().execute<(RowDataPacket & {
        id: string
        public_uid: string
        name: string
        email: string | null
        date_of_birth: string | Date | null
        telegram_username: string | null
        x_username: string | null
        name_edit_used: number | boolean
        date_of_birth_edit_used: number | boolean
      })[]>(
        `SELECT users.id, users.public_uid, users.name, users.email, users.date_of_birth,
                users.telegram_username, users.x_username,
                users.name_edit_used, users.date_of_birth_edit_used
         FROM auth_identities AS identities
         JOIN auth_users AS users ON users.id = identities.user_id
         WHERE identities.provider = ? AND identities.provider_user_id = ?
         LIMIT 1`,
        [input.provider, providerUserId],
      )
      if (identities[0]) {
        return {
          id: identities[0].id,
          publicUid: identities[0].public_uid,
          name: identities[0].name,
          email: identities[0].email,
          dateOfBirth: normalizeDateOfBirth(identities[0].date_of_birth),
          telegramUsername: identities[0].telegram_username,
          xUsername: identities[0].x_username,
          nameEditUsed: Boolean(identities[0].name_edit_used),
          dateOfBirthEditUsed: Boolean(identities[0].date_of_birth_edit_used),
        }
      }
    }
    throw error
  } finally {
    connection.release()
  }
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url")
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000)
  await getDatabasePool().execute(
    `INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)`,
    [tokenHash, userId, expiresAt],
  )
  return { token, expiresAt }
}

export async function createPasswordResetToken(email: string): Promise<string | null> {
  const [users] = await getDatabasePool().execute<UserRow[]>(
    "SELECT id, public_uid, name, email, date_of_birth FROM auth_users WHERE email = ? LIMIT 1",
    [email],
  )
  const user = users[0]
  if (!user) return null

  const token = randomBytes(32).toString("base64url")
  const tokenHash = createHash("sha256").update(token).digest("hex")
  await getDatabasePool().execute(
    `INSERT INTO auth_password_resets (token_hash, user_id, expires_at)
     VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR))`,
    [tokenHash, user.id],
  )
  return token
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  const tokenHash = createHash("sha256").update(token).digest("hex")
  await getDatabasePool().execute("DELETE FROM auth_password_resets WHERE token_hash = ?", [tokenHash])
}

export async function resetPassword(token: string, password: string): Promise<boolean> {
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const passwordHash = await hashPassword(password)
  const connection = await getDatabasePool().getConnection()

  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<(RowDataPacket & { user_id: string })[]>(
      `SELECT user_id FROM auth_password_resets
       WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP
       FOR UPDATE`,
      [tokenHash],
    )
    const reset = rows[0]
    if (!reset) {
      await connection.rollback()
      return false
    }

    await connection.execute("UPDATE auth_users SET password_hash = ? WHERE id = ?", [passwordHash, reset.user_id])
    await connection.execute("DELETE FROM auth_password_resets WHERE user_id = ?", [reset.user_id])
    await connection.execute("DELETE FROM auth_sessions WHERE user_id = ?", [reset.user_id])
    await connection.commit()
    return true
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function findUserBySession(token: string): Promise<AuthUser | null> {
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const [rows] = await getDatabasePool().execute<SessionRow[]>(
    `SELECT users.id, users.public_uid, users.name, users.email, users.date_of_birth,
            users.telegram_username, users.x_username,
            users.name_edit_used, users.date_of_birth_edit_used, sessions.expires_at
     FROM auth_sessions AS sessions
     JOIN auth_users AS users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > CURRENT_TIMESTAMP
     LIMIT 1`,
    [tokenHash],
  )
  return rows[0] ? toAuthUser(rows[0]) : null
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
  const connection = await getDatabasePool().getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<(RowDataPacket & {
      name: string
      date_of_birth: string | Date | null
      name_edit_used: number | boolean
      date_of_birth_edit_used: number | boolean
    })[]>(
      `SELECT name, date_of_birth, name_edit_used, date_of_birth_edit_used
       FROM auth_users WHERE id = ? FOR UPDATE`,
      [userId],
    )
    const current = rows[0]
    if (!current) throw new Error("The account profile could not be found.")

    const updatedName = profile.name !== undefined && profile.name !== current.name
      ? profile.name
      : undefined
    const updatedDateOfBirth = profile.dateOfBirth !== undefined &&
      profile.dateOfBirth !== normalizeDateOfBirth(current.date_of_birth)
      ? profile.dateOfBirth
      : undefined
    const nameChanged = updatedName !== undefined
    const dateOfBirthChanged = updatedDateOfBirth !== undefined
    if (nameChanged && Boolean(current.name_edit_used)) throw new ProfileOneTimeEditError("name")
    if (dateOfBirthChanged && Boolean(current.date_of_birth_edit_used)) {
      throw new ProfileOneTimeEditError("dateOfBirth")
    }

    const updates: string[] = []
    const values: (string | null)[] = []
    if (updatedName !== undefined) {
      updates.push("name = ?", "name_edit_used = 1")
      values.push(updatedName)
    }
    if (updatedDateOfBirth !== undefined) {
      updates.push("date_of_birth = ?", "date_of_birth_edit_used = 1")
      values.push(updatedDateOfBirth)
    }
    if (profile.telegramUsername !== undefined) {
      updates.push("telegram_username = ?")
      values.push(profile.telegramUsername)
    }
    if (profile.xUsername !== undefined) {
      updates.push("x_username = ?")
      values.push(profile.xUsername)
    }
    if (updates.length > 0) {
      await connection.execute(
        `UPDATE auth_users SET ${updates.join(", ")} WHERE id = ?`,
        [...values, userId],
      )
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function deleteSession(token: string): Promise<void> {
  const tokenHash = createHash("sha256").update(token).digest("hex")
  await getDatabasePool().execute("DELETE FROM auth_sessions WHERE token_hash = ?", [tokenHash])
}

export { SESSION_DURATION_SECONDS }
