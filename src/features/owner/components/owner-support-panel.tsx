"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Forward, LoaderCircle, MessageSquareReply, RefreshCw, Send } from "lucide-react"
import type { SupportStatus, SupportTicket } from "@/features/support/server/support-tickets"

type InboxResult = { tickets: SupportTicket[]; totalShown: number; limit: number }
type TicketFilter = "open" | "in_progress" | "waiting_on_user" | "resolved" | "all"

const statusLabels: Record<SupportStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_user: "Waiting on user",
  resolved: "Resolved",
}

const issueLabels = {
  account: "Account access",
  payment: "Payment or wallet",
  project: "Project purchase",
  api: "API issue",
  other: "Other",
} as const

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
    "messages" in value && Array.isArray(value.messages) && value.messages.every(isTicketMessage) &&
    (!("escalatedAt" in value) || value.escalatedAt === null || typeof value.escalatedAt === "string") &&
    (!("escalatedBy" in value) || value.escalatedBy === null || typeof value.escalatedBy === "string") &&
    (!("escalationNote" in value) || value.escalationNote === null || typeof value.escalationNote === "string")
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

function isInboxResult(value: unknown): value is InboxResult {
  return typeof value === "object" && value !== null &&
    "tickets" in value && Array.isArray(value.tickets) && value.tickets.every(isSupportTicket) &&
    "totalShown" in value && typeof value.totalShown === "number" &&
    "limit" in value && typeof value.limit === "number"
}

function readError(value: unknown) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
    ? value.error
    : "Could not update the support ticket."
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)
}

