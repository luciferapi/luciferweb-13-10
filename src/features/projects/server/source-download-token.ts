import "server-only"

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"

type SourceDownloadClaims = {
  projectId: string
  paymentId: string
  expiresAt: number
  nonce: string
}

function tokenSecret() {
  // Keep the payment-secret fallback for existing deployments until the dedicated key is configured.
  return process.env.SOURCE_DOWNLOAD_TOKEN_SECRET?.trim() || process.env.RAZORPAY_KEY_SECRET
}

export function createSourceDownloadToken(projectId: string, paymentId: string) {
  const secret = tokenSecret()
  if (!secret) return null

  const claims: SourceDownloadClaims = {
    projectId,
    paymentId,
    expiresAt: Math.floor(Date.now() / 1000) + 10 * 60,
    nonce: randomUUID(),
  }
  const encodedClaims = Buffer.from(JSON.stringify(claims)).toString("base64url")
  const signature = createHmac("sha256", secret).update(encodedClaims).digest("base64url")
  return `${encodedClaims}.${signature}`
}

export function verifySourceDownloadToken(token: string): SourceDownloadClaims | null {
  const secret = tokenSecret()
  if (!secret || token.length > 2048) return null

  const [encodedClaims, providedSignature, extra] = token.split(".")
  if (!encodedClaims || !providedSignature || extra !== undefined) return null

  const expectedSignature = createHmac("sha256", secret).update(encodedClaims).digest()
  let providedSignatureBytes: Buffer
  try {
    providedSignatureBytes = Buffer.from(providedSignature, "base64url")
  } catch {
    return null
  }
  if (expectedSignature.length !== providedSignatureBytes.length || !timingSafeEqual(expectedSignature, providedSignatureBytes)) return null

  try {
    const claims = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8")) as Partial<SourceDownloadClaims>
    if (
      typeof claims.projectId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(claims.projectId) ||
      typeof claims.paymentId !== "string" ||
      typeof claims.expiresAt !== "number" ||
      claims.expiresAt <= Math.floor(Date.now() / 1000) ||
      typeof claims.nonce !== "string"
    ) return null

    return claims as SourceDownloadClaims
  } catch {
    return null
  }
}
