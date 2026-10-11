import "server-only"
import { createHash, createHmac, randomBytes, randomInt, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { getSupabaseEnv } from "@/lib/supabase"
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
const OWNER_LOGIN_OTP_RESEND_SECONDS = 2 * 60
const OWNER_LOGIN_OTP_MAX_ATTEMPTS = 5
const PASSWORD_RESET_DURATION_SECONDS = 60 * 60
const PASSWORD_RESET_CLAIM_DURATION_SECONDS = 10 * 60

type ProfileRow = {
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

type RpcResult = {
  status: string
  name?: string
  retry_after_seconds?: number
  auth_user_id?: string
  discard_auth_user?: boolean
  user?: ProfileRow
  user_id?: string
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

function requireAdminClient() {
  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase server credentials are not configured.")
  return client
}

function getPublicAuthClient() {
  const { url, key, enabled } = getSupabaseEnv()
  if (!enabled || !url || !key) throw new Error("Supabase Auth is not configured.")
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

async function callRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireAdminClient().rpc(name, args as never)
  if (error) throw error
  return data as T
}

function throwIfSignupIpConflict(error: unknown): void {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    /signup_ip_hash|signup ip/i.test(error.message)
  ) {
    throw new SignupIpAlreadyUsedError()
  }
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

function otpHash(otp: string): string {
  const key = process.env.AUTH_OTP_HMAC_SECRET?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) throw new Error("A server-only Supabase secret is required to protect OTP records.")
  return createHmac("sha256", key).update(otp).digest("hex")
}

function sessionToken() {
  const token = randomBytes(32).toString("base64url")
  return {
    token,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + SESSION_DURATION_SECONDS * 1000),
  }
}

function rpcUser(result: RpcResult): AuthUser {
  if (!result.user) throw new Error("The Supabase auth RPC did not return a profile.")
  return toAuthUser(result.user)
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error.code === "23505" || error.code === "user_already_exists")
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
  const admin = requireAdminClient()
  const email = input.email.trim().toLowerCase()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name },
  })
  if (error) {
    throwIfSignupIpConflict(error)
    throw error
  }
  if (!data.user) throw new Error("Supabase Auth did not return the new user.")

  const profileId = randomUUID()
  const publicUid = generatePublicUserId()
  try {
    const result = await callRpc<RpcResult>("auth_create_user_profile", {
      p_profile_id: profileId,
      p_supabase_user_id: data.user.id,
      p_public_uid: publicUid,
      p_name: input.name,
      p_email: email,
      p_date_of_birth: input.dateOfBirth ?? null,
      p_signup_ip_hash: input.signupIpHash,
    })
    if (result.status === "ip-already-registered") throw new SignupIpAlreadyUsedError()
    if (result.status !== "created" || !result.user) {
      throw new Error("The Supabase profile RPC did not create the account.")
    }
    return toAuthUser(result.user)
  } catch (caught) {
    await admin.auth.admin.deleteUser(data.user.id)
    if (caught instanceof SignupIpAlreadyUsedError) {
      throw caught
    }
    throwIfSignupIpConflict(caught)
    throw caught
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
  const admin = requireAdminClient()
  const email = input.email.trim().toLowerCase()
  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0")
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name },
  })
  if (error) {
    throwIfSignupIpConflict(error)
    throw error
  }
  if (!data.user) throw new Error("Supabase Auth did not return the pending user.")

  const now = Date.now()
  try {
    const result = await callRpc<RpcResult>("auth_begin_email_verification", {
      p_auth_user_id: data.user.id,
      p_email: email,
      p_name: input.name,
      p_date_of_birth: input.dateOfBirth ?? null,
      p_signup_ip_hash: input.signupIpHash,
      p_referral_code: input.referralCode ?? null,
      p_otp_hash: otpHash(otp),
      p_otp_expires_at: new Date(now + EMAIL_OTP_DURATION_SECONDS * 1000).toISOString(),
      p_resend_after: new Date(now + EMAIL_OTP_RESEND_SECONDS * 1000).toISOString(),
      p_registration_expires_at: new Date(now + EMAIL_REGISTRATION_DURATION_SECONDS * 1000).toISOString(),
    })
    if (result.status === "ip-already-registered") throw new SignupIpAlreadyUsedError()
    if (result.status !== "sent") throw new Error("The Supabase registration RPC did not save the OTP.")
    return { otp }
  } catch (caught) {
    await admin.auth.admin.deleteUser(data.user.id)
    if (caught instanceof SignupIpAlreadyUsedError) {
      throw caught
    }
    throwIfSignupIpConflict(caught)
    throw caught
  }
}

