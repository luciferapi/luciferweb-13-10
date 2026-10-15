"use client"

import { useEffect, useState } from "react"
import {
  BadgeCheck,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock3,
  LoaderCircle,
  MessageSquareText,
  ReceiptText,
} from "lucide-react"

type ProjectRequest = {
  requestRef: string
  projectName: string
  description: string
  paymentAmountPaise: number
  paymentStatus: string
  status: string
  reviewStatus: "pending" | "accepted" | "rejected"
  ownerMessage: string | null
  reviewedAt: string | null
  createdAt: string
}

function isProjectRequest(value: unknown): value is ProjectRequest {
  if (typeof value !== "object" || value === null) return false
  const request = value as Record<string, unknown>
  return typeof request.requestRef === "string" &&
    typeof request.projectName === "string" &&
    typeof request.description === "string" &&
    typeof request.paymentAmountPaise === "number" && Number.isSafeInteger(request.paymentAmountPaise) &&
    typeof request.paymentStatus === "string" &&
    typeof request.status === "string" &&
    (request.reviewStatus === "pending" || request.reviewStatus === "accepted" || request.reviewStatus === "rejected") &&
    (typeof request.ownerMessage === "string" || request.ownerMessage === null) &&
    (typeof request.reviewedAt === "string" || request.reviewedAt === null) &&
    typeof request.createdAt === "string"
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function formatStatus(request: ProjectRequest) {
  if (request.paymentStatus === "paid") {
    if (request.reviewStatus === "accepted") {
      return { label: "Accepted", detail: "The owner accepted your project request.", className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300", icon: CircleCheck }
    }
    if (request.reviewStatus === "rejected") {
      return { label: "Declined", detail: "The owner reviewed your request and could not take it on.", className: "border-rose-400/25 bg-rose-400/10 text-rose-300", icon: CircleX }
    }
    return { label: "In review", detail: "Your payment is confirmed. The owner is reviewing your brief.", className: "border-amber-400/25 bg-amber-400/10 text-amber-200", icon: Clock3 }
  }

  if (request.paymentStatus === "pending") {
    return { label: "Payment pending", detail: "Complete payment to send your request for review.", className: "border-amber-400/25 bg-amber-400/10 text-amber-200", icon: Clock3 }
  }
  if (request.paymentStatus === "failed" || request.paymentStatus === "cancelled") {
    return { label: request.paymentStatus === "cancelled" ? "Payment cancelled" : "Payment failed", detail: "This request was not sent for owner review.", className: "border-rose-400/25 bg-rose-400/10 text-rose-300", icon: CircleAlert }
  }
  return { label: request.paymentStatus.charAt(0).toUpperCase() + request.paymentStatus.slice(1), detail: "Your request status is being updated.", className: "border-border bg-muted/50 text-muted-foreground", icon: BadgeCheck }
}

export function ProjectRequestHistory() {
  const [requests, setRequests] = useState<ProjectRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    void fetch("/api/project-requests/history", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result: unknown = await response.json().catch(() => null)
        if (response.status === 401) {
          setSignedIn(false)
          return
        }
        if (!response.ok || typeof result !== "object" || result === null || !("requests" in result) || !Array.isArray(result.requests) || !result.requests.every(isProjectRequest)) {
          throw new Error(typeof result === "object" && result !== null && "error" in result && typeof result.error === "string" ? result.error : "Could not load your previous requests.")
        }
        setRequests(result.requests)
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return
        console.error("Could not load previous project requests.", caught)
        setError(caught instanceof Error ? caught.message : "Could not load your previous requests.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  return (
    <section aria-labelledby="previous-requests-heading" className="home-brand-theme border-t border-border pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-lime">Your workspace · Private updates</p>
          <h2 id="previous-requests-heading" className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">Your project requests</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Track payment and review progress here. When the owner responds, their message will appear directly on your request.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground dark:bg-white/[0.02]"><ReceiptText aria-hidden="true" className="size-3.5" /> {requests.length} {requests.length === 1 ? "request" : "requests"}</span>
      </div>

      {loading ? (
        <div role="status" className="mt-6 flex items-center gap-2 rounded-2xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-4 animate-spin text-lime" /> Loading your request history…</div>
      ) : error ? (
        <p role="alert" className="mt-6 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-5 text-sm leading-6 text-rose-200">{error}</p>
      ) : !signedIn ? (
        <p className="mt-6 rounded-2xl border border-border bg-muted/30 p-5 text-sm leading-6 text-muted-foreground">Sign in to view your project requests and owner messages.</p>
      ) : requests.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-border bg-muted/20 p-6 text-sm leading-6 text-muted-foreground">No requests yet. After you submit a project request, payment and owner updates will appear here.</div>
      ) : (
        <div className="mt-6 grid gap-4">
          {requests.map((request) => {
            const status = formatStatus(request)
            const StatusIcon = status.icon
            return (
              <article key={request.requestRef} className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_14px_50px_rgba(0,0,0,0.12)]">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-muted/20 p-5 sm:p-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-lg font-semibold text-foreground sm:text-xl">{request.projectName}</h3>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}><StatusIcon aria-hidden="true" className="size-3.5" /> {status.label}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Submitted {formatDate(request.createdAt)} · Request #{request.requestRef.slice(0, 8)}</p>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">₹{(request.paymentAmountPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="p-5 sm:p-6">
                  <p className="text-sm leading-6 text-muted-foreground">{status.detail}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/80">{request.description}</p>
                  {request.ownerMessage ? (
                    <section aria-label="Message from the owner" className="mt-5 rounded-2xl border border-lime/25 bg-lime/[0.06] p-4 sm:p-5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><MessageSquareText aria-hidden="true" className="size-4 text-lime" /> Message from the owner</div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/85">{request.ownerMessage}</p>
                      {request.reviewedAt ? <p className="mt-3 text-xs text-muted-foreground">Updated {formatDate(request.reviewedAt)}</p> : null}
                    </section>
                  ) : request.paymentStatus === "paid" && request.reviewStatus === "pending" ? (
                    <p className="mt-5 flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100"><Clock3 aria-hidden="true" className="size-4 shrink-0" /> Your brief is waiting for the owner’s review. This page will show the response when it is ready.</p>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
