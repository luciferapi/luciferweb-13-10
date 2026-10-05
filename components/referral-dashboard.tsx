"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Copy, LoaderCircle, Users } from "lucide-react"
import { isReferralEntry, isReferralProgram, type ReferralEntry, type ReferralProgram } from "@/lib/referral-types"

type ReferralData = {
  code: string
  referrals: ReferralEntry[]
  program: ReferralProgram
}

export function ReferralDashboard() {
  const [data, setData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState("")

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
        setData({ code: result.code, referrals: result.referrals, program: result.program })
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return
        console.error("Could not load referral data.", caught)
        setError(caught instanceof Error ? caught.message : "Could not load your referrals right now.")
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

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
    data.program.conditions.minPurchaseAmount === null ? null : `Minimum qualifying purchase: ${data.program.conditions.minPurchaseAmount.toFixed(2)}`,
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
                      {rule.type === "fixed" ? `${rule.amount.toFixed(2)} ${rule.currency}` : `${rule.amount}%`}
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
            {data.referrals.length ? (
              <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
                {data.referrals.map((referral) => (
                  <li key={referral.id} className="flex items-center justify-between gap-3 px-3 py-3 text-sm" style={{ paddingLeft: `${12 + Math.min(referral.depth, 8) * 18}px` }}>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{referral.name}</span>
                      <span className="text-xs text-muted-foreground">Level {referral.depth + 1} · {new Date(referral.createdAt).toLocaleDateString()}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${referral.status === "active" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : referral.status === "rejected" ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>{referral.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">No invites yet. Share your link to start your referral tree.</p>
            )}
          </div>
          {error ? <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
        </>
      ) : null}
    </div>
  )
}
