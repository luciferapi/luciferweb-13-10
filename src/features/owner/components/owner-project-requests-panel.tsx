"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BadgeCheck,
  Banknote,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  History,
  LoaderCircle,
  Mail,
  MessageSquareText,
  Phone,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  UserRound,
  XCircle,
} from "lucide-react"
import {
  parseOwnerProjectRequests,
  type OwnerProjectRequest,
  type ProjectRequestReviewStatus,
} from "@/features/projects/project-request-types"

const filters: Array<{ id: "pending" | "accepted" | "rejected" | "all"; label: string }> = [
  { id: "pending", label: "Needs review" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Declined" },
  { id: "all", label: "All paid" },
]

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function formatMoney(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function reviewStyle(status: ProjectRequestReviewStatus) {
  if (status === "accepted") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
  if (status === "rejected") return "border-rose-400/25 bg-rose-400/10 text-rose-300"
  return "border-amber-400/25 bg-amber-400/10 text-amber-200"
}

function ReviewBadge({ status }: { status: ProjectRequestReviewStatus }) {
  const Icon = status === "accepted" ? CheckCircle2 : status === "rejected" ? XCircle : Clock3
  const label = status === "accepted" ? "Accepted" : status === "rejected" ? "Declined" : "Needs review"
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${reviewStyle(status)}`}>
      <Icon aria-hidden="true" className="size-3.5" /> {label}
    </span>
  )
}

export function OwnerProjectRequestsPanel() {
  const [requests, setRequests] = useState<OwnerProjectRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("pending")
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({})
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [busyRequestRef, setBusyRequestRef] = useState<string | null>(null)

  const loadRequests = useCallback(async (signal?: AbortSignal, quiet = false) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/owner/project-requests", {
        cache: "no-store",
        signal,
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error
          : "Could not load project requests."
        throw new Error(message)
      }
      setRequests(parseOwnerProjectRequests(result))
    } catch (caught) {
      if (signal?.aborted) return
      console.error("Could not load paid project requests.", caught)
      setError(caught instanceof Error ? caught.message : "Could not load project requests.")
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadRequests(controller.signal)
    return () => controller.abort()
  }, [loadRequests])

  const counts = useMemo(() => ({
    pending: requests.filter((request) => request.reviewStatus === "pending").length,
    accepted: requests.filter((request) => request.reviewStatus === "accepted").length,
    rejected: requests.filter((request) => request.reviewStatus === "rejected").length,
  }), [requests])

  const visibleRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return requests.filter((request) => {
      const matchesFilter = filter === "all" || request.reviewStatus === filter
      const searchable = [request.projectName, request.userName, request.userEmail, request.description, request.requestRef]
        .join(" ")
        .toLowerCase()
      return matchesFilter && (!normalizedQuery || searchable.includes(normalizedQuery))
    })
  }, [filter, query, requests])

  async function handleReview(request: OwnerProjectRequest, decision: "accepted" | "rejected") {
    const ownerMessage = (messageDrafts[request.requestRef] ?? "").trim()
    if (decision === "accepted" && !ownerMessage) {
      setValidationErrors((current) => ({ ...current, [request.requestRef]: "Write a message for the user before accepting." }))
      return
    }

    setBusyRequestRef(request.requestRef)
    setNotice("")
    setError("")
    setValidationErrors((current) => ({ ...current, [request.requestRef]: "" }))
    try {
      const response = await fetch("/api/owner/project-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestRef: request.requestRef, decision, ownerMessage }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error
          : "Could not save the request decision."
        throw new Error(message)
      }
      setNotice(decision === "accepted"
        ? `Request “${request.projectName}” accepted. The owner message is now visible on the user's Process page.`
        : `Request “${request.projectName}” declined.`)
      setMessageDrafts((current) => ({ ...current, [request.requestRef]: "" }))
      await loadRequests(undefined, true)
    } catch (caught) {
      console.error("Could not save project request decision.", caught)
      setError(caught instanceof Error ? caught.message : "Could not save the request decision.")
    } finally {
      setBusyRequestRef(null)
    }
  }

  return (
    <div className="home-brand-theme space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-lime/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-lime">
              <Sparkles aria-hidden="true" className="size-3.5" /> Owner workspace · Requests
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Project request inbox</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Review payment-verified briefs, respond with a clear next step, and keep every decision in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadRequests(undefined, true)} disabled={refreshing} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background/70 px-3.5 text-sm font-medium text-foreground transition hover:border-lime/40 hover:bg-muted disabled:opacity-60">
              <RefreshCw aria-hidden="true" className={`size-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </button>
            <Link href="/owner/project-requests/history" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-lime px-4 text-sm font-semibold text-charcoal transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <History aria-hidden="true" className="size-4" /> Request history
            </Link>
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-200"><Clock3 aria-hidden="true" className="size-4" /> Needs review</div>
            <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{counts.pending}</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-emerald-300"><CheckCircle2 aria-hidden="true" className="size-4" /> Accepted</div>
            <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{counts.accepted}</p>
          </div>
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-rose-300"><XCircle aria-hidden="true" className="size-4" /> Declined</div>
            <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{counts.rejected}</p>
          </div>
        </div>
      </section>

      {notice ? <p role="status" className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-200">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-200">{error}</p> : null}

      <section aria-labelledby="request-queue-heading" className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="request-queue-heading" className="text-xl font-semibold text-foreground">Request queue</h2>
            <p className="mt-1 text-sm text-muted-foreground">{visibleRequests.length} {visibleRequests.length === 1 ? "request" : "requests"} shown · Paid requests only</p>
          </div>
          <label className="relative block w-full lg:max-w-sm">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">Search requests</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project, customer, or brief" className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-lime focus:ring-2 focus:ring-lime/20" />
          </label>
        </div>

        <div role="tablist" aria-label="Filter project requests" className="flex flex-wrap gap-2">
          {filters.map((entry) => (
            <button key={entry.id} type="button" role="tab" aria-selected={filter === entry.id} onClick={() => setFilter(entry.id)} className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition ${filter === entry.id ? "border-lime/40 bg-lime/10 text-lime" : "border-border bg-card/60 text-muted-foreground hover:border-lime/30 hover:text-foreground"}`}>
              {entry.label}
              <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[11px] tabular-nums">
                {entry.id === "all" ? requests.length : counts[entry.id]}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div role="status" className="flex items-center gap-3 rounded-2xl border border-border bg-card/50 p-5 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-4 animate-spin text-lime" /> Loading project requests…</div>
        ) : visibleRequests.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/30 px-5 py-12 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-lime/20 bg-lime/10 text-lime"><FileText aria-hidden="true" className="size-5" /></div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{query ? "No matching requests" : filter === "pending" ? "You're all caught up" : "Nothing to show yet"}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{query ? "Try a different search term." : filter === "pending" ? "New payment-verified requests will appear here when they arrive." : "Requests that match this filter will appear here."}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleRequests.map((request) => {
              const isBusy = busyRequestRef === request.requestRef
              const draft = messageDrafts[request.requestRef] ?? ""
              return (
                <article key={request.requestRef} className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_12px_48px_rgba(0,0,0,0.12)]">
                  <div className="flex flex-col gap-4 border-b border-border bg-muted/20 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Request #{request.id}</span>
                        <ReviewBadge status={request.reviewStatus} />
                      </div>
                      <h3 className="mt-2 break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{request.projectName}</h3>
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden="true" className="size-3.5" /> {formatDate(request.createdAt)}</span>
                        <span className="font-mono">Ref {request.requestRef.slice(0, 8)}</span>
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-sm font-semibold text-emerald-200">
                      <Banknote aria-hidden="true" className="size-4" /> Paid {formatMoney(request.paymentAmountPaise)}
                    </span>
                  </div>

                  <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.7fr)]">
                    <div className="min-w-0 space-y-4">
                      <div className="rounded-2xl border border-border bg-background/50 p-4">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground"><FileText aria-hidden="true" className="size-4 text-lime" /> Project brief</h4>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{request.description}</p>
                      </div>
                      {request.reviewStatus !== "pending" && request.ownerMessage ? (
                        <div className="rounded-2xl border border-lime/20 bg-lime/[0.06] p-4">
                          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground"><MessageSquareText aria-hidden="true" className="size-4 text-lime" /> Message sent to user</h4>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{request.ownerMessage}</p>
                        </div>
                      ) : null}
                    </div>

                    <aside className="min-w-0 space-y-4">
                      <div className="rounded-2xl border border-border bg-background/50 p-4">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground"><UserRound aria-hidden="true" className="size-4 text-lime" /> Requester</h4>
                        <p className="mt-2 break-words text-sm font-medium text-foreground">{request.userName || "Name not provided"}</p>
                        <p className="mt-1 flex items-start gap-2 break-all text-sm text-muted-foreground"><Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {request.userEmail || "Account email unavailable"}</p>
                        {request.contactEmail && request.contactEmail !== request.userEmail ? <p className="mt-2 flex items-start gap-2 break-all text-sm text-muted-foreground"><Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {request.contactEmail}</p> : null}
                        {request.whatsappNumber ? <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground"><Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {request.whatsappNumber}</p> : null}
                        {request.telegramId ? <p className="mt-2 flex items-start gap-2 break-all text-sm text-muted-foreground"><Send aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {request.telegramId}</p> : null}
                      </div>
                      <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-background/50 p-4 text-sm">
                        {request.preferredLanguage ? <div><dt className="text-xs text-muted-foreground">Language</dt><dd className="mt-1 break-words font-medium text-foreground">{request.preferredLanguage}</dd></div> : null}
                        {request.desiredDuration ? <div><dt className="text-xs text-muted-foreground">Target timing</dt><dd className="mt-1 break-words font-medium text-foreground">{request.desiredDuration}</dd></div> : null}
                      </dl>
                    </aside>
                  </div>

                  {request.reviewStatus === "pending" ? (
                    <div className="border-t border-border bg-muted/15 p-4 sm:p-5">
                      <label className="block text-sm font-semibold text-foreground" htmlFor={`owner-message-${request.requestRef}`}>Message for the user <span className="font-normal text-muted-foreground">· required to accept, optional to decline</span></label>
                      <textarea id={`owner-message-${request.requestRef}`} value={draft} maxLength={2000} onChange={(event) => {
                        setMessageDrafts((current) => ({ ...current, [request.requestRef]: event.target.value }))
                        setValidationErrors((current) => ({ ...current, [request.requestRef]: "" }))
                      }} rows={3} placeholder="Share next steps, scope questions, or a brief explanation…" className="mt-2 w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-lime focus:ring-2 focus:ring-lime/20" aria-describedby={`owner-message-help-${request.requestRef}`} />
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span id={`owner-message-help-${request.requestRef}`}>The user will see this in their private Process page.</span>
                        <span className="tabular-nums">{draft.length}/2000</span>
                      </div>
                      {validationErrors[request.requestRef] ? <p role="alert" className="mt-2 text-sm text-rose-300">{validationErrors[request.requestRef]}</p> : null}
                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        <button type="button" onClick={() => void handleReview(request, "rejected")} disabled={isBusy} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-400/25 bg-rose-400/[0.06] px-4 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/[0.12] disabled:cursor-wait disabled:opacity-60">
                          {isBusy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <XCircle aria-hidden="true" className="size-4" />} Decline
                        </button>
                        <button type="button" onClick={() => void handleReview(request, "accepted")} disabled={isBusy} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-lime px-4 text-sm font-bold text-charcoal transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60">
                          {isBusy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />} Accept &amp; send message
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
                      <span className="inline-flex items-center gap-1.5"><BadgeCheck aria-hidden="true" className="size-4 text-lime" /> Reviewed {request.reviewedAt ? formatDate(request.reviewedAt) : ""}</span>
                      <Link href="/owner/project-requests/history" className="font-semibold text-lime underline-offset-4 hover:underline">View in request history</Link>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
