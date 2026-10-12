"use client"

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react"
import gsap from "gsap"
import { isOwnerEmail } from "@/features/auth/server/owner-email"
import { SocialAuthButtons } from "@/features/auth/components/social-auth-buttons"

type AuthMode = "sign-in" | "create-account"

export function SignInPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>("sign-in")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [sessionWarning, setSessionWarning] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailInput, setEmailInput] = useState("")
  const [pendingEmail, setPendingEmail] = useState("")
  const [privilegedOtpRequested, setPrivilegedOtpRequested] = useState(false)
  const [staffCodeSignIn, setStaffCodeSignIn] = useState(false)
  const [referralCode, setReferralCode] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [verificationType, setVerificationType] = useState<"signup" | "email">("signup")
  const [resendSeconds, setResendSeconds] = useState(0)
  const [loginCodeResendSeconds, setLoginCodeResendSeconds] = useState(0)
  const [forgotPassword, setForgotPassword] = useState(false)
  const [resetToken, setResetToken] = useState("")
  const [resetComplete, setResetComplete] = useState(false)
  const [notice, setNotice] = useState("")
  const [checkingSession, setCheckingSession] = useState(true)
  const [socialError, setSocialError] = useState("")
  const socialFormRef = useRef<HTMLFormElement>(null)
  const authPanelRef = useRef<HTMLElement>(null)
  const authStageRef = useRef<HTMLDivElement>(null)
  const authStage = resetComplete
    ? "reset-complete"
    : resetToken
      ? "reset-password"
      : forgotPassword
        ? "forgot-password"
        : privilegedOtpRequested
          ? "privileged-otp"
        : pendingEmail
          ? "verify-email"
          : mode
  const showEmailCredentials = emailInput.trim().length > 0
  const ownerOtpSignIn = mode === "sign-in" && isOwnerEmail(emailInput)
  const emailOtpOnlySignIn = ownerOtpSignIn || (mode === "sign-in" && staffCodeSignIn)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams(window.location.search)
    const token = params.get("reset") ?? ""
    const code = params.get("ref")?.trim().toUpperCase() ?? ""
    const authError = params.get("authError")
    if (authError === "cancelled") setSocialError("Sign-in was cancelled. You can try again or use your email.")
    if (authError === "failed") setSocialError("Social sign-in failed. Please try again or use your email.")
    if (authError === "signup_required") {
      setMode("create-account")
      setSocialError("No account uses this provider yet. Add your date of birth and accept the Privacy Policy to create one.")
    }
    if (authError === "signup_ip_used") {
      setMode("create-account")
      setSocialError("An account has already been created from this network.")
    }
    if (authError === "otp_required") {
      setSocialError("Owner and staff accounts must sign in with an emailed verification code.")
    }
    if (code) setMode("create-account")
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
          router.replace("/")
          return
        }
        if (response.status !== 401) throw new Error("Could not verify your session right now.")
        setCheckingSession(false)
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return
        console.error("Could not check for an existing sign-in session.", caught)
        setSessionWarning("We could not check for an existing session. You can still sign in below.")
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

  useEffect(() => {
    if (loginCodeResendSeconds <= 0) return
    const timer = window.setInterval(() => {
      setLoginCodeResendSeconds((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [loginCodeResendSeconds])

  useLayoutEffect(() => {
    const panel = authPanelRef.current
    if (!panel || checkingSession || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const context = gsap.context(() => {
      gsap.fromTo(
        panel,
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.55, ease: "power2.out", clearProps: "all" },
      )
    }, panel)

    return () => context.revert()
  }, [checkingSession])

  useLayoutEffect(() => {
    const stage = authStageRef.current
    if (!stage || checkingSession || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const context = gsap.context(() => {
      gsap.fromTo(
        stage,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.32, ease: "power2.out", clearProps: "all" },
      )
    }, stage)

    return () => context.revert()
  }, [authStage, checkingSession])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSessionWarning("")
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
          email: String(formData.get("email") ?? ""),
          password,
          referralCode: referralCode || undefined,
          privacyAccepted: formData.get("privacyAccepted") === "on",
        }
      : {
          email: String(formData.get("email") ?? ""),
          password,
          rememberMe: formData.get("rememberMe") === "on",
        }

    try {
      const response = await fetch(`/api/auth/${mode === "sign-in" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = await response.json() as { error?: string; verificationRequired?: boolean; message?: string }
      if (!response.ok) throw new Error(result.error ?? "Authentication failed.")

      if (mode === "create-account" && result.verificationRequired) {
        setPendingEmail(String(body.email))
        setVerificationCode("")
        setVerificationType("signup")
        setResendSeconds(60)
        setNotice(result.message ?? "Check your inbox and spam or junk folder for the verification code.")
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
      const result = await response.json() as { error?: string; message?: string; retryAfterSeconds?: number; verificationType?: "signup" | "email" }
      if (typeof result.retryAfterSeconds === "number") setResendSeconds(result.retryAfterSeconds)
      if (!response.ok) throw new Error(result.error ?? "Could not resend the verification code.")
      if (result.verificationType) setVerificationType(result.verificationType)
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
          verificationType,
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

  async function handleRequestLoginOtp(type: "owner" | "staff") {
    if (isSubmitting) return
    setError("")
    setNotice("")
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/auth/login-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput }),
      })
      const result = await response.json() as { error?: string; message?: string; retryAfterSeconds?: number }
      if (typeof result.retryAfterSeconds === "number") setLoginCodeResendSeconds(result.retryAfterSeconds)
      if (!response.ok) throw new Error(result.error ?? "Could not send the sign-in code.")
      if (typeof result.retryAfterSeconds !== "number") {
        throw new Error("The sign-in code response did not include its resend delay.")
      }
      setPrivilegedOtpRequested(true)
      setLoginCodeResendSeconds(result.retryAfterSeconds)
      setVerificationCode("")
      setNotice(result.message ?? `Check your inbox and spam folder for the ${type} sign-in code.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the sign-in code.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVerifyLoginOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (!/^\d{6}$/.test(verificationCode)) {
      setError("Enter the complete six-digit sign-in code.")
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/auth/login-code/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput, otp: verificationCode }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? "Could not verify the sign-in code.")
      finishSignIn()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not verify the sign-in code.")
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
    router.replace("/")
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-20 text-foreground sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.10),transparent_45%),linear-gradient(135deg,transparent_45%,rgba(217,70,239,0.04))]" />
      {checkingSession ? (
        <p className="relative text-sm text-muted-foreground" role="status">Checking your sign-in...</p>
      ) : (
      <section ref={authPanelRef} className="relative w-full max-w-lg rounded-[28px] border border-border bg-card/95 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-7 lg:p-8" aria-labelledby="sign-in-title">
        <Link href="/" className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-cyan-700 dark:hover:text-cyan-200">
          <ArrowLeft aria-hidden="true" size={16} /> Home
        </Link>

        <div className="mb-7 flex items-center gap-3">
          <span className="size-11 overflow-hidden rounded-xl border border-cyan-200/20 bg-muted/40">
            <img src="/images/luciferai-brand-logo.jpg" alt="" className="size-full object-cover" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">LUCIFER AI</p>
            <h1 id="sign-in-title" className="mt-1 text-[clamp(1.5rem,3vw,2rem)] font-black tracking-[-0.06em] text-foreground">{resetToken ? "Choose a new password" : forgotPassword ? "Reset your password" : privilegedOtpRequested ? (ownerOtpSignIn ? "Owner sign-in" : "Staff sign-in") : pendingEmail ? "Verify your email" : mode === "sign-in" ? "Welcome back" : "Create your account"}</h1>
          </div>
        </div>

        {sessionWarning ? (
          <p role="status" className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-3 text-sm leading-5 text-amber-800 dark:text-amber-100">
            {sessionWarning}
          </p>
        ) : null}

        {!pendingEmail && !privilegedOtpRequested && !forgotPassword && !resetToken && !resetComplete ? (
          <div className="mb-6 grid grid-cols-2 rounded-xl border border-border bg-muted/40 p-1" role="tablist" aria-label="Authentication mode">
            {(["sign-in", "create-account"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={mode === option}
                onClick={() => {
                  setMode(option)
                  setStaffCodeSignIn(false)
                  setPrivilegedOtpRequested(false)
                  setVerificationCode("")
                  setError("")
                }}
                className={`rounded-lg px-3 py-2.5 text-sm font-semibold tracking-[-0.02em] transition ${mode === option ? "bg-muted text-foreground shadow-inner shadow-black/5 dark:bg-white/10 dark:shadow-black/20" : "text-muted-foreground hover:text-foreground"}`}
              >
                {option === "sign-in" ? "Login" : "Create account"}
              </button>
            ))}
          </div>
        ) : null}

        <div ref={authStageRef}>
        {resetComplete ? (
          <div className="space-y-4">
            <p role="status" className="text-sm leading-6 text-emerald-700 dark:text-emerald-300">Your password has been reset. You can now sign in with your new password.</p>
            <button type="button" onClick={() => { setResetComplete(false); setMode("sign-in"); }} className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">Back to sign in</button>
          </div>
        ) : resetToken ? (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <>
                <label className="block space-y-2 text-sm font-medium text-foreground/80">
                  New password
                  <span className="flex h-12 items-center gap-3 rounded-xl border border-border bg-muted/50 px-3.5 dark:bg-black/25 focus-within:border-cyan-500/60 dark:focus-within:border-cyan-300/60">
                    <LockKeyhole aria-hidden="true" size={17} className="shrink-0 text-muted-foreground/60" />
                    <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none" />
                  </span>
                </label>
                <label className="block space-y-2 text-sm font-medium text-foreground/80">
                  Confirm new password
                  <span className="flex h-12 items-center gap-3 rounded-xl border border-border bg-muted/50 px-3.5 dark:bg-black/25 focus-within:border-cyan-500/60 dark:focus-within:border-cyan-300/60">
                    <LockKeyhole aria-hidden="true" size={17} className="shrink-0 text-muted-foreground/60" />
                    <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none" />
                  </span>
                </label>
                {error ? <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
                <button type="submit" disabled={isSubmitting} className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60">{isSubmitting ? "Updating..." : "Update password"}</button>
            </>
          </form>
        ) : forgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">Enter your account email. If it matches an account, we’ll send a secure reset link.</p>
            <label className="block space-y-2 text-sm font-medium text-foreground/80">
              Email address
              <span className="flex h-12 items-center gap-3 rounded-xl border border-border bg-muted/50 px-3.5 dark:bg-black/25 focus-within:border-cyan-500/60 dark:focus-within:border-cyan-300/60">
                <Mail aria-hidden="true" size={17} className="shrink-0 text-muted-foreground/60" />
                <input name="email" type="email" autoComplete="email" value={emailInput} onChange={(event) => setEmailInput(event.target.value)} required className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none" />
              </span>
            </label>
            {notice ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}
            {error ? <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
            <button type="submit" disabled={isSubmitting} className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60">{isSubmitting ? "Sending..." : "Send reset link"}</button>
            <button type="button" onClick={() => { setForgotPassword(false); setError(""); setNotice(""); }} className="w-full py-2 text-sm text-muted-foreground transition hover:text-foreground">Back to sign in</button>
          </form>
        ) : pendingEmail ? (
          <form onSubmit={handleVerifyEmail} className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">We requested a six-digit code for <span className="font-semibold text-foreground">{pendingEmail}</span>. Check your inbox and spam folder. The code expires in 10 minutes.</p>
            <label className="block space-y-2 text-sm font-medium text-foreground/80">
              Verification code
              <span className="flex h-12 items-center gap-3 rounded-xl border border-border bg-muted/50 px-3.5 dark:bg-black/25 focus-within:border-cyan-500/60 dark:focus-within:border-cyan-300/60">
                <Mail aria-hidden="true" size={17} className="shrink-0 text-muted-foreground/60" />
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
                  className="h-full min-w-0 flex-1 bg-transparent text-center font-mono text-lg font-semibold tracking-[0.45em] text-foreground outline-none placeholder:text-muted-foreground/50"
                />
              </span>
              <span id="verification-code-help" className="block text-xs text-muted-foreground/70">Enter the six digits from the email. Numbers only.</span>
            </label>
            {error ? (
              <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">
                {error}
                {error.toLowerCase().includes("expired") && resendSeconds > 0
                  ? ` You can resend a new code in ${String(Math.floor(resendSeconds / 60)).padStart(2, "0")}:${String(resendSeconds % 60).padStart(2, "0")}.`
                  : ""}
              </p>
            ) : null}
            <button type="submit" disabled={isSubmitting} className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60">
              {isSubmitting ? "Verifying..." : "Verify email"}
            </button>
            {notice ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}
            <button
              type="button"
              onClick={() => void handleResendCode()}
              disabled={isSubmitting || resendSeconds > 0}
              className="w-full py-2 text-sm text-cyan-700 dark:text-cyan-200 transition hover:text-cyan-600 dark:hover:text-cyan-100 disabled:cursor-not-allowed disabled:text-muted-foreground/60"
            >
              {resendSeconds > 0
                ? `Resend code in ${String(Math.floor(resendSeconds / 60)).padStart(2, "0")}:${String(resendSeconds % 60).padStart(2, "0")}`
                : "Resend verification code"}
            </button>
            <button type="button" onClick={() => { setPendingEmail(""); setVerificationCode(""); setError(""); }} className="w-full py-2 text-sm text-muted-foreground transition hover:text-foreground">
              Back to account form
            </button>
          </form>
        ) : privilegedOtpRequested ? (
          <form onSubmit={handleVerifyLoginOtp} className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Enter the six-digit {ownerOtpSignIn ? "owner" : "staff"} sign-in code for <span className="font-semibold text-foreground">{emailInput}</span>. Check your inbox and spam or junk folder. It expires in 5 minutes; requesting a new code invalidates the previous one.
            </p>
            <label className="block space-y-2 text-sm font-medium text-foreground/80">
              Sign-in code
              <span className="flex h-12 items-center gap-3 rounded-xl border border-border bg-muted/50 px-3.5 dark:bg-black/25 focus-within:border-cyan-500/60 dark:focus-within:border-cyan-300/60">
                <Mail aria-hidden="true" size={17} className="shrink-0 text-muted-foreground/60" />
                <input
                  name="loginOtp"
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
                  aria-label={`Six-digit ${ownerOtpSignIn ? "owner" : "staff"} sign-in code`}
                  autoFocus
                  required
                  className="h-full min-w-0 flex-1 bg-transparent text-center font-mono text-lg font-semibold tracking-[0.45em] text-foreground outline-none placeholder:text-muted-foreground/50"
                />
              </span>
            </label>
            {error ? <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
            {notice ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}
            <button type="submit" disabled={isSubmitting} className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60">
              {isSubmitting ? "Verifying..." : "Verify and sign in"}
            </button>
            <button
              type="button"
              onClick={() => void handleRequestLoginOtp(ownerOtpSignIn ? "owner" : "staff")}
              disabled={isSubmitting || loginCodeResendSeconds > 0}
              className="w-full py-2 text-sm text-cyan-700 dark:text-cyan-200 transition hover:text-cyan-600 dark:hover:text-cyan-100 disabled:cursor-not-allowed disabled:text-muted-foreground/60"
            >
              {loginCodeResendSeconds > 0
                ? `Resend sign-in code in ${String(Math.floor(loginCodeResendSeconds / 60)).padStart(2, "0")}:${String(loginCodeResendSeconds % 60).padStart(2, "0")}`
                : "Resend sign-in code"}
            </button>
            <button type="button" onClick={() => { setPrivilegedOtpRequested(false); setStaffCodeSignIn(false); setVerificationCode(""); setError(""); setNotice(""); }} className="w-full py-2 text-sm text-muted-foreground transition hover:text-foreground">
              Back to sign in
            </button>
          </form>
        ) : <form
          ref={socialFormRef}
          onSubmit={(event) => {
            if (emailOtpOnlySignIn) {
              event.preventDefault()
              void handleRequestLoginOtp("owner")
              return
            }
            void handleSubmit(event)
          }}
          className="space-y-4"
        >
          <label className="block space-y-2 text-sm font-medium text-foreground/80">
            Email address
            <span className="flex h-12 items-center gap-3 rounded-xl border border-border bg-muted/50 px-3.5 dark:bg-black/25 focus-within:border-cyan-500/60 dark:focus-within:border-cyan-300/60">
              <Mail aria-hidden="true" size={17} className="shrink-0 text-muted-foreground/60" />
              <input name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" value={emailInput} onChange={(event) => { setEmailInput(event.target.value); setPrivilegedOtpRequested(false); setStaffCodeSignIn(false); setVerificationCode(""); setError(""); setNotice(""); }} required className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60" />
            </span>
          </label>
          {!showEmailCredentials ? (
            <p className="text-sm text-muted-foreground" role="status">Enter your email address to continue with email.</p>
          ) : null}
          {!showEmailCredentials && socialError ? <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{socialError}</p> : null}

          {mode === "create-account" && (
            showEmailCredentials ? (
            <>
              <label className="block space-y-2 text-sm font-medium text-foreground/80">
                Full name
                <span className="flex h-12 items-center gap-3 rounded-xl border border-border bg-muted/50 px-3.5 dark:bg-black/25 focus-within:border-cyan-500/60 dark:focus-within:border-cyan-300/60">
                  <UserRound aria-hidden="true" size={17} className="shrink-0 text-muted-foreground/60" />
                  <input name="name" type="text" autoComplete="name" maxLength={100} placeholder="Your name" required className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60" />
                </span>
              </label>
              <label className="block space-y-2 text-sm font-medium text-foreground/80">
                Referral code <span className="text-muted-foreground">(optional)</span>
                <span className="flex h-12 items-center rounded-xl border border-border bg-muted/50 px-3.5 dark:bg-black/25 focus-within:border-cyan-500/60 dark:focus-within:border-cyan-300/60">
                  <input
                    name="referralCode"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    maxLength={32}
                    placeholder="Enter a referral code if you have one"
                    value={referralCode}
                    onChange={(event) => setReferralCode(event.target.value)}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                  />
                </span>
              </label>
            </>
            ) : null
          )}

          {showEmailCredentials && !emailOtpOnlySignIn ? (
            <label className="block space-y-2 text-sm font-medium text-foreground/80">
              Password
              <span className="flex h-12 items-center gap-3 rounded-xl border border-border bg-muted/50 px-3.5 dark:bg-black/25 focus-within:border-cyan-500/60 dark:focus-within:border-cyan-300/60">
                <LockKeyhole aria-hidden="true" size={17} className="shrink-0 text-muted-foreground/60" />
                <input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={mode === "create-account" ? 8 : undefined} maxLength={128} placeholder={mode === "create-account" ? "At least 8 characters" : "Enter your password"} required className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60" />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground dark:hover:bg-white/5">
                  {showPassword ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
                </button>
              </span>
            </label>
          ) : null}

          {mode === "create-account" && showEmailCredentials ? (
            <label className="block space-y-2 text-sm font-medium text-foreground/80">
              Confirm password
              <span className="flex h-12 items-center gap-3 rounded-xl border border-border bg-muted/50 px-3.5 dark:bg-black/25 focus-within:border-cyan-500/60 dark:focus-within:border-cyan-300/60">
                <LockKeyhole aria-hidden="true" size={17} className="shrink-0 text-muted-foreground/60" />
                <input name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} placeholder="Re-enter password" required className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60" />
              </span>
            </label>
          ) : null}

          {mode === "create-account" && showEmailCredentials ? (
            <label className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
              <input
                name="privacyAccepted"
                type="checkbox"
                required
                className="mt-1 size-4 shrink-0 accent-cyan-500 dark:accent-cyan-300"
              />
              <span>
                I have read and accept the{" "}
                <Link href="/privacy" target="_blank" className="text-cyan-700 underline underline-offset-4 hover:text-cyan-600 dark:text-cyan-200 dark:hover:text-cyan-100">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          ) : null}

          {mode === "sign-in" && showEmailCredentials && !emailOtpOnlySignIn ? (
            <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <input
                name="rememberMe"
                type="checkbox"
                className="size-4 shrink-0 accent-cyan-500 dark:accent-cyan-300"
              />
              <span>Remember me</span>
            </label>
          ) : null}

          {mode === "create-account" && error ? <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
          {mode === "create-account" && showEmailCredentials ? (
            <button type="submit" disabled={isSubmitting} className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-60">
              {isSubmitting ? "Please wait..." : "Create account"}
            </button>
          ) : null}
          {mode === "sign-in" && error ? <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
          {emailOtpOnlySignIn ? (
            <div className="space-y-3">
              <p className="text-sm leading-6 text-cyan-700/80 dark:text-cyan-100/75">{ownerOtpSignIn ? "Owner" : "Staff"} sign-in uses an emailed one-time code. Password and social sign-in are disabled for this account.</p>
              <button type="button" onClick={() => void handleRequestLoginOtp(ownerOtpSignIn ? "owner" : "staff")} disabled={isSubmitting || loginCodeResendSeconds > 0} className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-60">
                {isSubmitting
                  ? "Sending code..."
                  : loginCodeResendSeconds > 0
                    ? `Resend sign-in code in ${String(Math.floor(loginCodeResendSeconds / 60)).padStart(2, "0")}:${String(loginCodeResendSeconds % 60).padStart(2, "0")}`
                    : `Send ${ownerOtpSignIn ? "owner" : "staff"} sign-in code`}
              </button>
            </div>
          ) : null}
          {mode === "sign-in" && showEmailCredentials && !emailOtpOnlySignIn ? (
            <button type="submit" disabled={isSubmitting} className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-60">
              {isSubmitting ? "Please wait..." : "Sign in"}
            </button>
          ) : null}

          {mode === "sign-in" && showEmailCredentials && !ownerOtpSignIn && !staffCodeSignIn ? (
            <button
              type="button"
              onClick={() => {
                setStaffCodeSignIn(true)
                void handleRequestLoginOtp("staff")
              }}
              disabled={isSubmitting || loginCodeResendSeconds > 0}
              className="w-full py-2 text-sm text-cyan-700 dark:text-cyan-200 transition hover:text-cyan-600 dark:hover:text-cyan-100 disabled:cursor-wait disabled:opacity-60"
            >
              Sign in as staff with an email code
            </button>
          ) : null}

          {!showEmailCredentials ? (
            <SocialAuthButtons
              nextPath="/"
              initialError={socialError}
              mode={mode}
              formRef={socialFormRef}
              referralCode={referralCode}
            />
          ) : null}

          {mode === "sign-in" && showEmailCredentials && !emailOtpOnlySignIn ? (
            <button type="button" onClick={() => { setForgotPassword(true); setError(""); }} className="text-sm text-cyan-700/80 transition hover:text-cyan-600 dark:text-cyan-200/75 dark:hover:text-cyan-100">
              Forgot password?
            </button>
          ) : null}

        </form>}
        </div>

      </section>
      )}
    </main>
  )
}
