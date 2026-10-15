"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  History,
  LoaderCircle,
  Mail,
  MessageSquareText,
  Search,
  UserRound,
  XCircle,
} from "lucide-react"
import {
  parseOwnerProjectRequests,
  type OwnerProjectRequest,
  type ProjectRequestReviewStatus,
} from "@/features/projects/project-request-types"

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function badgeClass(status: ProjectRequestReviewStatus) {
  return status === "accepted"
    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
    : status === "rejected"
      ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
      : "border-amber-400/25 bg-amber-400/10 text-amber-200"
}

export function OwnerProjectRequestsHistoryPage() {
  const [requests, setRequests] = useState<OwnerProjectRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "accepted" | "rejected">("all")

  useEffect(() => {
    const controller = new AbortController()
    void fetch("/api/owner/project-requests", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result: unknown = await response.json().catch(() => null)
        if (!response.ok) {
          const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "Could not load request history."
          throw new Error(message)
        }
        setRequests(parseOwnerProjectRequests(result))
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return
        console.error("Could not load owner project request history.", caught)
        setError(caught instanceof Error ? caught.message : "Could not load request history.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const completed = useMemo(() => requests.filter((request) => request.reviewStatus !== "pending"), [requests])
  const acceptedCount = completed.filter((request) => request.reviewStatus === "accepted").length
  const rejectedCount = completed.filter((request) => request.reviewStatus === "rejected").length
  const visibleRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return completed
      .filter((request) => filter === "all" || request.reviewStatus === filter)
      .filter((request) => [request.projectName, request.userName, request.userEmail, request.ownerMessage ?? "", request.requestRef].join(" ").toLowerCase().includes(normalizedQuery))
      .sort((a, b) => new Date(b.reviewedAt ?? b.createdAt).getTime() - new Date(a.reviewedAt ?? a.createdAt).getTime())
  }, [completed, filter, query])

  return (
    <div className="home-brand-theme space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-lime/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-lime"><History aria-hidden="true" className="size-3.5" /> Owner workspace · Archive</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Project request history</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">A searchable record of accepted and declined project requests, including the message shown to each requester.</p>
          </div>
          <Link href="/owner/project-requests" className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl bg-lime px-4 text-sm font-semibold text-charcoal transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:self-auto">
            <ArrowLeft aria-hidden="true" className="size-4" /> Back to request inbox
          </Link>
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-emerald-300"><CheckCircle2 aria-hidden="true" className="size-4" /> Accepted</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{acceptedCount}</p>
          </div>
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-4">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-rose-300"><XCircle aria-hidden="true" className="size-4" /> Declined</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{rejectedCount}</p>
          </div>
        </div>
      </section>

      {error ? <p role="alert" className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      <section aria-labelledby="request-history-list-heading" className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="request-history-list-heading" className="text-xl font-semibold text-foreground">Reviewed requests</h2>
            <p className="mt-1 text-sm text-muted-foreground">{visibleRequests.length} {visibleRequests.length === 1 ? "decision" : "decisions"} shown</p>
          </div>
          <label className="relative block w-full lg:max-w-sm">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">Search request history</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project, user, or message" className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-lime focus:ring-2 focus:ring-lime/20" />
          </label>
        </div>

        <div role="tablist" aria-label="Filter reviewed requests" className="flex flex-wrap gap-2">
          {([
            ["all", "All decisions", completed.length],
            ["accepted", "Accepted", acceptedCount],
            ["rejected", "Declined", rejectedCount],
          ] as const).map(([id, label, count]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)} className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition ${filter === id ? "border-lime/40 bg-lime/10 text-lime" : "border-border bg-card/60 text-muted-foreground hover:border-lime/30 hover:text-foreground"}`}>
              {label}<span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[11px] tabular-nums">{count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div role="status" className="flex items-center gap-3 rounded-2xl border border-border bg-card/50 p-5 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-4 animate-spin text-lime" /> Loading request history…</div>
        ) : visibleRequests.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/30 px-5 py-12 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-lime/20 bg-lime/10 text-lime"><History aria-hidden="true" className="size-5" /></div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{query ? "No matching decisions" : "No reviewed requests yet"}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{query ? "Try another search term or filter." : "When a paid request is accepted or declined, it will appear here with its review message."}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleRequests.map((request) => {
              const accepted = request.reviewStatus === "accepted"
              const DecisionIcon = accepted ? CheckCircle2 : XCircle
              return (
                <article key={request.requestRef} className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_12px_48px_rgba(0,0,0,0.12)]">
                  <div className="flex flex-col gap-4 border-b border-border bg-muted/20 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(request.reviewStatus)}`}><DecisionIcon aria-hidden="true" className="size-3.5" /> {accepted ? "Accepted" : "Declined"}</span>
                        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Request #{request.id}</span>
                      </div>
                      <h3 className="mt-2 break-words text-xl font-semibold tracking-tight text-foreground">{request.projectName}</h3>
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden="true" className="size-3.5" /> Reviewed {request.reviewedAt ? formatDate(request.reviewedAt) : formatDate(request.createdAt)}</span>
                        <span className="font-mono">Ref {request.requestRef.slice(0, 8)}</span>
                      </p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm">
                      <p className="flex items-center gap-2 font-medium text-foreground"><UserRound aria-hidden="true" className="size-4 text-lime" /> {request.userName || "Requester"}</p>
                      <p className="mt-1 flex items-center gap-2 break-all text-xs text-muted-foreground"><Mail aria-hidden="true" className="size-3.5 shrink-0" /> {request.userEmail || "Account email unavailable"}</p>
                    </div>
                  </div>
                  <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project brief</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground/80">{request.description}</p>
                    </div>
                    <div className="rounded-2xl border border-lime/20 bg-lime/[0.05] p-4">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground"><MessageSquareText aria-hidden="true" className="size-4 text-lime" /> Message sent to user</h4>
                      {request.ownerMessage ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground/85">{request.ownerMessage}</p> : <p className="mt-2 text-sm leading-6 text-muted-foreground">No message was attached to this decision.</p>}
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><BadgeCheck aria-hidden="true" className="size-3.5" /> User can view this on their Process page</p>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
