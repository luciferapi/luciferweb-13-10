"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, CircleAlert, Clock3, LoaderCircle, ReceiptText } from "lucide-react"

type ProjectRequest = {
  requestRef: string
  projectName: string
  description: string
  paymentAmountPaise: number
  paymentStatus: string
  status: string
  createdAt: string
}

function isProjectRequest(value: unknown): value is ProjectRequest {
  return typeof value === "object" && value !== null &&
    "requestRef" in value && typeof value.requestRef === "string" &&
    "projectName" in value && typeof value.projectName === "string" &&
    "description" in value && typeof value.description === "string" &&
    "paymentAmountPaise" in value && typeof value.paymentAmountPaise === "number" && Number.isSafeInteger(value.paymentAmountPaise) &&
    "paymentStatus" in value && typeof value.paymentStatus === "string" &&
    "status" in value && typeof value.status === "string" &&
    "createdAt" in value && typeof value.createdAt === "string"
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function formatStatus(request: ProjectRequest) {
  if (request.paymentStatus === "paid") return { label: "Submitted", className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300", icon: CheckCircle2 }
  if (request.paymentStatus === "pending") return { label: "Payment pending", className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300", icon: Clock3 }
  return { label: request.paymentStatus.charAt(0).toUpperCase() + request.paymentStatus.slice(1), className: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300", icon: CircleAlert }
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
    <section aria-labelledby="previous-requests-heading" className="border-t border-border pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-lime dark:text-lime">Your workspace</p>
          <h2 id="previous-requests-heading" className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">Previous project requests</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Review every request submitted from your account. This history is private to you.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground dark:bg-white/[0.02]"><ReceiptText aria-hidden="true" className="size-3.5" /> {requests.length} {requests.length === 1 ? "request" : "requests"}</span>
      </div>

      {loading ? (
        <div role="status" className="mt-6 flex items-center gap-2 rounded-2xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Loading your request history…</div>
      ) : error ? (
        <p role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>
      ) : !signedIn ? (
        <p className="mt-6 rounded-2xl border border-border bg-muted/30 p-5 text-sm leading-6 text-muted-foreground">Sign in to view your previous project requests.</p>
      ) : requests.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-sm leading-6 text-muted-foreground">No previous requests yet. Your first request will appear here after you submit it.</div>
      ) : (
        <div className="mt-6 grid gap-4">
          {requests.map((request) => {
            const status = formatStatus(request)
            const StatusIcon = status.icon
            return (
              <article key={request.requestRef} className="rounded-2xl border border-border bg-muted/30 p-5 transition hover:border-lime/40 dark:bg-white/[0.02]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground sm:text-lg">{request.projectName}</h3>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}><StatusIcon aria-hidden="true" className="size-3.5" /> {status.label}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{formatDate(request.createdAt)} · Request #{request.requestRef.slice(0, 8)}</p>
                  </div>
                  <span className="font-mono text-sm font-semibold tabular-nums text-foreground">₹{(request.paymentAmountPaise / 100).toLocaleString("en-IN")}</span>
                </div>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{request.description}</p>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
