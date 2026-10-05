import { createHash, randomBytes, randomInt, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"
import { getDatabasePool } from "@/lib/database"

const scrypt = promisify(scryptCallback)
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60
const EMAIL_OTP_DURATION_SECONDS = 5 * 60
const EMAIL_OTP_RESEND_SECONDS = 120
const EMAIL_REGISTRATION_DURATION_SECONDS = 30 * 60
const EMAIL_OTP_MAX_ATTEMPTS = 5

type UserRow = RowDataPacket & {
  id: string
  name: string
  email: string
  date_of_birth: string
}

type SessionRow = RowDataPacket & {
  id: string
  name: string
  email: string
  date_of_birth: string
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
}

export type AuthUser = {
  id: string
  name: string
  email: string
}

function toAuthUser(row: UserRow | SessionRow): AuthUser {
  return { id: row.id, name: row.name, email: row.email }
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
}): Promise<AuthUser> {
  const id = randomUUID()
  const passwordHash = await hashPassword(input.password)
  const [result] = await getDatabasePool().execute<ResultSetHeader>(
    `INSERT INTO auth_users (id, name, email, password_hash, date_of_birth)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.name, input.email, passwordHash, input.dateOfBirth],
  )
  if (result.affectedRows !== 1) throw new Error("The new account was not saved.")
  return { id, name: input.name, email: input.email }
}

export async function beginEmailVerification(input: {
  name: string
  email: string
  password: string
  dateOfBirth: string
  referralCode?: string
}): Promise<{ otp: string }> {
  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0")
  const [passwordHash, otpHash] = await Promise.all([
    hashPassword(input.password),
    hashPassword(otp),
  ])

  await getDatabasePool().execute(
    `INSERT INTO auth_pending_registrations
       (email, name, password_hash, date_of_birth, referral_code, otp_hash, expires_at, resend_after, registration_expires_at, attempts)
     VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? SECOND),
       DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? SECOND),
       DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? SECOND), 0)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       password_hash = VALUES(password_hash),
       date_of_birth = VALUES(date_of_birth),
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
  | { status: "invalid" | "missing" | "expired" | "attempts-exceeded" | "already-registered" }
> {
  const connection = await getDatabasePool().getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<PendingRegistrationRow[]>(
      `SELECT name, email, password_hash, date_of_birth, referral_code, otp_hash, expires_at, registration_expires_at, attempts,
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
      "SELECT id, name, email, date_of_birth FROM auth_users WHERE email = ? LIMIT 1",
      [email],
    )
    if (existingUsers.length > 0) {
      await connection.execute("DELETE FROM auth_pending_registrations WHERE email = ?", [email])
      await connection.commit()
      return { status: "already-registered" }
    }

    const id = randomUUID()
    await connection.execute(
      `INSERT INTO auth_users (id, name, email, password_hash, date_of_birth)
       VALUES (?, ?, ?, ?, ?)`,
      [id, pending.name, email, pending.password_hash, pending.date_of_birth],
    )
    if (pending.referral_code) {
      const [referrers] = await connection.execute<(RowDataPacket & { user_id: string })[]>(
        "SELECT user_id FROM referral_profiles WHERE referral_code = ? FOR UPDATE",
        [pending.referral_code],
      )
      const referrerId = referrers[0]?.user_id
      if (referrerId && referrerId !== id) {
        await connection.execute(
          `INSERT INTO referrals (id, referrer_id, referee_id, status)
           VALUES (?, ?, ?, 'pending')`,
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
      user: { id, name: pending.name, email },
      token,
      expiresAt,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  const [rows] = await getDatabasePool().execute<UserRow[]>(
    `SELECT id, name, email, date_of_birth, password_hash
     FROM auth_users WHERE email = ? LIMIT 1`,
    [email],
  )
  const row = rows[0] as (UserRow & { password_hash: string }) | undefined
  if (!row || !await verifyPassword(password, row.password_hash)) return null
  return toAuthUser(row)
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
    "SELECT id, name, email, date_of_birth FROM auth_users WHERE email = ? LIMIT 1",
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
    `SELECT users.id, users.name, users.email, users.date_of_birth, sessions.expires_at
     FROM auth_sessions AS sessions
     JOIN auth_users AS users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > CURRENT_TIMESTAMP
     LIMIT 1`,
    [tokenHash],
  )
  return rows[0] ? toAuthUser(rows[0]) : null
}

export async function updateUserName(userId: string, name: string): Promise<void> {
  await getDatabasePool().execute("UPDATE auth_users SET name = ? WHERE id = ?", [name, userId])
}

export async function deleteSession(token: string): Promise<void> {
  const tokenHash = createHash("sha256").update(token).digest("hex")
  await getDatabasePool().execute("DELETE FROM auth_sessions WHERE token_hash = ?", [tokenHash])
}

export { SESSION_DURATION_SECONDS }
