"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarDays, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react"
import { getLatestEligibleBirthDate } from "@/lib/age"

type AuthMode = "sign-in" | "create-account"

export default function SignInPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>("sign-in")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailInput, setEmailInput] = useState("")
  const [pendingEmail, setPendingEmail] = useState("")
  const [referralCode, setReferralCode] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [resendSeconds, setResendSeconds] = useState(0)
  const [forgotPassword, setForgotPassword] = useState(false)
  const [resetToken, setResetToken] = useState("")
  const [resetComplete, setResetComplete] = useState(false)
  const [notice, setNotice] = useState("")
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams(window.location.search)
    const token = params.get("reset") ?? ""
    const code = params.get("ref")?.trim().toUpperCase() ?? ""
    setReferralCode(code)
    if (code || params.get("mode") === "create-account") setMode("create-account")
    setResetToken(token)

    if (token) {
      setCheckingSession(false)
      return () => controller.abort()
    }

    fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (response.ok) {
          const requestedPath = params.get("next")
          const destination = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
            ? requestedPath
            : "/chat"
          router.replace(destination)
          router.refresh()
          return
        }
        if (response.status !== 401) throw new Error("Could not verify your session right now.")
        setCheckingSession(false)
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return
        setError(caught instanceof Error ? caught.message : "Could not verify your session right now.")
        setCheckingSession(false)
      })
    return () => controller.abort()
  }, [router])

  useEffect(() => {
    if (!pendingEmail || resendSeconds <= 0) return
    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [pendingEmail, resendSeconds])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const password = String(formData.get("password") ?? "")
    const confirmPassword = String(formData.get("confirmPassword") ?? "")

    if (mode === "create-account" && password !== confirmPassword) {
      setError("Those passwords do not match.")
      setIsSubmitting(false)
      return
    }

    const body = mode === "create-account"
      ? {
          name: String(formData.get("name") ?? ""),
          dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
          email: String(formData.get("email") ?? ""),
          password,
          referralCode: referralCode || undefined,
          privacyAccepted: formData.get("privacyAccepted") === "on",
        }
      : {
          email: String(formData.get("email") ?? ""),
          password,
        }

    try {
      const response = await fetch(`/api/auth/${mode === "sign-in" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = await response.json() as { error?: string; verificationRequired?: boolean }
      if (!response.ok) throw new Error(result.error ?? "Authentication failed.")

      if (mode === "create-account" && result.verificationRequired) {
        setPendingEmail(String(body.email))
        setVerificationCode("")
        setResendSeconds(120)
        return
      }

      finishSignIn()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not authenticate right now.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResendCode() {
    if (!pendingEmail || resendSeconds > 0 || isSubmitting) return
    setError("")
    setNotice("")
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      })
      const result = await response.json() as { error?: string; message?: string; retryAfterSeconds?: number }
      if (typeof result.retryAfterSeconds === "number") setResendSeconds(result.retryAfterSeconds)
      if (!response.ok) throw new Error(result.error ?? "Could not resend the verification code.")
      setVerificationCode("")
      setNotice(result.message ?? "A new verification code has been sent.")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resend the verification code.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVerifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (!/^\d{6}$/.test(verificationCode)) {
      setError("Enter the complete six-digit verification code.")
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: pendingEmail,
          otp: verificationCode,
        }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? "Could not verify your email.")
      finishSignIn()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not verify your email.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setNotice("")
    setIsSubmitting(true)
    const formData = new FormData(event.currentTarget)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(formData.get("email") ?? "") }),
      })
      const result = await response.json() as { error?: string; message?: string }
      if (!response.ok) throw new Error(result.error ?? "Could not request a password reset.")
      setNotice(result.message ?? "If an account exists, reset instructions have been sent.")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request a password reset.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const formData = new FormData(event.currentTarget)
    const password = String(formData.get("password") ?? "")
    if (password !== String(formData.get("confirmPassword") ?? "")) {
      setError("Those passwords do not match.")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? "Could not reset your password.")
      setResetComplete(true)
      setResetToken("")
      window.history.replaceState(null, "", "/sign-in")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reset your password.")
    } finally {
      setIsSubmitting(false)
    }
  }

  function finishSignIn() {
      const requestedPath = new URLSearchParams(window.location.search).get("next")
      const destination = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/chat"
      router.replace(destination)
      router.refresh()
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08080b] px-4 py-28 text-white sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.10),transparent_45%),linear-gradient(135deg,transparent_45%,rgba(217,70,239,0.04))]" />
      {checkingSession ? (
        <p className="relative text-sm text-white/65" role="status">Checking your sign-in...</p>
      ) : (
      <section className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#101014]/95 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8" aria-labelledby="sign-in-title">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-cyan-200">
          <ArrowLeft aria-hidden="true" size={16} /> Home
        </Link>

        <div className="mb-7 flex items-center gap-3">
          <span className="size-11 overflow-hidden rounded-xl border border-cyan-200/20 bg-white/5">
            <img src="/images/luciferai-brand-logo.jpg" alt="" className="size-full object-cover" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">LUCIFER AI</p>
            <h1 id="sign-in-title" className="mt-1 text-xl font-bold">{resetToken ? "Choose a new password" : forgotPassword ? "Reset your password" : pendingEmail ? "Verify your email" : mode === "sign-in" ? "Welcome back" : "Create your account"}</h1>
          </div>
        </div>

        {!pendingEmail && !forgotPassword && !resetToken && !resetComplete ? (
          <div className="mb-6 grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1" role="tablist" aria-label="Authentication mode">
            {(["sign-in", "create-account"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={mode === option}
                onClick={() => { setMode(option); setError(""); }}
                className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${mode === option ? "bg-white/10 text-white" : "text-white/45 hover:text-white/75"}`}
              >
                {option === "sign-in" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
        ) : null}

        {resetComplete ? (
          <div className="space-y-4">
            <p role="status" className="text-sm leading-6 text-emerald-300">Your password has been reset. You can now sign in with your new password.</p>
            <button type="button" onClick={() => { setResetComplete(false); setMode("sign-in"); }} className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-bold text-[#071014] transition hover:bg-cyan-200">Back to sign in</button>
          </div>
        ) : resetToken ? (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <>
                <label className="block space-y-2 text-sm font-medium text-white/75">
                  New password
                  <span className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3.5 focus-within:border-cyan-300/60">
                    <LockKeyhole aria-hidden="true" size={17} className="shrink-0 text-white/35" />
                    <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none" />
                  </span>
                </label>
                <label className="block space-y-2 text-sm font-medium text-white/75">
                  Confirm new password
                  <span className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3.5 focus-within:border-cyan-300/60">
                    <LockKeyhole aria-hidden="true" size={17} className="shrink-0 text-white/35" />
                    <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none" />
                  </span>
                </label>
                {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
                <button type="submit" disabled={isSubmitting} className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-bold text-[#071014] transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60">{isSubmitting ? "Updating..." : "Update password"}</button>
            </>
          </form>
        ) : forgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-sm leading-6 text-white/65">Enter your account email. If it matches an account, we’ll send a secure reset link.</p>
            <label className="block space-y-2 text-sm font-medium text-white/75">
              Email address
              <span className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3.5 focus-within:border-cyan-300/60">
                <Mail aria-hidden="true" size={17} className="shrink-0 text-white/35" />
                <input name="email" type="email" autoComplete="email" value={emailInput} onChange={(event) => setEmailInput(event.target.value)} required className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none" />
              </span>
            </label>
            {notice ? <p role="status" className="text-sm text-emerald-300">{notice}</p> : null}
            {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
            <button type="submit" disabled={isSubmitting} className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-bold text-[#071014] transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60">{isSubmitting ? "Sending..." : "Send reset link"}</button>
            <button type="button" onClick={() => { setForgotPassword(false); setError(""); setNotice(""); }} className="w-full py-2 text-sm text-white/50 transition hover:text-white">Back to sign in</button>
          </form>
        ) : pendingEmail ? (
          <form onSubmit={handleVerifyEmail} className="space-y-4">
            <p className="text-sm leading-6 text-white/65">Enter the six-digit code sent to <span className="font-semibold text-white">{pendingEmail}</span>. It expires in 5 minutes.</p>
            <label className="block space-y-2 text-sm font-medium text-white/75">
              Verification code
              <span className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3.5 focus-within:border-cyan-300/60">
                <Mail aria-hidden="true" size={17} className="shrink-0 text-white/35" />
                <input
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(event) => {
                    setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    setError("")
                  }}
                  aria-label="Six-digit verification code"
                  aria-describedby="verification-code-help"
                  autoFocus
                  required
                  className="h-full min-w-0 flex-1 bg-transparent text-center font-mono text-lg font-semibold tracking-[0.45em] text-white outline-none placeholder:text-white/30"
                />
              </span>
              <span id="verification-code-help" className="block text-xs text-white/45">Enter the six digits from the email. Numbers only.</span>
            </label>
            {error ? (
              <p role="alert" className="text-sm text-rose-300">
                {error}
                {error.toLowerCase().includes("expired") && resendSeconds > 0
                  ? ` You can resend a new code in ${String(Math.floor(resendSeconds / 60)).padStart(2, "0")}:${String(resendSeconds % 60).padStart(2, "0")}.`
                  : ""}
              </p>
            ) : null}
            <button type="submit" disabled={isSubmitting} className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-bold text-[#071014] transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60">
              {isSubmitting ? "Verifying..." : "Verify email"}
            </button>
            {notice ? <p role="status" className="text-sm text-emerald-300">{notice}</p> : null}
            <button
              type="button"
              onClick={() => void handleResendCode()}
              disabled={isSubmitting || resendSeconds > 0}
              className="w-full py-2 text-sm text-cyan-200 transition hover:text-cyan-100 disabled:cursor-not-allowed disabled:text-white/35"
            >
              {resendSeconds > 0
                ? `Resend code in ${String(Math.floor(resendSeconds / 60)).padStart(2, "0")}:${String(resendSeconds % 60).padStart(2, "0")}`
                : "Resend verification code"}
            </button>
            <button type="button" onClick={() => { setPendingEmail(""); setVerificationCode(""); setError(""); }} className="w-full py-2 text-sm text-white/50 transition hover:text-white">
              Back to account form
            </button>
          </form>
        ) : <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "create-account" && (
            <>
              <label className="block space-y-2 text-sm font-medium text-white/75">
                Full name
                <span className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3.5 focus-within:border-cyan-300/60">
                  <UserRound aria-hidden="true" size={17} className="shrink-0 text-white/35" />
                  <input name="name" type="text" autoComplete="name" placeholder="Your name" required className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30" />
                </span>
              </label>
              <label className="block space-y-2 text-sm font-medium text-white/75">
                Date of birth
                <span className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3.5 focus-within:border-cyan-300/60">
                  <CalendarDays aria-hidden="true" size={17} className="shrink-0 text-white/35" />
                  <input name="dateOfBirth" type="date" autoComplete="bday" max={getLatestEligibleBirthDate()} required className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none [color-scheme:dark]" />
                </span>
                <span className="block text-xs text-white/45">You must be at least 15 years old.</span>
              </label>
            </>
          )}
          <label className="block space-y-2 text-sm font-medium text-white/75">
            Email address
            <span className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3.5 focus-within:border-cyan-300/60">
              <Mail aria-hidden="true" size={17} className="shrink-0 text-white/35" />
              <input name="email" type="email" autoComplete="email" placeholder="you@example.com" value={emailInput} onChange={(event) => setEmailInput(event.target.value)} required className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30" />
            </span>
          </label>

          <label className="block space-y-2 text-sm font-medium text-white/75">
            Password
            <span className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3.5 focus-within:border-cyan-300/60">
              <LockKeyhole aria-hidden="true" size={17} className="shrink-0 text-white/35" />
              <input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} placeholder="At least 8 characters" required className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30" />
              <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} className="grid size-8 shrink-0 place-items-center rounded-lg text-white/45 transition hover:bg-white/5 hover:text-white">
                {showPassword ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
              </button>
            </span>
          </label>

          {mode === "create-account" && (
            <label className="block space-y-2 text-sm font-medium text-white/75">
              Confirm password
              <span className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3.5 focus-within:border-cyan-300/60">
                <LockKeyhole aria-hidden="true" size={17} className="shrink-0 text-white/35" />
                <input name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} placeholder="Re-enter password" required className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30" />
              </span>
            </label>
          )}

          {mode === "create-account" && (
            <label className="flex items-start gap-3 text-sm leading-6 text-white/70">
              <input
                name="privacyAccepted"
                type="checkbox"
                required
                className="mt-1 size-4 shrink-0 accent-cyan-300"
              />
              <span>
                I have read and accept the{" "}
                <Link href="/privacy" target="_blank" className="text-cyan-200 underline underline-offset-4 hover:text-cyan-100">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          )}

          {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
          {mode === "sign-in" ? (
            <button type="button" onClick={() => { setForgotPassword(true); setError(""); }} className="text-sm text-cyan-200/75 transition hover:text-cyan-100">
              Forgot password?
            </button>
          ) : null}

          <button type="submit" disabled={isSubmitting} className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-bold text-[#071014] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101014] disabled:cursor-wait disabled:opacity-60">
            {isSubmitting ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>}

      </section>
      )}
    </main>
  )
}
