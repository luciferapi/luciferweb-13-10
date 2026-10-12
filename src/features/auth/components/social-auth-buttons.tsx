"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import { useRouter } from "next/navigation"
import { getLatestEligibleBirthDate } from "@/features/auth/server/age"

type ProviderAvailability = {
  google: boolean
  twitter: boolean
  telegram: boolean
  telegramBotUsername: string | null
}

type TelegramWidgetUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  auth_date: number
  hash: string
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetUser) => void
  }
}

export function SocialAuthButtons({
  nextPath,
  initialError,
  mode,
  formRef,
  referralCode,
}: {
  nextPath: string
  initialError?: string
  mode: "sign-in" | "create-account"
  formRef: RefObject<HTMLFormElement | null>
  referralCode: string
}) {
  const router = useRouter()
  const telegramMount = useRef<HTMLDivElement>(null)
  const [providers, setProviders] = useState<ProviderAvailability | null>(null)
  const [error, setError] = useState(initialError ?? "")
  const [telegramState, setTelegramState] = useState("")
  const [telegramLoading, setTelegramLoading] = useState(false)

  useEffect(() => {
    if (initialError) setError(initialError)
  }, [initialError])

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/auth/providers", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load social sign-in options.")
        const result: unknown = await response.json()
        if (
          typeof result !== "object" ||
          result === null ||
          !("google" in result) ||
          !("twitter" in result) ||
          !("telegram" in result) ||
          !("telegramBotUsername" in result) ||
          typeof result.google !== "boolean" ||
          typeof result.twitter !== "boolean" ||
          typeof result.telegram !== "boolean" ||
          (typeof result.telegramBotUsername !== "string" && result.telegramBotUsername !== null)
        ) {
          throw new Error("The social sign-in options were invalid.")
        }
        setProviders({
          google: result.google,
          twitter: result.twitter,
          telegram: result.telegram,
          telegramBotUsername: result.telegramBotUsername,
        })
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return
        setError(caught instanceof Error ? caught.message : "Could not load social sign-in options.")
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!telegramState || !providers?.telegram || !providers.telegramBotUsername || !telegramMount.current) return
    const mount = telegramMount.current
    let script: HTMLScriptElement | null = null

    window.onTelegramAuth = async (telegramUser) => {
      setError("")
      try {
        const response = await fetch("/api/auth/telegram/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...telegramUser, state: telegramState }),
        })
        const result = await response.json() as { error?: string }
        if (!response.ok) throw new Error(result.error ?? "Could not sign in with Telegram.")
        router.replace(nextPath)
        router.refresh()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not sign in with Telegram.")
      }
    }

    script = document.createElement("script")
    script.async = true
    script.src = "https://telegram.org/js/telegram-widget.js?22"
    script.dataset.telegramLogin = providers.telegramBotUsername
    script.dataset.size = "large"
    script.dataset.userpic = "false"
    script.dataset.radius = "8"
    script.dataset.onauth = "onTelegramAuth(user)"
    mount.append(script)
    return () => {
      delete window.onTelegramAuth
      script?.remove()
      mount.replaceChildren()
    }
  }, [nextPath, providers?.telegram, providers?.telegramBotUsername, router, telegramState])

  function getSignupDetails() {
    const form = formRef.current
    if (!form) {
      setError("Could not read the signup details. Please try again.")
      return null
    }
    const values = new FormData(form)
    const dateOfBirth = String(values.get("dateOfBirth") ?? "")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || dateOfBirth > getLatestEligibleBirthDate()) {
      setError("Enter a valid date of birth. You must be at least 15 years old.")
      return null
    }
    if (values.get("privacyAccepted") !== "on") {
      setError("Accept the Privacy Policy before creating an account.")
      return null
    }
    return { dateOfBirth, privacyAccepted: true as const }
  }

  function startOAuth(provider: "google" | "twitter") {
    setError("")
    const query = new URLSearchParams({ next: nextPath })
    if (mode === "create-account") {
      const signup = getSignupDetails()
      if (!signup) return
      query.set("intent", "create-account")
      query.set("dateOfBirth", signup.dateOfBirth)
      query.set("privacyAccepted", "true")
      if (referralCode) query.set("ref", referralCode)
    }
    window.location.assign(`/api/auth/oauth/${provider}?${query.toString()}`)
  }

  async function startTelegram() {
    if (telegramLoading || telegramState) return
    setError("")
    const signup = mode === "create-account" ? getSignupDetails() : null
    if (mode === "create-account" && !signup) return

    setTelegramLoading(true)
    try {
      const payload: Record<string, string | boolean> = signup
        ? { intent: "create-account", ...signup }
        : { intent: "sign-in" }
      if (signup && referralCode) payload.referralCode = referralCode
      const response = await fetch("/api/auth/telegram/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json() as { state?: string; error?: string }
      if (!response.ok || !result.state) throw new Error(result.error ?? "Could not prepare Telegram sign-in.")
      setTelegramState(result.state)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not prepare Telegram sign-in.")
    } finally {
      setTelegramLoading(false)
    }
  }

  if (!providers && !error) {
    return <p className="text-center text-xs text-muted-foreground" role="status">Loading sign-in options...</p>
  }

  const hasProvider = Boolean(providers?.google || providers?.twitter || providers?.telegram)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground/70">
        <span className="h-px flex-1 bg-border" />
        <span>Or continue with</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => startOAuth("google")}
          disabled={!providers?.google}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-[#171717] transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white"
        >
          <span aria-hidden="true" className="font-bold text-[#4285f4]">G</span> Google
        </button>
        <button
          type="button"
          onClick={() => startOAuth("twitter")}
          disabled={!providers?.twitter}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-[#191919] px-3 text-sm font-semibold text-white transition hover:bg-[#252525] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden="true" className="font-semibold">𝕏</span> X / Twitter
        </button>
      </div>
      {!telegramState ? (
        <button
          type="button"
          onClick={() => void startTelegram()}
          disabled={!providers?.telegram || telegramLoading}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#229ed9]/60 bg-[#229ed9] px-4 text-sm font-semibold text-white transition hover:bg-[#178fc9] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {telegramLoading ? "Preparing Telegram..." : "Continue with Telegram"}
        </button>
      ) : (
        <div className="flex min-h-11 justify-center" ref={telegramMount} aria-label="Continue with Telegram" />
      )}
      {error ? <p role="alert" className="text-center text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
      {!hasProvider && !error ? (
        <p className="text-center text-xs leading-5 text-muted-foreground">
          Social sign-in is not configured yet. Add provider credentials to enable it.
        </p>
      ) : null}
    </div>
  )
}