export async function resendPendingRegistrationOtp(
  email: string,
): Promise<
  | { status: "sent"; otp: string; name: string }
  | { status: "cooldown"; retryAfterSeconds: number }
  | { status: "missing" | "expired" }
> {
  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0")
  const result = await callRpc<RpcResult>("auth_resend_pending_registration_otp", {
    p_email: email.trim().toLowerCase(),
    p_otp_hash: otpHash(otp),
    p_otp_duration_seconds: EMAIL_OTP_DURATION_SECONDS,
    p_resend_seconds: EMAIL_OTP_RESEND_SECONDS,
    p_max_attempts: EMAIL_OTP_MAX_ATTEMPTS,
  })

  if (result.status === "sent") {
    if (!result.name) throw new Error("The Supabase resend RPC did not return the pending user's name.")
    return { status: "sent", otp, name: result.name }
  }
  if (result.status === "cooldown") {
    return { status: "cooldown", retryAfterSeconds: Number(result.retry_after_seconds ?? 0) }
  }
  if (result.status === "expired") {
    if (result.auth_user_id) await requireAdminClient().auth.admin.deleteUser(result.auth_user_id)
    return { status: "expired" }
  }
  return { status: "missing" }
}

export async function discardPendingRegistration(email: string): Promise<void> {
  const admin = requireAdminClient()
  const normalizedEmail = email.trim().toLowerCase()
  const { data, error } = await admin
    .from("auth_pending_registrations")
    .select("auth_user_id")
    .eq("email", normalizedEmail)
    .maybeSingle()
  if (error) throw error

  const { error: deleteError } = await admin
    .from("auth_pending_registrations")
    .delete()
    .eq("email", normalizedEmail)
  if (deleteError) throw deleteError

  const authUserId = data?.auth_user_id as string | undefined
  if (authUserId) {
    const { data: profile, error: profileError } = await admin
      .from("auth_users")
      .select("id")
      .eq("id", authUserId)
      .maybeSingle()
    if (profileError) throw profileError
    if (!profile) await admin.auth.admin.deleteUser(authUserId)
  }
}

export async function verifyEmailRegistration(
  email: string,
  otp: string,
): Promise<
  | { status: "verified"; user: AuthUser; token: string; expiresAt: Date }
  | { status: "invalid" | "missing" | "expired" | "attempts-exceeded" | "already-registered" | "ip-already-registered" }
> {
  const session = sessionToken()
  const profileId = randomUUID()
  const result = await callRpc<RpcResult>("auth_verify_email_registration", {
    p_email: email.trim().toLowerCase(),
    p_otp_hash: otpHash(otp),
    p_profile_id: profileId,
    p_session_token_hash: session.tokenHash,
    p_session_expires_at: session.expiresAt.toISOString(),
    p_public_uid: generatePublicUserId(),
    p_max_attempts: EMAIL_OTP_MAX_ATTEMPTS,
  })
  if (result.discard_auth_user && result.auth_user_id) {
    await requireAdminClient().auth.admin.deleteUser(result.auth_user_id)
  }
  if (result.status !== "verified") {
    if (
      result.status === "invalid" ||
      result.status === "missing" ||
      result.status === "expired" ||
      result.status === "attempts-exceeded" ||
      result.status === "already-registered" ||
      result.status === "ip-already-registered"
    ) {
      return { status: result.status }
    }
    throw new Error("The Supabase email verification RPC returned an unknown status.")
  }
  return {
    status: "verified",
    user: rpcUser(result),
    token: session.token,
    expiresAt: session.expiresAt,
  }
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  const { data, error } = await getPublicAuthClient().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) {
    if (
      "code" in error &&
      ["invalid_credentials", "user_not_found", "email_not_confirmed"].includes(String(error.code))
    ) {
      return null
    }
    throw error
  }
  if (!data.user) return null

  const { data: identity, error: identityError } = await requireAdminClient()
    .from("auth_identities")
    .select("user_id")
    .eq("provider", "supabase")
    .eq("provider_user_id", data.user.id)
    .maybeSingle()
  if (identityError) throw identityError
  if (!identity?.user_id) return null

  const { data: profile, error: profileError } = await requireAdminClient()
    .from("auth_users")
    .select("*")
    .eq("id", identity.user_id)
    .maybeSingle()
  if (profileError) throw profileError
  return profile ? toAuthUser(profile as ProfileRow) : null
}

