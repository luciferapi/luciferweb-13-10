"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { ChevronLeft, ChevronRight, LoaderCircle, Mail, Search, Send, UsersRound } from "lucide-react"

type Recipient = { id: string; publicUid: string; name: string; email: string }
type RecipientPage = { recipients: Recipient[]; total: number; totalRecipients: number; page: number; pageSize: number }

function isRecipient(value: unknown): value is Recipient {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "string" &&
    "publicUid" in value && typeof value.publicUid === "string" &&
    "name" in value && typeof value.name === "string" &&
    "email" in value && typeof value.email === "string"
}

function isRecipientPage(value: unknown): value is RecipientPage {
  return typeof value === "object" && value !== null &&
    "recipients" in value && Array.isArray(value.recipients) && value.recipients.every(isRecipient) &&
    "total" in value && typeof value.total === "number" &&
    "totalRecipients" in value && typeof value.totalRecipients === "number" &&
    "page" in value && typeof value.page === "number" &&
    "pageSize" in value && typeof value.pageSize === "number"
}

function getError(value: unknown, fallback: string) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
    ? value.error
    : fallback
}

export function OwnerBroadcastsPanel() {
  const [recipientPage, setRecipientPage] = useState<RecipientPage | null>(null)
  const [page, setPage] = useState(1)
  const [searchDraft, setSearchDraft] = useState("")
  const [search, setSearch] = useState("")
  const [mode, setMode] = useState<"all" | "selected">("all")
  const [selectedRecipients, setSelectedRecipients] = useState<Map<string, Recipient>>(new Map())
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadRecipients = useCallback(async (signal?: AbortSignal) => {
    setError("")
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set("search", search)
    const response = await fetch(`/api/owner/broadcasts?${params}`, { cache: "no-store", signal })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok || !isRecipientPage(result)) throw new Error(getError(result, "Could not load users with email addresses."))
    setRecipientPage(result)
  }, [page, search])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    loadRecipients(controller.signal)
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return
        console.error("Could not load broadcast recipients.", caught)
        setError(caught instanceof Error ? caught.message : "Could not load users with email addresses.")
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [loadRecipients])

  const recipients = recipientPage?.recipients ?? []
  const allOnPageSelected = recipients.length > 0 && recipients.every((recipient) => selectedRecipients.has(recipient.id))
  const pageCount = recipientPage ? Math.max(1, Math.ceil(recipientPage.total / recipientPage.pageSize)) : 1
  const selectedCount = selectedRecipients.size
  const targetCount = mode === "all" ? recipientPage?.totalRecipients ?? 0 : selectedCount

  const selectedIds = useMemo(() => [...selectedRecipients.keys()], [selectedRecipients])

  function toggleRecipient(recipient: Recipient) {
    setSelectedRecipients((current) => {
      const next = new Map(current)
      if (next.has(recipient.id)) next.delete(recipient.id)
      else next.set(recipient.id, recipient)
      return next
    })
  }

  function togglePageRecipients() {
    setSelectedRecipients((current) => {
      const next = new Map(current)
      if (allOnPageSelected) recipients.forEach((recipient) => next.delete(recipient.id))
      else recipients.forEach((recipient) => next.set(recipient.id, recipient))
      return next
    })
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setSearch(searchDraft.trim())
  }

  async function sendBroadcast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!targetCount) {
      setError(mode === "all" ? "There are no users with email addresses." : "Select at least one user.")
      return
    }
    if (mode === "selected" && selectedIds.length > 5000) {
      setError("Select no more than 5,000 recipients per message.")
      return
    }
    const recipientDescription = mode === "all" ? `all ${targetCount} users with email addresses` : `${targetCount} selected users`
    if (!window.confirm(`Send this email to ${recipientDescription}? Recipients will not see each other's email addresses.`)) return

    setSending(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/owner/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          message,
          mode,
          userIds: mode === "selected" ? selectedIds : [],
        }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (typeof result !== "object" || result === null) throw new Error("The mail server returned an invalid response.")
      if (!response.ok) {
        const failure = "message" in result && typeof result.message === "string"
          ? result.message
          : getError(result, "Could not send the broadcast email.")
        throw new Error(failure)
      }
      const confirmation = "message" in result && typeof result.message === "string"
        ? result.message
        : "Broadcast email sent."
      setNotice(confirmation)
      setSubject("")
      setMessage("")
      setSelectedRecipients(new Map())
    } catch (caught) {
      console.error("Could not send broadcast email.", caught)
      setError(caught instanceof Error ? caught.message : "Could not send the broadcast email.")
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="owner-broadcasts-panel" aria-labelledby="owner-broadcasts-title">
      <header className="owner-broadcasts-heading">
        <div>
          <h2 id="owner-broadcasts-title">Email broadcast</h2>
          <p>Send an announcement to chosen users or every account with an email address.</p>
        </div>
        <span className="owner-access-pill"><Mail aria-hidden="true" size={14} /> SMTP email</span>
      </header>

      {notice ? <p className="owner-admins-notice" role="status">{notice}</p> : null}
      {error ? <p className="owner-support-notice" role="alert">{error}</p> : null}

      <div className="owner-broadcasts-layout">
        <section className="owner-broadcasts-recipients" aria-labelledby="broadcast-recipients-heading">
          <div className="owner-broadcasts-subheading">
            <div>
              <h3 id="broadcast-recipients-heading">Recipients</h3>
              <p>{formatRecipientCount(recipientPage?.totalRecipients ?? 0)} users with email addresses</p>
            </div>
            <span><UsersRound aria-hidden="true" size={14} /> {selectedCount} selected</span>
          </div>

          <fieldset className="owner-broadcasts-mode">
            <legend>Send to</legend>
            <label>
              <input type="radio" name="broadcast-mode" checked={mode === "all"} onChange={() => setMode("all")} />
              All users with email ({formatRecipientCount(recipientPage?.totalRecipients ?? 0)})
            </label>
            <label>
              <input type="radio" name="broadcast-mode" checked={mode === "selected"} onChange={() => setMode("selected")} />
              Selected users ({selectedCount})
            </label>
          </fieldset>

          <form className="owner-broadcasts-search" onSubmit={submitSearch}>
            <label htmlFor="broadcast-user-search">Find users by name, email, or user ID</label>
            <div>
              <input
                id="broadcast-user-search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search users"
              />
              <button type="submit" className="owner-secondary-button" aria-label="Search users"><Search aria-hidden="true" size={15} /></button>
            </div>
          </form>

          {loading ? (
            <p className="owner-support-empty"><LoaderCircle aria-hidden="true" size={16} className="animate-spin" /> Loading recipients</p>
          ) : recipients.length === 0 ? (
            <p className="owner-support-empty">No users with email addresses match this search.</p>
          ) : (
            <>
              <label className="owner-broadcasts-select-page">
                <input type="checkbox" checked={allOnPageSelected} onChange={togglePageRecipients} />
                Select all {recipients.length} on this page
              </label>
              <ul className="owner-broadcasts-user-list">
                {recipients.map((recipient) => (
                  <li key={recipient.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedRecipients.has(recipient.id)}
                        onChange={() => toggleRecipient(recipient)}
                        aria-label={`Select ${recipient.name}, ${recipient.email}`}
                      />
                      <span><strong>{recipient.name}</strong><small>{recipient.email}</small></span>
                      <small>{recipient.publicUid}</small>
                    </label>
                  </li>
                ))}
              </ul>
              <nav className="owner-broadcasts-pagination" aria-label="Recipient pages">
                <button type="button" className="owner-secondary-button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
                  <ChevronLeft aria-hidden="true" size={14} /> Previous
                </button>
                <span>Page {page} of {pageCount}</span>
                <button type="button" className="owner-secondary-button" disabled={page >= pageCount || loading} onClick={() => setPage((current) => current + 1)}>
                  Next <ChevronRight aria-hidden="true" size={14} />
                </button>
              </nav>
            </>
          )}
        </section>

        <form className="owner-broadcasts-composer" onSubmit={(event) => void sendBroadcast(event)}>
          <div className="owner-broadcasts-subheading">
            <div><h3>Compose message</h3><p>Recipient email addresses are kept private.</p></div>
          </div>
          <label>
            <span>Subject</span>
            <input required minLength={3} maxLength={150} value={subject} onChange={(event) => setSubject(event.target.value)} />
          </label>
          <label>
            <span>Message</span>
            <textarea required minLength={3} maxLength={5000} rows={10} value={message} onChange={(event) => setMessage(event.target.value)} />
            <small>{message.length}/5000 characters</small>
          </label>
          <p className="owner-broadcasts-target">Sending to <strong>{formatRecipientCount(targetCount)}</strong> {mode === "all" ? "users with email addresses" : "selected users"}.</p>
          <button type="submit" className="owner-primary-button" disabled={sending || loading || targetCount === 0}>
            {sending ? <LoaderCircle aria-hidden="true" size={15} className="animate-spin" /> : <Send aria-hidden="true" size={15} />}
            {sending ? "Sending email..." : "Send email"}
          </button>
        </form>
      </div>
    </section>
  )
}

function formatRecipientCount(value: number) {
  return new Intl.NumberFormat("en-IN").format(value)
}
