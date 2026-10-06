"use client"

import Script from "next/script"
import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"
import { LoaderCircle, ShieldCheck, X } from "lucide-react"
import type { RazorpaySuccess } from "@/lib/razorpay-types"

type RequestOrder = {
  order_id: string
  amount: number
  currency: string
  request_ref: string
}

function parseRequestOrder(value: unknown): RequestOrder | null {
  if (typeof value !== "object" || value === null) return null
  if (
    !("order_id" in value) || typeof value.order_id !== "string" ||
    !("amount" in value) || typeof value.amount !== "number" ||
    !("currency" in value) || typeof value.currency !== "string" ||
    !("request_ref" in value) || typeof value.request_ref !== "string"
  ) return null

  return {
    order_id: value.order_id,
    amount: value.amount,
    currency: value.currency,
    request_ref: value.request_ref,
  }
}

export function ProjectRequestForm() {
  const draftKey = "project-request-draft"
  const [scriptReady, setScriptReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [needsSignIn, setNeedsSignIn] = useState(false)
  const [requestNumber, setRequestNumber] = useState<number | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [description, setDescription] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [whatsappNumber, setWhatsappNumber] = useState("")
  const [telegramId, setTelegramId] = useState("")
  const [preferredLanguage, setPreferredLanguage] = useState("")
  const [desiredDuration, setDesiredDuration] = useState("")
  const [feeAccepted, setFeeAccepted] = useState(false)
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID

  useEffect(() => {
    try {
      const savedDraft = sessionStorage.getItem(draftKey)
      if (savedDraft) {
        const draft: unknown = JSON.parse(savedDraft)
        if (
          typeof draft === "object" &&
          draft !== null &&
          "projectName" in draft && typeof draft.projectName === "string" &&
          "description" in draft && typeof draft.description === "string" &&
          "feeAccepted" in draft && typeof draft.feeAccepted === "boolean"
        ) {
          setProjectName(draft.projectName)
          setDescription(draft.description)
          if ("contactEmail" in draft && typeof draft.contactEmail === "string") setContactEmail(draft.contactEmail)
          if ("whatsappNumber" in draft && typeof draft.whatsappNumber === "string") setWhatsappNumber(draft.whatsappNumber)
          if ("telegramId" in draft && typeof draft.telegramId === "string") setTelegramId(draft.telegramId)
          if ("preferredLanguage" in draft && typeof draft.preferredLanguage === "string") setPreferredLanguage(draft.preferredLanguage)
          if ("desiredDuration" in draft && typeof draft.desiredDuration === "string") setDesiredDuration(draft.desiredDuration)
          setFeeAccepted(draft.feeAccepted)
        }
      }
    } catch (error) {
      console.error("Could not restore the saved project request draft.", error)
      setMessage("Your saved request draft could not be restored. Please review the form before continuing.")
    } finally {
      setDraftLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!draftLoaded || requestNumber !== null) return
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({
        projectName,
        description,
        contactEmail,
        whatsappNumber,
        telegramId,
        preferredLanguage,
        desiredDuration,
        feeAccepted,
      }))
    } catch (error) {
      console.error("Could not save the project request draft.", error)
      setMessage("Could not save your request draft in this browser.")
    }
  }, [draftLoaded, projectName, description, contactEmail, whatsappNumber, telegramId, preferredLanguage, desiredDuration, feeAccepted, requestNumber])

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then((response) => setSignedIn(response.ok))
      .catch((error: unknown) => {
        if (!(error instanceof Error) || error.name !== "AbortError") {
          console.error("Could not check sign-in for project request.", error)
          setMessage("Could not verify your sign-in. Refresh the page and try again.")
        }
      })
      .finally(() => setSessionLoading(false))
    return () => controller.abort()
  }, [])

  async function updatePaymentStatus(orderId: string, status: "cancelled" | "failed") {
    const response = await fetch("/api/project-requests/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, status }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => null)
      throw new Error(result?.error ?? "Could not update request payment status.")
    }
  }

  async function beginRequestPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")
    setNeedsSignIn(false)
    if (!contactEmail.trim() && !whatsappNumber.trim() && !telegramId.trim()) {
      setMessage("Enter at least one contact method: Gmail, WhatsApp, or Telegram.")
      return
    }
    if (!preferredLanguage.trim() || !desiredDuration.trim()) {
      setMessage("Preferred language and when you need the project are required.")
      return
    }
    if (!feeAccepted) {
      setMessage("Accept the non-refundable ₹1 request fee before continuing.")
      return
    }
    if (!scriptReady || !window.Razorpay || !keyId) {
      setMessage("Checkout is unavailable. Check the Razorpay public key and reload the page.")
      return
    }

    setBusy(true)
    try {
      const orderResponse = await fetch("/api/project-requests/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          description,
          contactEmail,
          whatsappNumber,
          telegramId,
          preferredLanguage,
          desiredDuration,
          acceptsNonRefundableFee: feeAccepted,
        }),
      })
      const orderResult: unknown = await orderResponse.json()
      const order = parseRequestOrder(orderResult)
      if (orderResponse.status === 401) {
        setNeedsSignIn(true)
        throw new Error("Sign in with a verified account before paying the request fee.")
      }
      if (!orderResponse.ok || !order) {
        const errorMessage = typeof orderResult === "object" && orderResult !== null && "error" in orderResult && typeof orderResult.error === "string"
          ? orderResult.error
          : "Could not start project request payment."
        throw new Error(errorMessage)
      }
      let paymentHandled = false

      const checkout = new window.Razorpay({
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: "LUCIFER AI",
        description: "Non-refundable project request fee",
        order_id: order.order_id,
        handler: async (payment: RazorpaySuccess) => {
          paymentHandled = true
          try {
            const response = await fetch("/api/project-requests/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ request_ref: order.request_ref, ...payment }),
            })
            const result: unknown = await response.json()
            if (response.status === 401) setNeedsSignIn(true)
            if (!response.ok || typeof result !== "object" || result === null || !("request_number" in result) || typeof result.request_number !== "number") {
              const errorMessage = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
                ? result.error
                : "Payment verification failed; your request has not been submitted."
              throw new Error(errorMessage)
            }

            setRequestNumber(result.request_number)
            setShowConfirmation(true)
            sessionStorage.removeItem(draftKey)
            setMessage(
              "notification_sent" in result && result.notification_sent === false && "message" in result && typeof result.message === "string"
                ? result.message
                : "Your request is submitted. Our team will reach you within 12 hours.",
            )
          } catch (verificationError) {
            console.error("Could not verify the project request payment.", verificationError)
            setMessage(verificationError instanceof Error ? verificationError.message : "Payment verification failed.")
          } finally {
            setBusy(false)
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false)
            if (paymentHandled) return
            void updatePaymentStatus(order.order_id, "cancelled")
              .then(() => setMessage("Checkout was cancelled. No project request was submitted."))
              .catch((error: unknown) => {
                console.error("Could not record the cancelled project request payment.", error)
                setMessage(error instanceof Error ? error.message : "Checkout was cancelled, but its status could not be updated.")
              })
          },
        },
        theme: { color: "#67e8f9" },
      })

      checkout.on("payment.failed", (failure) => {
        paymentHandled = true
        setBusy(false)
        setMessage(failure.error?.description ?? "Payment failed. No project request was submitted.")
        void updatePaymentStatus(order.order_id, "failed").catch((error: unknown) => {
          console.error("Could not record the failed project request payment.", error)
          setMessage(error instanceof Error ? error.message : "Payment failed, but its status could not be updated.")
        })
      })
      checkout.open()
    } catch (error) {
      setBusy(false)
      setMessage(error instanceof Error ? error.message : "Could not start project request payment.")
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-[#101114] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-7">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setMessage("Could not load Razorpay Checkout. Check your connection and try again.")}
      />
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-200">Request a project</p>
      <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">Tell me what you want to build</h2>
      {requestNumber !== null ? (
        <div className="mt-6 rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-100" role="status">
          <p className="font-semibold">Request submitted · #{requestNumber}</p>
          <p className="mt-1">Our team will reach you within 12 hours.</p>
          {message.includes("notification email could not be sent") ? <p className="mt-2 text-amber-100">{message}</p> : null}
        </div>
      ) : (
        <form onSubmit={(event) => void beginRequestPayment(event)} className="mt-7 space-y-5">
          <label data-contact-field className="block space-y-2 text-sm font-medium text-white/85">
            Project name
            <input required minLength={2} maxLength={120} value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="What should we call your project?" className="h-12 w-full rounded-xl border border-white/15 bg-white/[0.035] px-4 text-white outline-none transition-colors placeholder:text-white/55 focus:border-cyan-200/80 focus:ring-2 focus:ring-cyan-200/20" />
          </label>
          <label data-contact-field className="block space-y-2 text-sm font-medium text-white/85">
            Project details
            <textarea required minLength={10} maxLength={5000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the features, users, design, or problem to solve." className="w-full resize-y rounded-xl border border-white/15 bg-white/[0.035] px-4 py-3 text-white outline-none transition-colors placeholder:text-white/55 focus:border-cyan-200/80 focus:ring-2 focus:ring-cyan-200/20" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label data-contact-field className="block space-y-2 text-sm font-medium text-white/85">
              Gmail / contact email
              <input type="email" maxLength={254} value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="you@gmail.com" aria-describedby="project-request-contact-help" className="h-12 w-full rounded-xl border border-white/15 bg-white/[0.035] px-4 text-white outline-none transition-colors placeholder:text-white/55 focus:border-cyan-200/80 focus:ring-2 focus:ring-cyan-200/20" />
            </label>
            <label data-contact-field className="block space-y-2 text-sm font-medium text-white/85">
              WhatsApp number
              <input type="tel" maxLength={25} value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} placeholder="+91 98765 43210" aria-describedby="project-request-contact-help" className="h-12 w-full rounded-xl border border-white/15 bg-white/[0.035] px-4 text-white outline-none transition-colors placeholder:text-white/55 focus:border-cyan-200/80 focus:ring-2 focus:ring-cyan-200/20" />
            </label>
            <label data-contact-field className="block space-y-2 text-sm font-medium text-white/85">
              Telegram ID
              <input maxLength={64} value={telegramId} onChange={(event) => setTelegramId(event.target.value)} placeholder="@username or numeric ID" aria-describedby="project-request-contact-help" className="h-12 w-full rounded-xl border border-white/15 bg-white/[0.035] px-4 text-white outline-none transition-colors placeholder:text-white/55 focus:border-cyan-200/80 focus:ring-2 focus:ring-cyan-200/20" />
            </label>
            <p id="project-request-contact-help" className="text-xs leading-5 text-white/65 sm:col-span-2">Provide at least one contact method: Gmail, WhatsApp, or Telegram.</p>
            <label className="block space-y-2 text-sm font-medium text-white/85">
              Preferred language <span className="text-cyan-200">(required)</span>
              <input required maxLength={80} value={preferredLanguage} onChange={(event) => setPreferredLanguage(event.target.value)} placeholder="e.g. English, Tamil" className="h-12 w-full rounded-xl border border-white/15 bg-white/[0.035] px-4 text-white outline-none transition-colors placeholder:text-white/55 focus:border-cyan-200/80 focus:ring-2 focus:ring-cyan-200/20" />
            </label>
            <label data-contact-field className="block space-y-2 text-sm font-medium text-white/85 sm:col-span-2">
              When do you need it? <span className="text-cyan-200">(required)</span>
              <input required maxLength={160} value={desiredDuration} onChange={(event) => setDesiredDuration(event.target.value)} placeholder="e.g. within 2 weeks, flexible" className="h-12 w-full rounded-xl border border-white/15 bg-white/[0.035] px-4 text-white outline-none transition-colors placeholder:text-white/55 focus:border-cyan-200/80 focus:ring-2 focus:ring-cyan-200/20" />
            </label>
          </div>
          {!sessionLoading && !signedIn ? (
            <p className="text-sm text-amber-100" role="status">
              Sign in with a verified email before payment. <Link href="/sign-in?next=%2Fcontact" className="font-semibold underline underline-offset-4">Sign in</Link>
            </p>
          ) : null}
          {message ? <p className="text-sm text-rose-200" role="alert">{message}</p> : null}
          {needsSignIn ? <Link href="/sign-in?next=%2Fcontact" className="inline-flex font-semibold text-cyan-200 underline underline-offset-4">Sign in to continue</Link> : null}
          <label data-contact-field className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-white/75">
            <input type="checkbox" required checked={feeAccepted} onChange={(event) => setFeeAccepted(event.target.checked)} className="mt-1 size-4 shrink-0 accent-cyan-300" />
            <span>The ₹1 fee helps discourage spam and prioritize genuine project requests. It is non-refundable, even if your request is declined or cannot be completed.</span>
          </label>
          <button type="submit" disabled={busy || sessionLoading || !signedIn || !feeAccepted} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-200 px-5 text-sm font-bold text-slate-950 transition hover:bg-cyan-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-100">
            {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <ShieldCheck aria-hidden="true" className="size-4" />}
            Pay ₹1 &amp; submit request
          </button>
        </form>
      )}
      {showConfirmation ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowConfirmation(false)
        }} onKeyDown={(event) => {
          if (event.key === "Escape") setShowConfirmation(false)
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="project-request-confirmation-title" className="w-full max-w-md rounded-2xl border border-cyan-300/25 bg-[#10131c] p-6 text-white shadow-2xl shadow-cyan-950/40 sm:p-8">
            <button type="button" aria-label="Close confirmation" onClick={() => setShowConfirmation(false)} className="float-right grid size-9 place-items-center rounded-lg border border-white/10 text-white/60 transition hover:text-white">
              <X aria-hidden="true" className="size-4" />
            </button>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">Payment verified</p>
            <h3 id="project-request-confirmation-title" className="mt-3 text-2xl font-bold">Request submitted · #{requestNumber}</h3>
            <p className="mt-4 leading-7 text-white/75">Our team will reach you within 12 hours using the contact details you provided.</p>
            {message.includes("notification email could not be sent") ? <p className="mt-3 text-sm leading-6 text-amber-200">{message}</p> : null}
            <button type="button" autoFocus onClick={() => setShowConfirmation(false)} className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-cyan-300 px-5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">
              Done
            </button>
          </section>
        </div>
      ) : null}
    </div>
  )
}