export function OwnerSupportPanel({ mode = "support" }: { mode?: "support" | "escalations" }) {
  const [filter, setFilter] = useState<TicketFilter>("open")
  const [data, setData] = useState<InboxResult | null>(null)
  const [selectedId, setSelectedId] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const isEscalations = mode === "escalations"
  const endpoint = isEscalations ? "/api/owner/escalations" : "/api/owner/support/tickets"

  const load = useCallback(async (signal?: AbortSignal) => {
    setError("")
    const url = isEscalations ? endpoint : `${endpoint}?status=${filter}`
    const response = await fetch(url, { cache: "no-store", signal })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok || !isInboxResult(result)) throw new Error(readError(result))
    setData(result)
    setSelectedId((current) => result.tickets.some((ticket) => ticket.id === current)
      ? current
      : result.tickets[0]?.id ?? "")
  }, [endpoint, filter, isEscalations])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    load(controller.signal)
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return
        console.error("Could not load support tickets.", caught)
        setError(caught instanceof Error ? caught.message : "Could not load support tickets.")
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [load])

  const selected = data?.tickets.find((ticket) => ticket.id === selectedId) ?? null

  async function mutate(payload:
    | { action: "reply"; ticketId: string; message: string }
    | { action: "status"; ticketId: string; status: SupportStatus }
    | { action: "forward"; ticketId: string; note: string }
  ) {
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(readError(result))
      const notificationSent = typeof result === "object" && result !== null &&
        "notificationSent" in result && result.notificationSent === true
      await load()
      if (payload.action === "reply" && !notificationSent) {
        setNotice("Reply saved. Email delivery failed; the customer can still read it in Support.")
      }
      if (payload.action === "forward") setNotice("Ticket forwarded to the owner escalation queue.")
      if (payload.action === "forward" && !notificationSent) {
        setNotice("Ticket forwarded. The owner email alert failed, but the request is available in Forwarded Support Requests.")
      }
      return true
    } catch (caught) {
      console.error("Could not update support ticket.", caught)
      setError(caught instanceof Error ? caught.message : "Could not update the support ticket.")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const form = event.currentTarget
    const formData = new FormData(form)
    const message = String(formData.get("message") ?? "").trim()
    if (message.length < 1 || message.length > 5000) {
      setError("Write a reply of 1 to 5,000 characters.")
      return
    }
    if (await mutate({ action: "reply", ticketId: selected.id, message })) form.reset()
  }

  async function submitForward(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const form = event.currentTarget
    const note = String(new FormData(form).get("note") ?? "").trim()
    if (note.length < 3 || note.length > 1000) {
      setError("Add an internal handoff note of 3 to 1,000 characters.")
      return
    }
    if (await mutate({ action: "forward", ticketId: selected.id, note })) form.reset()
  }

  async function refresh() {
    setLoading(true)
    try {
      await load()
    } catch (caught) {
      console.error("Could not refresh the support ticket inbox.", caught)
      setError(caught instanceof Error ? caught.message : "Could not refresh support tickets.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="owner-support-panel" aria-label={isEscalations ? "Forwarded support request inbox" : "Customer support ticket inbox"}>
      {error ? <p className="owner-users-error" role="alert">{error}</p> : null}
      {notice ? <p className="owner-support-notice" role="status">{notice}</p> : null}
      <header className="owner-support-toolbar">
        <div>
          <div className="owner-support-count"><MessageSquareReply size={17} aria-hidden="true" /> {data?.totalShown ?? "—"} {isEscalations ? "forwarded requests" : "tickets"}</div>
          <p>{isEscalations ? "Review cases handed off by customer support, respond to users, and resolve escalations." : "Review user requests, reply to customers, and forward cases that need owner attention."}</p>
        </div>
        <div className="owner-support-controls">
          {!isEscalations ? (
            <label>
              <span className="sr-only">Filter tickets by status</span>
              <select value={filter} onChange={(event) => setFilter(event.target.value as TicketFilter)}>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="waiting_on_user">Waiting on user</option>
                <option value="resolved">Resolved</option>
                <option value="all">All recent</option>
              </select>
            </label>
          ) : null}
          <button type="button" className="owner-users-refresh" disabled={loading || busy} onClick={refresh} aria-label="Refresh support tickets">
            {loading ? <LoaderCircle size={16} className="owner-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
            Refresh
          </button>
        </div>
      </header>

      {loading && !data ? (
        <div className="owner-support-empty"><LoaderCircle size={21} className="owner-spin" aria-hidden="true" /> Loading support inbox...</div>
      ) : data?.tickets.length ? (
        <div className="owner-support-layout">
          <nav className="owner-support-list" aria-label="Support tickets">
            {data.tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                className={`owner-support-ticket${ticket.id === selectedId ? " is-selected" : ""}`}
                onClick={() => { setSelectedId(ticket.id); setNotice(""); setError("") }}
              >
                <span className="owner-support-ticket-top">
                  <strong>{ticket.ticketCode}</strong>
                  <span className={`owner-support-status is-${ticket.status}`}>{statusLabels[ticket.status]}</span>
                </span>
                <span className="owner-support-ticket-name">{ticket.userName}</span>
                {ticket.escalatedAt ? <span className="owner-support-ticket-forwarded">Forwarded to owner</span> : null}
                <span className="owner-support-ticket-preview">{ticket.messages.at(-1)?.body ?? ticket.initialMessage}</span>
                <span className="owner-support-ticket-date">{formatDate(ticket.updatedAt)}</span>
              </button>
            ))}
          </nav>

          {selected ? (
            <article className="owner-support-conversation">
              <header className="owner-support-user">
                <div>
                  <p className="owner-support-eyebrow">{selected.ticketCode} · {issueLabels[selected.issueType]}</p>
                  <h2>{selected.userName}</h2>
                  <p>{selected.userEmail ?? "No email"}{selected.publicUid ? ` · UID ${selected.publicUid}` : ""}</p>
                  {selected.orderId ? <p>Order: {selected.orderId}</p> : null}
                  {selected.escalatedAt ? <p>Forwarded: {formatDate(selected.escalatedAt)}</p> : null}
                </div>
                <label>
                  <span className="sr-only">Ticket status</span>
                  <select
                    value={selected.status}
                    disabled={busy}
                    onChange={(event) => void mutate({ action: "status", ticketId: selected.id, status: event.target.value as SupportStatus })}
                  >
                    {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </header>

              <div className="owner-support-messages" aria-live="polite">
                {selected.messages.map((message) => (
                  <div key={message.id} className={`owner-support-message is-${message.role}`}>
                    <div><strong>{message.role === "staff" ? `Support · ${message.authorName}` : message.authorName}</strong><time>{formatDate(message.createdAt)}</time></div>
                    <p>{message.body}</p>
                  </div>
                ))}
              </div>

              {selected.escalatedAt && selected.escalationNote ? (
                <aside className="owner-support-escalation-note">
                  <strong>Internal handoff note</strong>
                  <p>{selected.escalationNote}</p>
                </aside>
              ) : null}

              {!isEscalations && !selected.escalatedAt ? (
                <form className="owner-support-forward" onSubmit={submitForward}>
                  <label htmlFor="owner-support-forward-note">Forward to owner</label>
                  <p>This note is internal and will only be visible in Forwarded Support Requests.</p>
                  <textarea id="owner-support-forward-note" name="note" rows={3} minLength={3} maxLength={1000} required disabled={busy} placeholder="Explain what support has tried and what the owner should review..." />
                  <button type="submit" disabled={busy}>
                    {busy ? <LoaderCircle size={16} className="owner-spin" aria-hidden="true" /> : <Forward size={15} aria-hidden="true" />}
                    {busy ? "Forwarding..." : "Forward to owner"}
                  </button>
                </form>
              ) : null}

              <form className="owner-support-reply" onSubmit={submitReply}>
                <label htmlFor="owner-support-reply">Reply to the customer</label>
                <textarea id="owner-support-reply" name="message" rows={4} maxLength={5000} required disabled={busy} placeholder="Write a clear response for the user..." />
                <button type="submit" disabled={busy}>
                  {busy ? <LoaderCircle size={16} className="owner-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
                  {busy ? "Sending..." : "Send reply"}
                </button>
              </form>
            </article>
          ) : null}
        </div>
      ) : (
        <div className="owner-support-empty">
          {loading ? <LoaderCircle size={21} className="owner-spin" aria-hidden="true" /> : <MessageSquareReply size={21} aria-hidden="true" />}
          {loading ? "Loading support inbox..." : "No tickets match this status filter."}
        </div>
      )}
      <p className="owner-support-limit">Showing up to {data?.limit ?? 100} most recently updated tickets.</p>
    </section>
  )
}