export async function findUserBySupabaseAuthId(authUserId: string): Promise<AuthUser | null> {
  const admin = getSupabaseAdminClient()
  if (!admin) return null
  const { data: identity, error: identityError } = await admin
    .from("auth_identities")
    .select("user_id")
    .eq("provider", "supabase")
    .eq("provider_user_id", authUserId)
    .maybeSingle()
  if (identityError) throw identityError
  if (!identity) return null

  const { data: profile, error: profileError } = await admin
    .from("auth_users")
    .select("*")
    .eq("id", identity.user_id)
    .maybeSingle()
  if (profileError) throw profileError
  return profile ? toAuthUser(profile as ProfileRow) : null
}

export async function requestOwnerLoginOtp(
  email: string,
): Promise<
  | { status: "sent"; otp: string; name: string; retryAfterSeconds: number }
  | { status: "missing" }
  | { status: "cooldown"; retryAfterSeconds: number }
> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!isOwnerEmail(normalizedEmail)) return { status: "missing" }

  const admin = requireAdminClient()
  const { data: owner, error } = await admin
    .from("auth_users")
    .select("id,name")
    .eq("email", normalizedEmail)
    .maybeSingle()
  if (error) throw error
  if (!owner) return { status: "missing" }

  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0")
  const expiresAt = new Date(Date.now() + OWNER_LOGIN_OTP_DURATION_SECONDS * 1000)
  const result = await callRpc<RpcResult>("auth_request_owner_login_otp", {
    p_email: normalizedEmail,
    p_user_id: owner.id,
    p_otp_hash: otpHash(otp),
    p_expires_at: expiresAt.toISOString(),
  })
  if (result.status === "cooldown") {
    return {
      status: "cooldown",
      retryAfterSeconds: Math.max(1, result.retry_after_seconds ?? OWNER_LOGIN_OTP_RESEND_SECONDS),
    }
  }
  if (result.status !== "sent") return { status: "missing" }
  return {
    status: "sent",
    otp,
    name: owner.name as string,
    retryAfterSeconds: OWNER_LOGIN_OTP_RESEND_SECONDS,
  }
}

export async function verifyOwnerLoginOtp(
  email: string,
  otp: string,
): Promise<
  | { status: "verified"; user: AuthUser; token: string; expiresAt: Date }
  | { status: "invalid" | "missing" | "expired" | "attempts-exceeded" }
> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!isOwnerEmail(normalizedEmail)) return { status: "missing" }

  const session = sessionToken()
  const result = await callRpc<RpcResult>("auth_verify_owner_login_otp", {
    p_email: normalizedEmail,
    p_otp_hash: otpHash(otp),
    p_session_token_hash: session.tokenHash,
    p_session_expires_at: session.expiresAt.toISOString(),
    p_max_attempts: OWNER_LOGIN_OTP_MAX_ATTEMPTS,
  })
  if (result.status !== "verified") {
    if (
      result.status === "invalid" ||
      result.status === "missing" ||
      result.status === "expired" ||
      result.status === "attempts-exceeded"
    ) {
      return { status: result.status }
    }
    throw new Error("The Supabase owner OTP RPC returned an unknown status.")
  }
  return {
    status: "verified",
    user: rpcUser(result),
    token: session.token,
    expiresAt: session.expiresAt,
  }
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
    const result = await callRpc<RpcResult>("auth_get_or_create_oauth_user", {
      p_provider: input.provider,
      p_provider_user_id: providerUserId,
      p_name: name,
      p_email: email,
      p_email_verified: Boolean(input.emailVerified),
      p_allow_create: Boolean(input.allowCreate),
      p_date_of_birth: input.dateOfBirth ?? null,
      p_referral_code: input.referralCode?.trim().toUpperCase() ?? null,
      p_signup_ip_hash: input.signupIpHash ?? null,
      p_public_uid: generatePublicUserId(),
    })
    if (result.status === "signup-required") throw new OAuthSignupRequiredError()
    if (result.status === "ip-already-registered") throw new SignupIpAlreadyUsedError()
    if (result.status !== "found" && result.status !== "created") {
      throw new Error("The Supabase identity RPC returned an unknown status.")
    }
    return rpcUser(result)
  } catch (error) {
    throwIfSignupIpConflict(error)
    if (isUniqueViolation(error)) {
      const { data, error: lookupError } = await requireAdminClient()
        .from("auth_identities")
        .select("user_id")
        .eq("provider", input.provider)
        .eq("provider_user_id", providerUserId)
        .maybeSingle()
      if (lookupError) throw lookupError
      if (data?.user_id) {
        const { data: profile, error: profileError } = await requireAdminClient()
          .from("auth_users")
          .select("*")
          .eq("id", data.user_id)
          .maybeSingle()
        if (profileError) throw profileError
        if (profile) return toAuthUser(profile as ProfileRow)
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
  const { error } = await requireAdminClient()
    .from("auth_sessions")
    .insert({
      token_hash: session.tokenHash,
      user_id: userId,
      expires_at: session.expiresAt.toISOString(),
      auth_method: authMethod,
    })
  if (error) throw error
  return { token: session.token, expiresAt: session.expiresAt }
}

export async function createPasswordResetToken(email: string): Promise<string | null> {
  const token = randomBytes(32).toString("base64url")
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const result = await callRpc<RpcResult>("auth_create_password_reset_token", {
    p_email: email.trim().toLowerCase(),
    p_token_hash: tokenHash,
    p_expires_at: new Date(Date.now() + PASSWORD_RESET_DURATION_SECONDS * 1000).toISOString(),
  })
  return result.status === "created" ? token : null
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const { error } = await requireAdminClient()
    .from("auth_password_resets")
    .delete()
    .eq("token_hash", tokenHash)
  if (error) throw error
}

export async function resetPassword(token: string, password: string): Promise<boolean> {
  const admin = requireAdminClient()
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const claimToken = randomUUID()
  const claimed = await callRpc<RpcResult>("auth_claim_password_reset_token", {
    p_token_hash: tokenHash,
    p_claim_token: claimToken,
    p_claim_expires_at: new Date(Date.now() + PASSWORD_RESET_CLAIM_DURATION_SECONDS * 1000).toISOString(),
  })
  if (claimed.status !== "claimed" || !claimed.auth_user_id) return false

  const { error } = await admin.auth.admin.updateUserById(claimed.auth_user_id, { password })
  if (error) {
    await callRpc<RpcResult>("auth_complete_password_reset", {
      p_token_hash: tokenHash,
      p_claim_token: claimToken,
      p_success: false,
    })
    throw error
  }

  const completed = await callRpc<RpcResult>("auth_complete_password_reset", {
    p_token_hash: tokenHash,
    p_claim_token: claimToken,
    p_success: true,
  })
  return completed.status === "completed"
}

export async function findUserBySession(token: string): Promise<AuthUser | null> {
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const { data: session, error } = await requireAdminClient()
    .from("auth_sessions")
    .select("user_id,expires_at")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()
  if (error) throw error
  if (!session) return null

  const { data: profile, error: profileError } = await requireAdminClient()
    .from("auth_users")
    .select("*")
    .eq("id", session.user_id)
    .maybeSingle()
  if (profileError) throw profileError
  return profile ? toAuthUser(profile as ProfileRow) : null
}

export async function isEmailOtpSession(token: string): Promise<boolean> {
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const { data, error } = await requireAdminClient()
    .from("auth_sessions")
    .select("auth_method")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()
  if (error) throw error
  return data?.auth_method === "email_otp"
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
  const result = await callRpc<RpcResult>("auth_update_user_profile", {
    p_user_id: userId,
    p_name: profile.name ?? null,
    p_date_of_birth: profile.dateOfBirth ?? null,
    p_telegram_username: profile.telegramUsername ?? null,
    p_x_username: profile.xUsername ?? null,
    p_update_name: profile.name !== undefined,
    p_update_date_of_birth: profile.dateOfBirth !== undefined,
    p_update_telegram_username: profile.telegramUsername !== undefined,
    p_update_x_username: profile.xUsername !== undefined,
  })
  if (result.status === "name-already-edited") throw new ProfileOneTimeEditError("name")
  if (result.status === "date-of-birth-already-edited") throw new ProfileOneTimeEditError("dateOfBirth")
  if (result.status !== "updated" && result.status !== "unchanged") {
    throw new Error("The Supabase profile RPC did not update the profile.")
  }
}

export async function deleteSession(token: string): Promise<void> {
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const { error } = await requireAdminClient()
    .from("auth_sessions")
    .delete()
    .eq("token_hash", tokenHash)
  if (error) throw error
}

export { SESSION_DURATION_SECONDS }
