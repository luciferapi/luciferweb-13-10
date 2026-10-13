import "server-only"
import { createHmac } from "node:crypto"
import { NextResponse } from "next/server"
import { getClientIpAddress } from "@/features/auth/server/signup-ip"
import { withMysqlTransaction } from "@/lib/mysql"
import type { RowDataPacket } from "mysql2"

type RateLimitOptions = {
  capacity: number
  refillSeconds: number
  identifiers?: string[]
}

function getRateLimitSecret(): string {
  const secret = process.env.RATE_LIMIT_HMAC_SECRET?.trim()
  if (!secret) throw new Error("RATE_LIMIT_HMAC_SECRET is required for API rate-limit keys.")
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
  const ipAddress = getClientIpAddress(request)
  if (!ipAddress) {
    console.error(`Could not enforce ${scope} rate limit because the client IP is unavailable.`)
    return NextResponse.json({ error: "This service is temporarily unavailable. Please try again later." }, { status: 503 })
  }

  try {
    const secret = getRateLimitSecret()
    const bucketKeys = [
      hashBucket(secret, scope, `ip:${ipAddress}`),
      ...(options.identifiers ?? []).map((identifier) =>
        hashBucket(secret, scope, `identifier:${identifier}`),
      ),
    ]
    const result = await withMysqlTransaction(async (connection) => {
      const sortedBucketKeys = [...new Set(bucketKeys)].sort()
      const now = Date.now()
      const buckets: { bucketKey: string; tokens: number; updatedAt: number }[] = []

      for (const bucketKey of sortedBucketKeys) {
        await connection.execute(
          `INSERT IGNORE INTO api_rate_limit_buckets (bucket_key, tokens, updated_at, expires_at)
           VALUES (?, ?, CURRENT_TIMESTAMP(3), DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 1 DAY))`,
          [bucketKey, options.capacity],
        )
        const [rows] = await connection.execute<(RowDataPacket & {
          tokens: string | number
          updated_at: Date | string
        })[]>(
          "SELECT tokens, updated_at FROM api_rate_limit_buckets WHERE bucket_key = ? FOR UPDATE",
          [bucketKey],
        )
        const row = rows[0]
        if (!row) throw new Error("The rate-limit bucket was not available after insertion.")
        const updatedAt = row.updated_at instanceof Date
          ? row.updated_at.getTime()
          : new Date(row.updated_at).getTime()
        if (!Number.isFinite(updatedAt)) throw new Error("The rate-limit bucket has an invalid timestamp.")
        const elapsedSeconds = Math.max(0, (now - updatedAt) / 1000)
        const tokens = Math.min(
          options.capacity,
          Number(row.tokens) + elapsedSeconds / options.refillSeconds,
        )
        buckets.push({ bucketKey, tokens, updatedAt })
      }

      const blocked = buckets
        .filter((bucket) => bucket.tokens < 1)
        .map((bucket) => (1 - bucket.tokens) * options.refillSeconds)
      if (blocked.length > 0) {
        return { allowed: false, retry_after_seconds: Math.max(...blocked) }
      }

      for (const bucket of buckets) {
        await connection.execute(
          `UPDATE api_rate_limit_buckets
           SET tokens = ?, updated_at = CURRENT_TIMESTAMP(3),
               expires_at = DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 1 DAY)
           WHERE bucket_key = ?`,
          [bucket.tokens - 1, bucket.bucketKey],
        )
      }

      await connection.execute(
        "DELETE FROM api_rate_limit_buckets WHERE expires_at <= CURRENT_TIMESTAMP(3)",
      )
      return { allowed: true, retry_after_seconds: 0 }
    })
    if (result.allowed) return null

    const retryAfterSeconds = Math.max(1, Math.ceil(result.retry_after_seconds))
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again.", retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    )
  } catch (error) {
    console.error(`Could not enforce ${scope} rate limit.`, error)
    return NextResponse.json({ error: "This service is temporarily unavailable. Please try again later." }, { status: 503 })
  }
}
