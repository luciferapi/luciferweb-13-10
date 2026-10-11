"use client"

import Link from "next/link"
import { useEffect, useState, type ComponentType } from "react"
import { COOKIE_SETTINGS_EVENT } from "@/components/layout/cookie-consent-events"
import { sanitizeAnalyticsEvent } from "@/lib/analytics"
import { consentCookieName, consentMaxAgeSeconds, hasGlobalPrivacyControl, readConsent, type ConsentRecord } from "@/lib/cookie-consent"
import type { AnalyticsProps } from "@vercel/analytics/next"

function saveConsent(analytics: boolean): ConsentRecord {
  const record: ConsentRecord = {
    version: 1,
    essential: true,
    analytics,
    marketing: false,
    updatedAt: new Date().toISOString(),
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${consentCookieName}=${encodeURIComponent(JSON.stringify(record))}; Path=/; Max-Age=${consentMaxAgeSeconds}; SameSite=Lax${secure}`

  const persistedRecord = readConsent()
  if (persistedRecord?.updatedAt !== record.updatedAt || persistedRecord.analytics !== analytics) {
    throw new Error("Your cookie preference could not be saved. Check your browser's cookie settings and try again.")
  }
  return record
}

export function CookieConsentManager() {
  const [initialized, setInitialized] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [hasGpc, setHasGpc] = useState(false)
  const [savedConsent, setSavedConsent] = useState<ConsentRecord | null>(null)
  const [saveError, setSaveError] = useState("")
  const [AnalyticsComponent, setAnalyticsComponent] = useState<ComponentType<AnalyticsProps> | null>(null)

  useEffect(() => {
    const gpcEnabled = hasGlobalPrivacyControl()
    const consent = readConsent()
    setHasGpc(gpcEnabled)
    setSavedConsent(consent)
    setAnalytics(consent?.analytics === true && !gpcEnabled)
    setIsOpen(consent === null)
    setInitialized(true)

    const openSettings = () => {
      setShowPreferences(true)
      setIsOpen(true)
      setSaveError("")
    }
    window.addEventListener(COOKIE_SETTINGS_EVENT, openSettings)
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, openSettings)
  }, [])

  useEffect(() => {
    if (!initialized || savedConsent?.analytics !== true || hasGpc) {
      setAnalyticsComponent(null)
      return
    }

    let cancelled = false
    import("@vercel/analytics/next")
      .then(({ Analytics: VercelAnalytics }) => {
        if (!cancelled) setAnalyticsComponent(() => VercelAnalytics)
      })
      .catch((error: unknown) => {
        console.error("Could not load consented Vercel Analytics.", error)
      })

    return () => {
      cancelled = true
    }
  }, [hasGpc, initialized, savedConsent?.analytics])

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return

    const channel = new BroadcastChannel("lucifer-cookie-consent")
    const syncConsent = () => {
      const consent = readConsent()
      if (!consent) return
      if (savedConsent?.analytics === true && !consent.analytics) {
        window.location.reload()
        return
      }
      setSavedConsent(consent)
      setAnalytics(consent.analytics && !hasGpc)
    }
    channel.addEventListener("message", syncConsent)
    return () => {
      channel.removeEventListener("message", syncConsent)
      channel.close()
    }
  }, [hasGpc, savedConsent?.analytics])

  function savePreferences(nextAnalytics: boolean) {
    setSaveError("")
    try {
      const consent = saveConsent(hasGpc ? false : nextAnalytics)
      const analyticsWasRevoked = savedConsent?.analytics === true && !consent.analytics
      setSavedConsent(consent)
      setAnalytics(consent.analytics)
      setIsOpen(false)
      setShowPreferences(false)
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("lucifer-cookie-consent")
        channel.postMessage("updated")
        channel.close()
      }
      if (analyticsWasRevoked) window.location.reload()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Your cookie preference could not be saved.")
    }
  }

  const OptionalAnalytics = AnalyticsComponent

  return (
    <>
      {OptionalAnalytics ? <OptionalAnalytics beforeSend={sanitizeAnalyticsEvent} /> : null}
      {initialized && isOpen ? (
        <section
          aria-labelledby="cookie-consent-title"
          className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-3xl rounded-2xl border border-border bg-background p-5 text-foreground shadow-2xl sm:inset-x-6 sm:bottom-6 sm:p-6"
          role="region"
          aria-label="Cookie and privacy preferences"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xl">
              <h2 id="cookie-consent-title" className="text-base font-semibold">Your privacy choices</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Essential cookies support sign-in and security. First-party browser storage remembers choices or content for features you use, such as theme, chat history, and drafts. Optional analytics stays off unless you allow it. We do not use advertising or marketing cookies.
              </p>
              <Link href="/privacy" className="mt-2 inline-block text-sm text-cyan-700 underline underline-offset-4 dark:text-cyan-300">
                Read the Privacy Policy
              </Link>
              {hasGpc ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground" role="status">
                  Your browser&apos;s Global Privacy Control signal is active. Optional analytics will remain disabled.
                </p>
              ) : null}
            </div>
            {!showPreferences ? (
              <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                <button type="button" onClick={() => savePreferences(false)} className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
                  Reject optional
                </button>
                <button type="button" onClick={() => { setShowPreferences(true); setSaveError("") }} className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
                  Customize
                </button>
                <button type="button" onClick={() => savePreferences(true)} className="min-h-10 rounded-lg bg-cyan-300 px-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
                  {hasGpc ? "Continue without analytics" : "Allow analytics"}
                </button>
              </div>
            ) : null}
          </div>

          {showPreferences ? (
            <div className="mt-5 space-y-3 border-t border-border pt-4">
              <div className="flex items-start justify-between gap-4 rounded-xl bg-muted/50 p-3">
                <div>
                  <p className="text-sm font-semibold">Essential storage</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Session and sign-in-flow cookies support authentication and security. The consent cookie remembers your choice. Always active.</p>
                </div>
                <input type="checkbox" checked disabled aria-label="Essential storage is always active" className="mt-1 size-4 accent-cyan-600" />
              </div>
              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl bg-muted/50 p-3">
                <span>
                  <span className="block text-sm font-semibold">Analytics</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">Vercel Analytics measures visits and site performance. Optional and off by default.</span>
                </span>
                <input
                  type="checkbox"
                  checked={analytics}
                  disabled={hasGpc}
                  onChange={(event) => setAnalytics(event.target.checked)}
                  aria-label="Allow optional analytics"
                  className="mt-1 size-4 accent-cyan-600"
                />
              </label>
              <p className="rounded-xl bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                Functional browser storage saves your theme, sidebar setting, chat history, drafts, and temporary download tokens for the features you use. It is not used for analytics or advertising.
              </p>
              {hasGpc ? (
                <p className="text-xs leading-5 text-muted-foreground" role="status">
                  Your browser&apos;s Global Privacy Control signal is active. Optional analytics will remain disabled.
                </p>
              ) : null}
              <p className="rounded-xl bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                Marketing cookies and advertising pixels are not currently used on this site.
              </p>
              {saveError ? <p role="alert" className="text-sm text-destructive">{saveError}</p> : null}
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => savePreferences(false)} className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
                  Reject optional
                </button>
                <button type="button" onClick={() => savePreferences(analytics)} className="min-h-10 rounded-lg bg-cyan-300 px-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
                  Save preferences
                </button>
              </div>
            </div>
          ) : saveError ? (
            <p role="alert" className="mt-3 text-sm text-destructive">{saveError}</p>
          ) : null}
        </section>
      ) : null}
      {initialized && !isOpen ? (
        <button
          type="button"
          onClick={() => {
            setAnalytics(savedConsent?.analytics === true && !hasGpc)
            setShowPreferences(true)
            setIsOpen(true)
            setSaveError("")
          }}
          className="fixed bottom-3 right-3 z-[69] rounded-full border border-border bg-background/95 px-3 py-2 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:bottom-5 sm:right-5"
        >
          Cookie settings
        </button>
      ) : null}
    </>
  )
}
