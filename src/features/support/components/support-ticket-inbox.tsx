"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { LoaderCircle, MessageCircle, Send } from "lucide-react"
import type { SupportStatus, SupportTicket } from "@/features/support/server/support-tickets"

type InboxResult = { tickets: SupportTicket[]; totalShown: number; limit: number }

const statusLabels: Record<SupportStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_user: "Waiting for support",
  resolved: "Resolved",
}

function isTicketMessage(value: unknown) {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "string" &&
    "role" in value && (value.role === "customer" || value.role === "staff") &&
    "authorName" in value && typeof value.authorName === "string" &&
    "authorEmail" in value && (typeof value.authorEmail === "string" || value.authorEmail === null) &&
    "body" in value && typeof value.body === "string" &&
    "createdAt" in value && typeof value.createdAt === "string"
}

function isSupportTicket(value: unknown): value is SupportTicket {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "string" &&
    "ticketCode" in value && typeof value.ticketCode === "string" &&
    "userId" in value && typeof value.userId === "string" &&
    "userName" in value && typeof value.userName === "string" &&
    "userEmail" in value && (typeof value.userEmail === "string" || value.userEmail === null) &&
    "publicUid" in value && (typeof value.publicUid === "string" || value.publicUid === null) &&
    "issueType" in value && ["account", "payment", "project", "api", "other"].includes(String(value.issueType)) &&
    "orderId" in value && (typeof value.orderId === "string" || value.orderId === null) &&
    "initialMessage" in value && typeof value.initialMessage === "string" &&
    "status" in value && ["open", "in_progress", "waiting_on_user", "resolved"].includes(String(value.status)) &&
    "createdAt" in value && typeof value.createdAt === "string" &&
    "updatedAt" in value && typeof value.updatedAt === "string" &&
    "messages" in value && Array.isArray(value.messages) && value.messages.every(isTicketMessage)
}

function isInboxResult(value: unknown): value is InboxResult {
  return typeof value === "object" && value !== null &&
    "tickets" in value && Array.isArray(value.tickets) && value.tickets.every(isSupportTicket) &&
    "totalShown" in value && typeof value.totalShown === "number" &&
    "limit" in value && typeof value.limit === "number"
}

function errorText(value: unknown) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
    ? value.error
    : "Could not load your support tickets."
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)
}

export function SupportTicketInbox() {
  const [data, setData] = useState<InboxResult | null>(null)
  const [signedOut, setSignedOut] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const load = useCallback(async (signal?: AbortSignal) => {
    setError("")
    const response = await fetch("/api/support/tickets", { cache: "no-store", signal })
    const result: unknown = await response.json().catch(() => null)
    if (response.status === 401) {
      setSignedOut(true)
      setData(null)
      return
    }
    if (!response.ok || !isInboxResult(result)) throw new Error(errorText(result))
    setSignedOut(false)
    setData(result)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const refresh = () => { void load().catch((caught: unknown) => {
      if (caught instanceof Error && caught.name === "AbortError") return
      console.error("Could not load customer support ticket history.", caught)
      setError(caught instanceof Error ? caught.message : "Could not load your support tickets.")
    }).finally(() => setLoading(false)) }
    window.addEventListener("support-ticket-created", refresh)
    load(controller.signal)
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return
        console.error("Could not load customer support ticket history.", caught)
        setError(caught instanceof Error ? caught.message : "Could not load your support tickets.")
      })
      .finally(() => setLoading(false))
    return () => {
      controller.abort()
      window.removeEventListener("support-ticket-created", refresh)
    }
  }, [load])

  async function reply(event: FormEvent<HTMLFormElement>, ticket: SupportTicket) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const message = String(formData.get("message") ?? "").trim()
    if (!message || message.length > 5000) {
      setError("Write a reply of 1 to 5,000 characters.")
      return
    }
    setBusyId(ticket.id)
    setError("")
    setNotice("")
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(ticket.id)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(errorText(result))
      await load()
      if (typeof result === "object" && result !== null &&
        "notificationSent" in result && result.notificationSent !== true) {
        setNotice("Your reply was saved, but our team email alert could not be sent.")
      }
      form.reset()
    } catch (caught) {
      console.error("Could not send a reply to customer support.", caught)
      setError(caught instanceof Error ? caught.message : "Could not send your reply.")
    } finally {
      setBusyId("")
    }
  }

  return (
    <section className="mt-16 border-t border-border pt-10" aria-labelledby="support-ticket-history-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">Your conversations</p>
          <h2 id="support-ticket-history-heading" className="mt-3 text-3xl font-semibold tracking-tight">Support ticket history</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Team replies appear here. You can continue the conversation from your account.</p>
        </div>
        {data ? <span className="text-sm text-muted-foreground">{data.totalShown} recent tickets</span> : null}
      </div>

      {error ? <p role="alert" className="mt-5 text-sm leading-6 text-rose-700 dark:text-rose-300">{error}</p> : null}
      {notice ? <p role="status" className="mt-5 text-sm leading-6 text-amber-700 dark:text-amber-300">{notice}</p> : null}
      {loading ? (
        <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> Loading your tickets...</p>
      ) : signedOut ? (
        <p className="mt-6 text-sm leading-6 text-muted-foreground">
          <Link className="font-semibold text-cyan-800 underline underline-offset-4 dark:text-cyan-200" href="/login?next=/support">Sign in</Link> to view your submitted tickets and team replies.
        </p>
      ) : data?.tickets.length ? (
        <div className="mt-6 divide-y divide-border border-y border-border">
          {data.tickets.map((ticket) => (
            <details key={ticket.id} className="group py-5">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block font-semibold">{ticket.ticketCode}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{formatDate(ticket.updatedAt)} · {ticket.messages.length} messages</span>
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  ticket.status === "resolved"
                    ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                    : "border-cyan-600/40 text-cyan-800 dark:text-cyan-200"
                }`}>{statusLabels[ticket.status]}</span>
              </summary>
              <div className="mt-5 space-y-4">
                {ticket.messages.map((message) => (
                  <article key={message.id} className="rounded-xl border border-border bg-muted/30 p-4">
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <strong>{message.role === "staff" ? "Support team" : "You"}</strong>
                      <time className="text-xs text-muted-foreground">{formatDate(message.createdAt)}</time>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                  </article>
                ))}
                <form className="grid gap-3" onSubmit={(event) => void reply(event, ticket)}>
                  <label className="text-sm font-semibold" htmlFor={`support-reply-${ticket.id}`}>Reply to the team</label>
                  <textarea id={`support-reply-${ticket.id}`} name="message" rows={3} maxLength={5000} required disabled={busyId === ticket.id} className="w-full rounded-lg border border-input bg-muted/50 px-4 py-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20" placeholder="Add details or respond to the support team..." />
                  <button type="submit" disabled={busyId === ticket.id} className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200">
                    {busyId === ticket.id ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
                    {busyId === ticket.id ? "Sending..." : "Send reply"}
                  </button>
                </form>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="mt-6 inline-flex items-center gap-2 text-sm leading-6 text-muted-foreground"><MessageCircle size={17} aria-hidden="true" /> No tickets yet. Submit a request above to start a conversation.</p>
      )}
      {data && data.totalShown >= data.limit ? <p className="mt-3 text-xs text-muted-foreground">Showing your {data.limit} most recently updated tickets.</p> : null}
    </section>
  )
}
