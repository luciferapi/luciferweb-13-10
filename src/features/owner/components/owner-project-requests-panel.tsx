"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

type ProjectRequest = {
  id: number
  projectName: string
  description: string
  contactEmail: string | null
  whatsappNumber: string | null
  telegramId: string | null
  preferredLanguage: string | null
  desiredDuration: string | null
  paymentAmountPaise: number
  createdAt: string
}

function parseRequests(value: unknown): ProjectRequest[] {
  if (typeof value !== "object" || value === null || !("requests" in value) || !Array.isArray(value.requests)) {
    throw new Error("The project request response was invalid.")
  }

  return value.requests.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error("The project request response was invalid.")
    }
    const request = entry as Partial<ProjectRequest>
    if (
      typeof request.id !== "number" ||
      typeof request.projectName !== "string" ||
      typeof request.description !== "string" ||
      typeof request.paymentAmountPaise !== "number" ||
      typeof request.createdAt !== "string"
    ) {
      throw new Error("The project request response was invalid.")
    }
    return {
      id: request.id,
      projectName: request.projectName,
      description: request.description,
      contactEmail: typeof request.contactEmail === "string" ? request.contactEmail : null,
      whatsappNumber: typeof request.whatsappNumber === "string" ? request.whatsappNumber : null,
      telegramId: typeof request.telegramId === "string" ? request.telegramId : null,
      preferredLanguage: typeof request.preferredLanguage === "string" ? request.preferredLanguage : null,
      desiredDuration: typeof request.desiredDuration === "string" ? request.desiredDuration : null,
      paymentAmountPaise: request.paymentAmountPaise,
      createdAt: request.createdAt,
    }
  })
}

export function OwnerProjectRequestsPanel() {
  const [requests, setRequests] = useState<ProjectRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()

    async function loadRequests() {
      try {
        const response = await fetch("/api/owner/project-requests", {
          cache: "no-store",
          signal: controller.signal,
        })
        const result: unknown = await response.json().catch(() => null)
        if (!response.ok) {
          const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "Could not load project requests."
          throw new Error(message)
        }
        setRequests(parseRequests(result))
      } catch (caught) {
        if (controller.signal.aborted) return
        console.error("Could not load paid project requests.", caught)
        setError(caught instanceof Error ? caught.message : "Could not load project requests.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadRequests()
    return () => controller.abort()
  }, [])

  return (
    <div className="owner-projects space-y-8">
      <section className="rounded-xl border border-border bg-card/30 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">Owner workspace</p>
            <h2 className="mt-2 text-xl font-bold">Paid project requests</h2>
            <p className="mt-2 text-sm text-muted-foreground">Showing up to 100 payment-verified submissions from the project request database.</p>
          </div>
          <Link href="/owner/project-requests/history" className="text-sm font-medium text-cyan-700 underline underline-offset-4 hover:text-cyan-600 dark:text-cyan-200 dark:hover:text-cyan-100">
            Roadmap workflow status
          </Link>
        </div>

        {error ? <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-200">{error}</p> : null}
        {loading ? <p role="status" className="mt-5 text-sm text-muted-foreground">Loading paid requests…</p> : null}
        {!loading && !error && requests.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">No paid project requests have been recorded.</p> : null}

        <div className="mt-5 space-y-4">
          {requests.map((request) => (
            <article key={request.id} className="rounded-xl border border-border bg-background/50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Request #{request.id}</p>
                  <h3 className="mt-1 text-lg font-semibold">{request.projectName}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.createdAt))}
                  </p>
                </div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Paid · ₹{(request.paymentAmountPaise / 100).toFixed(2)}
                </p>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{request.description}</p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                {request.contactEmail ? <div><dt className="font-medium">Contact email</dt><dd className="break-all text-muted-foreground">{request.contactEmail}</dd></div> : null}
                {request.whatsappNumber ? <div><dt className="font-medium">WhatsApp</dt><dd className="text-muted-foreground">{request.whatsappNumber}</dd></div> : null}
                {request.telegramId ? <div><dt className="font-medium">Telegram</dt><dd className="text-muted-foreground">{request.telegramId}</dd></div> : null}
                {request.preferredLanguage ? <div><dt className="font-medium">Preferred language</dt><dd className="text-muted-foreground">{request.preferredLanguage}</dd></div> : null}
                {request.desiredDuration ? <div><dt className="font-medium">Desired duration</dt><dd className="text-muted-foreground">{request.desiredDuration}</dd></div> : null}
              </dl>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
