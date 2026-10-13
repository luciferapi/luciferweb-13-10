"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent } from "react"
import { Cookie } from "lucide-react"
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
  const [settingsPosition, setSettingsPosition] = useState({ left: 20, bottom: 20 })
  const dragState = useRef<{ pointerId: number; startX: number; startY: number; left: number; bottom: number } | null>(null)

  function handleSettingsPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: settingsPosition.left,
      bottom: settingsPosition.bottom,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleSettingsPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragState.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setSettingsPosition({
      left: Math.max(12, Math.min(window.innerWidth - 180, drag.left + (event.clientX - drag.startX))),
      bottom: Math.max(12, Math.min(window.innerHeight - 52, drag.bottom - (event.clientY - drag.startY))),
    })
  }

  function handleSettingsPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragState.current?.pointerId === event.pointerId) dragState.current = null
  }

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
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[70] mx-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-3xl overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-border/80 bg-card/95 p-5 text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:inset-x-6 sm:bottom-6 sm:w-auto sm:p-6"
          role="region"
          aria-label="Cookie and privacy preferences"
        >
          <div className="flex flex-col gap-5">
            <div className="max-w-2xl">
              <h2 id="cookie-consent-title" className="font-heading text-lg font-bold tracking-tight sm:text-xl">Your privacy choices</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Essential cookies support sign-in and security. First-party browser storage remembers choices or content for features you use, such as theme, chat history, and drafts. Optional analytics stays off unless you allow it. We do not use advertising or marketing cookies.
              </p>
              <Link href="/privacy" className="mt-3 inline-flex min-h-6 items-center text-sm font-semibold text-cyan-700 underline decoration-cyan-700/50 underline-offset-4 transition hover:text-cyan-600 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-cyan-300 dark:hover:text-cyan-200">
                Read the Privacy Policy
              </Link>
              {hasGpc ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground" role="status">
                  Your browser&apos;s Global Privacy Control signal is active. Optional analytics will remain disabled.
                </p>
              ) : null}
            </div>
            {!showPreferences ? (
              <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
                <button type="button" onClick={() => savePreferences(false)} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition hover:border-foreground/30 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 active:scale-[0.98]">
                  Reject optional
                </button>
                <button type="button" onClick={() => { setShowPreferences(true); setSaveError("") }} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition hover:border-foreground/30 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 active:scale-[0.98]">
                  Manage preferences
                </button>
                <button type="button" onClick={() => savePreferences(true)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 active:scale-[0.98]">
                  {hasGpc ? "Continue without analytics" : "Allow analytics"}
                </button>
              </div>
            ) : null}
          </div>

          {showPreferences ? (
            <div className="space-y-4 border-t border-border/70 pt-5">
              <h3 className="text-sm font-semibold text-foreground">Storage categories</h3>
              <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-4">
                <div>
                  <p className="text-sm font-semibold">Essential storage</p>
                  <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">Required for sign-in, security, and remembering your privacy choice.</p>
                </div>
                <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">Always active</span>
              </div>
              <label className={`flex items-start justify-between gap-4 ${hasGpc ? "cursor-not-allowed" : "cursor-pointer"}`}>
                <span>
                  <span className="block text-sm font-semibold">Analytics</span>
                  <span className="mt-1 block max-w-xl text-xs leading-5 text-muted-foreground">Helps us understand visits and improve site performance. Optional and off until you choose to enable it.</span>
                </span>
                <input
                  type="checkbox"
                  checked={analytics}
                  disabled={hasGpc}
                  onChange={(event) => setAnalytics(event.target.checked)}
                  aria-label="Allow optional analytics"
                  className="mt-1 size-5 shrink-0 accent-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
              </label>
              <p className="border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground">
                Functional browser storage saves your theme, sidebar setting, chat history, drafts, and temporary download tokens for the features you use. It is not used for analytics or advertising.
              </p>
              {hasGpc ? (
                <p className="text-xs leading-5 text-muted-foreground" role="status">
                  Your browser&apos;s Global Privacy Control signal is active. Optional analytics will remain disabled.
                </p>
              ) : null}
              <p className="text-xs leading-5 text-muted-foreground">
                Marketing cookies and advertising pixels are not currently used on this site.
              </p>
              {saveError ? <p role="alert" className="text-sm text-destructive">{saveError}</p> : null}
              <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => savePreferences(false)} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition hover:border-foreground/30 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 active:scale-[0.98]">
                  Reject optional
                </button>
                <button type="button" onClick={() => savePreferences(analytics)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 active:scale-[0.98]">
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
            if (dragState.current) return
            setAnalytics(savedConsent?.analytics === true && !hasGpc)
            setShowPreferences(true)
            setIsOpen(true)
            setSaveError("")
          }}
          onPointerDown={handleSettingsPointerDown}
          onPointerMove={handleSettingsPointerMove}
          onPointerUp={handleSettingsPointerUp}
          onPointerCancel={handleSettingsPointerUp}
          aria-label="Open cookie and privacy settings"
          title="Drag to move cookie settings"
          style={{ left: settingsPosition.left, bottom: settingsPosition.bottom, touchAction: "none" }}
          className="fixed z-[69] inline-flex min-h-11 cursor-grab items-center gap-2 rounded-full border border-border/80 bg-card/95 px-4 text-sm font-semibold text-foreground shadow-[0_8px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl transition hover:-translate-y-px hover:border-cyan-400/50 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:cursor-grabbing active:scale-[0.98]"
        >
          <Cookie aria-hidden="true" className="size-4 text-cyan-300" strokeWidth={1.8} />
          Cookie settings
        </button>
      ) : null}
    </>
  )
}
