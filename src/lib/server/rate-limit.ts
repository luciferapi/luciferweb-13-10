import "server-only"
import { createHmac } from "node:crypto"
import { NextResponse } from "next/server"
import { getClientIpAddress } from "@/features/auth/server/signup-ip"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

type RateLimitResult = {
  allowed: boolean
  retry_after_seconds: number
}

type RateLimitOptions = {
  capacity: number
  refillSeconds: number
  identifiers?: string[]
}

function isRateLimitResult(value: unknown): value is RateLimitResult {
  if (typeof value !== "object" || value === null) return false
  if (!("allowed" in value) || typeof value.allowed !== "boolean") return false
  return "retry_after_seconds" in value &&
    typeof value.retry_after_seconds === "number" &&
    Number.isFinite(value.retry_after_seconds)
}

function getRateLimitSecret(): string {
  const secret = process.env.RATE_LIMIT_HMAC_SECRET?.trim() ||
    process.env.DB_PASSWORD_2?.trim() ||
    process.env.DB_PASSWORD?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!secret) throw new Error("A server-only secret is required for API rate-limit keys.")
  return secret
}

function hashBucket(secret: string, scope: string, identifier: string): string {
  return createHmac("sha256", secret)
    .update(`luciferweb-api-rate-limit:${scope}:${identifier.trim().toLowerCase()}`)
    .digest("hex")
}

export async function enforceRateLimit(
  request: Request,
  scope: string,
  options: RateLimitOptions,
): Promise<NextResponse | null> {
  try {
    const secret = getRateLimitSecret()
    const ipAddress = getClientIpAddress(request)
    const identifiers = options.identifiers ?? []
    const bucketKeys = [
      ...(ipAddress ? [hashBucket(secret, scope, `ip:${ipAddress}`)] : []),
      ...identifiers.map((identifier) =>
        hashBucket(secret, scope, `identifier:${identifier}`),
      ),
      ...(ipAddress || identifiers.length ? [] : [hashBucket(secret, scope, "anonymous")]),
    ]
    const admin = getSupabaseAdminClient()
    if (!admin) throw new Error("Supabase server credentials are not configured.")

    const { data, error } = await admin.rpc("check_api_rate_limit", {
      p_bucket_keys: bucketKeys,
      p_capacity: options.capacity,
      p_refill_seconds: options.refillSeconds,
    } as never)
    if (error) throw error

    const result: unknown = data
    if (!isRateLimitResult(result)) {
      throw new Error("The Supabase rate-limit RPC returned an invalid result.")
    }
    if (result.allowed) return null

    const retryAfterSeconds = Math.max(1, Math.ceil(result.retry_after_seconds))
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again.", retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown rate-limit error."
    console.error(`Could not enforce ${scope} rate limit.`, error)
    if (message === "A server-only secret is required for API rate-limit keys." || message === "Supabase server credentials are not configured.") {
      return null
    }
    return NextResponse.json({ error: "This service is temporarily unavailable. Please try again later." }, { status: 503 })
  }
}
