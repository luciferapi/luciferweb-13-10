export const consentCookieName = "lucifer_cookie_consent"
export const consentMaxAgeSeconds = 60 * 60 * 24 * 180

export type ConsentRecord = {
  version: 1
  essential: true
  analytics: boolean
  marketing: false
  updatedAt: string
}

export function readConsent(): ConsentRecord | null {
  if (typeof document === "undefined") return null

  const cookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${consentCookieName}=`))
  if (!cookie) return null

  try {
    const value: unknown = JSON.parse(decodeURIComponent(cookie.slice(consentCookieName.length + 1)))
    if (
      typeof value !== "object" ||
      value === null ||
      !("version" in value) || value.version !== 1 ||
      !("essential" in value) || value.essential !== true ||
      !("analytics" in value) || typeof value.analytics !== "boolean" ||
      !("marketing" in value) || value.marketing !== false ||
      !("updatedAt" in value) || typeof value.updatedAt !== "string"
    ) return null

    const updatedAt = Date.parse(value.updatedAt)
    if (!Number.isFinite(updatedAt) || updatedAt > Date.now() || Date.now() - updatedAt > consentMaxAgeSeconds * 1000) {
      return null
    }
    return {
      version: 1,
      essential: true,
      analytics: value.analytics,
      marketing: false,
      updatedAt: value.updatedAt,
    }
  } catch {
    return null
  }
}

export function hasGlobalPrivacyControl(): boolean {
  return typeof navigator !== "undefined" &&
    "globalPrivacyControl" in navigator &&
    Reflect.get(navigator, "globalPrivacyControl") === true
}

export function hasAnalyticsConsent(): boolean {
  return readConsent()?.analytics === true && !hasGlobalPrivacyControl()
}
