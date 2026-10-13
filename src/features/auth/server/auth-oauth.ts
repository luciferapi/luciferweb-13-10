import { createHash, randomBytes } from "node:crypto"

export const OAUTH_COOKIE_MAX_AGE = 10 * 60

export function createOAuthState() {
  return randomBytes(32).toString("base64url")
}

export function createPkceVerifier() {
  return randomBytes(32).toString("base64url")
}

export function createPkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url")
}

export function getAuthBaseUrl(requestUrl: string) {
  const configuredUrl = process.env.AUTH_BASE_URL?.trim()
  if (!configuredUrl && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_BASE_URL must be configured for social sign-in in production.")
  }

  const baseUrl = new URL(configuredUrl || new URL(requestUrl).origin)
  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new Error("AUTH_BASE_URL must use HTTP or HTTPS.")
  }
  if (process.env.NODE_ENV === "production" && baseUrl.protocol !== "https:") {
    throw new Error("AUTH_BASE_URL must use HTTPS in production.")
  }
  return baseUrl
}

export function getSafeAuthDestination(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/chat"
  }
  try {
  const authBaseUrl = process.env.AUTH_BASE_URL?.trim()
  if (!authBaseUrl) throw new Error("AUTH_BASE_URL is required for OAuth redirects.")

  const destination = new URL(value, authBaseUrl)
  const base = new URL(authBaseUrl)
    return destination.origin === base.origin
      ? `${destination.pathname}${destination.search}${destination.hash}`
      : "/chat"
  } catch {
    return "/chat"
  }
}

export function isOAuthProvider(value: string): value is "google" | "twitter" {
  return value === "google" || value === "twitter"
}
