"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, Check, ClipboardCheck, Copy, LoaderCircle, Tv, Users, X } from "lucide-react"
import { isReferralEntry, isReferralProgram, type ReferralEntry, type ReferralProgram } from "@/lib/referral-types"

type ReferralData = {
  code: string
  name: string
  referrals: ReferralEntry[]
  program: ReferralProgram
}

const referralColors = [
  "bg-cyan-500",
  "bg-teal-400",
  "bg-slate-900 dark:bg-slate-700",
  "bg-sky-800",
  "bg-cyan-600",
  "bg-teal-600",
]

function ReferralNetworkDiagram({
  name,
  referrals,
  onSelect,
}: {
  name: string
  referrals: ReferralEntry[]
  onSelect: (referral: ReferralEntry) => void
}) {
  const rows = referrals.length ? referrals : Array.from({ length: 6 }, (_, index) => ({
    id: `empty-${index}`,
    name: "",
    status: "pending" as const,
    statusReason: null,
    depth: 0,
    createdAt: "",
    signupAt: "",
  }))
  const rowHeight = 112
  const height = rows.length * rowHeight + 24
  const rootY = height / 2
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")

  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-[#f4f9fb] p-3 dark:border-slate-700 dark:bg-slate-950/60 sm:p-5">
      <div className="relative min-w-[680px]" style={{ height }}>
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none">
          {rows.map((referral, index) => {
            const rowY = rowHeight / 2 + index * rowHeight + 12
            return (
              <g key={referral.id}>
                <path
                  d={`M 218 ${rootY} C 340 ${rootY}, 322 ${rowY}, 492 ${rowY}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={referral.name ? "text-slate-500 dark:text-slate-500" : "text-slate-300 dark:text-slate-700"}
                />
                <circle cx="492" cy={rowY} r="5" fill="currentColor" className={referral.name ? "text-slate-700 dark:text-slate-300" : "text-slate-300 dark:text-slate-600"} />
              </g>
            )
          })}
        </svg>

        <div
          className="absolute left-[5%] z-10 flex size-36 flex-col items-center justify-center rounded-full border-[9px] border-white bg-gradient-to-br from-white to-slate-100 text-center shadow-[0_14px_28px_rgba(15,23,42,0.22)] ring-1 ring-slate-200 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900 dark:ring-slate-600"
          style={{ top: rootY - 72 }}
        >
          <span className="grid size-11 place-items-center rounded-full bg-cyan-100 text-sm font-black text-cyan-900 dark:bg-cyan-300/15 dark:text-cyan-200">{initials || <Users aria-hidden="true" size={20} />}</span>
          <span className="mt-2 max-w-24 truncate text-xs font-bold text-slate-800 dark:text-slate-100">You</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Your network</span>
        </div>

        {rows.map((referral, index) => {
          const centerY = rowHeight / 2 + index * rowHeight + 12
          const isPlaceholder = !referral.name
          const color = referralColors[index % referralColors.length]
          const referralInitials = referral.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")
          return (
            <button
              type="button"
              aria-label={`View ${referral.name || "invite placeholder"} details`}
              onClick={() => {
                if (!isPlaceholder) onSelect(referral)
              }}
              key={referral.id}
              disabled={isPlaceholder}
              className="absolute left-[48%] right-0 z-10 flex h-[88px] items-center text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-4"
              style={{ top: centerY - 44 }}
            >
              <div className={`absolute left-0 z-20 grid size-[82px] place-items-center rounded-full border-[7px] border-white bg-gradient-to-br from-white to-slate-100 text-slate-400 shadow-[0_9px_18px_rgba(15,23,42,0.22)] ring-1 ring-slate-200 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900 dark:ring-slate-600 ${isPlaceholder ? "opacity-75" : ""}`}>
                <span className={`grid size-10 place-items-center rounded-full text-sm font-bold ${isPlaceholder ? "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400" : `${color} text-white`}`}>
                  {isPlaceholder ? <Users aria-hidden="true" size={18} /> : referralInitials}
                </span>
              </div>
              <div
                className={`ml-9 flex h-[72px] min-w-0 flex-1 items-center justify-between gap-2 pr-8 ${color} ${isPlaceholder ? "opacity-40" : ""}`}
                style={{ clipPath: "polygon(0 0, 91% 0, 100% 50%, 91% 100%, 0 100%)" }}
              >
                <span className="min-w-0 pl-[62px] pr-2">
                  <span className="block truncate text-sm font-bold text-white">
                    {isPlaceholder ? "Invite someone" : referral.name}
                  </span>
                  <span className="mt-1 block truncate text-[10px] font-medium text-white/75">
                    {isPlaceholder ? "Share your link to add a referral" : `Level ${referral.depth + 1} · ${new Date(referral.createdAt).toLocaleDateString()}`}
                  </span>
                </span>
                {!isPlaceholder ? (
                  <span className="mr-4 shrink-0 rounded-full bg-black/15 px-2 py-1 text-[10px] font-semibold capitalize text-white">
                    {referral.status}
                  </span>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ReferralDashboard() {
  const [data, setData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState("")
  const [selectedReferral, setSelectedReferral] = useState<ReferralEntry | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
    const controller = new AbortController()
    fetch("/api/referrals", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result: unknown = await response.json().catch(() => null)
        if (response.status === 401) {
          setError("Sign in to create an invite link and see your referrals.")
          return
        }
        if (!response.ok || typeof result !== "object" || result === null || !("code" in result) || typeof result.code !== "string" || !("referrals" in result) || !Array.isArray(result.referrals) || !result.referrals.every(isReferralEntry) || !("program" in result) || !isReferralProgram(result.program)) {
          const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "Could not load your referrals right now."
          throw new Error(message)
        }
        setData({
          code: result.code,
          name: "name" in result && typeof result.name === "string" ? result.name : "You",
          referrals: result.referrals,
          program: result.program,
        })
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return
        console.error("Could not load referral data.", caught)
        setError(caught instanceof Error ? caught.message : "Could not load your referrals right now.")
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!selectedReferral) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedReferral(null)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [selectedReferral])

  async function copyInviteLink() {
    if (!data) return
    const url = new URL("/?mode=signup", window.location.origin)
    url.searchParams.set("ref", data.code)
    try {
      await navigator.clipboard.writeText(url.toString())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (caught) {
      console.error("Could not copy the referral link.", caught)
      setError("Could not copy the link. Select and copy it manually.")
    }
  }

  const directReferrals = data?.referrals.filter((referral) => referral.depth === 0) ?? []
  const activeCount = directReferrals.filter((referral) => referral.status === "active").length
  const inviteLink = data && origin
    ? `${origin}/?mode=signup&ref=${encodeURIComponent(data.code)}`
    : ""
  const rewards = data ? [
    { label: "For you", rule: data.program.referrerReward },
    { label: "For your invite", rule: data.program.refereeReward },
  ] : []
  const conditions = data ? [
    data.program.conditions.minPurchaseAmount === null ? null : `Minimum qualifying purchase: ₹${data.program.conditions.minPurchaseAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    data.program.conditions.validUntil === null ? null : `Valid until ${new Date(data.program.conditions.validUntil).toLocaleDateString()}`,
    data.program.conditions.maxReferrals === null ? null : `Maximum ${data.program.conditions.maxReferrals} referrals per user`,
  ].filter((condition): condition is string => condition !== null) : []

  return (
    <div className="mt-8 rounded-2xl border border-border bg-background/70 p-5 sm:p-6">
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircle className="size-4 animate-spin" /> Loading referral dashboard...</p>
      ) : error && !data ? (
        <div>
          <p className="text-sm text-muted-foreground">{error}</p>
          {error.startsWith("Sign in") ? <Link href="/sign-in?next=%2Fpocket-money%2Freferrals" className="mt-4 inline-flex rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">Sign in</Link> : null}
        </div>
      ) : data ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your invite link</p>
              <p className="mt-1 font-mono text-lg font-bold tracking-wider">{data.code}</p>
            </div>
            <button type="button" onClick={() => void copyInviteLink()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
              {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
              {copied ? "Copied" : "Copy invite link"}
            </button>
          </div>
          <label className="mt-4 block text-xs text-muted-foreground">
            Share this with someone you know
            <input readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 font-mono text-xs text-foreground" />
          </label>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Direct invites</p><p className="mt-1 text-2xl font-bold">{directReferrals.length}</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Active</p><p className="mt-1 text-2xl font-bold">{activeCount}</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">People in your tree</p><p className="mt-1 text-2xl font-bold">{data.referrals.length}</p></div>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-bold">Program rewards</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {rewards.map(({ label, rule }) => {
                return (
                  <p key={label} className="text-sm text-muted-foreground">
                    {label}: <span className="font-semibold text-foreground">
                      {rule.type === "fixed" ? `₹${rule.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${rule.amount}%`}
                    </span>
                  </p>
                )
              })}
            </div>
            {conditions.length ? <ul className="mt-3 list-inside list-disc text-xs text-muted-foreground">{conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul> : null}
            <p className="mt-3 text-xs text-muted-foreground">Rewards are subject to manual review and are not automatically paid or credited.</p>
          </div>

          <div className="mt-6">
            <h3 className="flex items-center gap-2 text-sm font-bold"><Users aria-hidden="true" size={16} /> Referral tree</h3>
            <ReferralNetworkDiagram name={data.name} referrals={directReferrals} onSelect={setSelectedReferral} />
            {!directReferrals.length ? <p className="mt-3 text-center text-xs text-muted-foreground">Share your invite link to turn a branch into your first referral.</p> : null}
            {data.referrals.length > directReferrals.length ? (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Plus {data.referrals.length - directReferrals.length} more people across your extended referral tree.
              </p>
            ) : null}
          </div>
          {error ? <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
        </>
      ) : null}
      {selectedReferral ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedReferral(null)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="referral-detail-title"
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Referral details</p>
                <h2 id="referral-detail-title" className="mt-1 text-xl font-bold">{selectedReferral.name}</h2>
              </div>
              <button type="button" aria-label="Close referral details" onClick={() => setSelectedReferral(null)} className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground">
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <dl className="mt-5 space-y-4">
              <div className="flex gap-3">
                <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-cyan-700 dark:text-cyan-200" />
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">Account signup time</dt>
                  <dd className="mt-1 text-sm">{new Date(selectedReferral.signupAt).toLocaleString()}</dd>
                </div>
              </div>
              <div className="flex gap-3">
                <ClipboardCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-cyan-700 dark:text-cyan-200" />
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">Completed tasks</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">Not tracked yet</dd>
                </div>
              </div>
              <div className="flex gap-3">
                <Tv aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-cyan-700 dark:text-cyan-200" />
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">Completed ads</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">Not tracked yet</dd>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background/70 p-4">
                <dt className="text-xs font-semibold text-muted-foreground">Referral status</dt>
                <dd className="mt-1 text-sm font-semibold capitalize">{selectedReferral.status}</dd>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {selectedReferral.statusReason || (selectedReferral.status === "pending" ? "Awaiting manual review." : "No review note has been added.")}
                </p>
              </div>
            </dl>
          </section>
        </div>
      ) : null}
    </div>
  )
}
