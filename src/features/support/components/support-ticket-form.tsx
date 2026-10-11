"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { LoaderCircle, Paperclip, Send } from "lucide-react"

type SupportOrder = {
  orderId: string
  projectTitle: string
  status: string
}

function isSupportOrder(value: unknown): value is SupportOrder {
  return typeof value === "object" &&
    value !== null &&
    "orderId" in value && typeof value.orderId === "string" &&
    "projectTitle" in value && typeof value.projectTitle === "string" &&
    "status" in value && typeof value.status === "string"
}

const issueTypes = [
  { value: "account", label: "Account access" },
  { value: "payment", label: "Payment or wallet" },
  { value: "project", label: "Project purchase" },
  { value: "api", label: "API issue" },
  { value: "other", label: "Other" },
] as const

export function SupportTicketForm() {
  const [orders, setOrders] = useState<SupportOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [needsSignIn, setNeedsSignIn] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/transactions", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          setNeedsSignIn(true)
          return
        }
        const result: unknown = await response.json()
        if (!response.ok) {
          const message = typeof result === "object" && result !== null &&
            "error" in result && typeof result.error === "string"
            ? result.error
            : "Could not load your order numbers."
          throw new Error(message)
        }
        if (
          typeof result !== "object" ||
          result === null ||
          !("transactions" in result) ||
          !Array.isArray(result.transactions) ||
          !result.transactions.every(isSupportOrder)
        ) {
          throw new Error("Your order list had an invalid format.")
        }
        setOrders(result.transactions)
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return
        console.error("Could not load support ticket order numbers.", caught)
        setError(caught instanceof Error ? caught.message : "Could not load your order numbers.")
      })
      .finally(() => setLoadingOrders(false))
    return () => controller.abort()
  }, [])

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setError("")
    setSuccess("")
    setSubmitting(true)

    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        body: new FormData(form),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message = typeof result === "object" && result !== null &&
          "error" in result && typeof result.error === "string"
          ? result.error
          : "Could not submit your support ticket."
        if (response.status === 401) setNeedsSignIn(true)
        throw new Error(message)
      }
      if (
        typeof result !== "object" ||
        result === null ||
        !("ticketId" in result) ||
        typeof result.ticketId !== "string"
      ) {
        throw new Error("The support ticket response had an invalid format.")
      }
      const notificationSent = "notificationSent" in result && result.notificationSent === true
      setSuccess(notificationSent
        ? `Ticket ${result.ticketId} was saved and sent to support.`
        : `Ticket ${result.ticketId} was saved. The team can see it in their inbox, but the email alert could not be sent.`)
      form.reset()
      window.dispatchEvent(new Event("support-ticket-created"))
    } catch (caught: unknown) {
      console.error("Could not submit a customer support ticket.", caught)
      setError(caught instanceof Error ? caught.message : "Could not submit your support ticket.")
    } finally {
      setSubmitting(false)
    }
  }

  const fieldClassName = "mt-2 min-h-12 w-full rounded-lg border border-input bg-muted/60 px-4 py-3 text-sm text-foreground outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:focus:border-cyan-300 dark:focus:ring-cyan-300/20"

  return (
    <form onSubmit={submitTicket} className="min-w-0 space-y-6" aria-labelledby="submit-ticket-heading">
      {needsSignIn ? (
        <div className="border-l-2 border-cyan-600 py-1 pl-4 text-sm leading-6 text-muted-foreground dark:border-cyan-300">
          <Link
            href="/sign-in?next=/support"
            className="font-semibold text-cyan-800 underline underline-offset-4 hover:text-cyan-600 dark:text-cyan-200 dark:hover:text-cyan-100"
          >
            Sign in
          </Link>{" "}
          to submit a ticket and load your order numbers.
        </div>
      ) : null}

      <label className="block text-sm font-semibold" htmlFor="support-issue-type">
        Issue type
        <select
          id="support-issue-type"
          name="issueType"
          required
          defaultValue=""
          className={fieldClassName}
        >
          <option value="" disabled>Select an issue type</option>
          {issueTypes.map((issue) => (
            <option key={issue.value} value={issue.value}>{issue.label}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-semibold" htmlFor="support-order-id">
        Order number <span className="font-normal text-muted-foreground">(optional)</span>
        <select
          id="support-order-id"
          name="orderId"
          defaultValue=""
          disabled={loadingOrders || needsSignIn}
          className={fieldClassName}
        >
          <option value="">
            {loadingOrders ? "Loading your orders..." : needsSignIn ? "Sign in to load your orders" : "No related order"}
          </option>
          {orders.map((order) => (
            <option key={order.orderId} value={order.orderId}>
              {order.orderId} - {order.projectTitle} ({order.status})
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-semibold" htmlFor="support-description">
        Problem description
        <textarea
          id="support-description"
          name="description"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          placeholder="Please describe your issue in detail..."
          className={`${fieldClassName} min-h-40 resize-y`}
        />
      </label>

      <label className="block text-sm font-semibold" htmlFor="support-attachment">
        Attachment <span className="font-normal text-muted-foreground">(optional)</span>
        <span className="mt-2 flex min-h-12 w-fit items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-cyan-600 dark:hover:border-cyan-300">
          <Paperclip aria-hidden="true" size={16} />
          Choose a file
          <input
            id="support-attachment"
            name="attachment"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            aria-describedby="support-attachment-help"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file && file.size > 5 * 1024 * 1024) {
                event.currentTarget.value = ""
                setError("Attachments must be 5 MB or smaller.")
                return
              }
              setError("")
            }}
            className="sr-only"
          />
        </span>
        <span id="support-attachment-help" className="mt-2 block text-xs font-normal leading-5 text-muted-foreground">
          JPG, PNG, WebP, or PDF. Maximum file size: 5 MB.
        </span>
      </label>

      {error ? <p role="alert" className="text-sm leading-6 text-rose-700 dark:text-rose-300">{error}</p> : null}
      {success ? <p role="status" className="text-sm leading-6 text-emerald-700 dark:text-emerald-300">{success}</p> : null}

      <button
        type="submit"
        disabled={submitting || needsSignIn}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-cyan-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-600 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cyan-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200 dark:focus-visible:outline-cyan-200"
      >
        {submitting ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin" /> : <Send aria-hidden="true" size={16} />}
        {submitting ? "Sending ticket..." : "Submit ticket"}
      </button>
    </form>
  )
}
