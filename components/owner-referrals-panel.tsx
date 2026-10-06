"use client"

import { useCallback, useEffect, useState } from "react"
import { LoaderCircle, Save, Users } from "lucide-react"
import { isReferralEntry, isReferralProgram, type ReferralEntry, type ReferralProgram, type ReferralStatus } from "@/lib/referral-types"

function formatDateTimeLocal(value: string) {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function OwnerReferralsPanel() {
  const [referrals, setReferrals] = useState<ReferralEntry[]>([])
  const [program, setProgram] = useState<ReferralProgram | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState("")
  const [savingProgram, setSavingProgram] = useState(false)
  const [error, setError] = useState("")
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({})

  const loadReferrals = useCallback(async (signal?: AbortSignal) => {
    setError("")
    const response = await fetch("/api/owner/referrals", { cache: "no-store", signal })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok || typeof result !== "object" || result === null || !("referrals" in result) || !Array.isArray(result.referrals) || !result.referrals.every(isReferralEntry) || !("program" in result) || !isReferralProgram(result.program)) {
      const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
        ? result.error
        : "Could not load referral records."
      throw new Error(message)
    }
    setReferrals(result.referrals as ReferralEntry[])
    setProgram(result.program)
    setReasonDrafts(Object.fromEntries(
      (result.referrals as ReferralEntry[]).map((referral) => [referral.id, referral.statusReason ?? ""]),
    ))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadReferrals(controller.signal)
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return
        console.error("Could not load referral records.", caught)
        setError(caught instanceof Error ? caught.message : "Could not load referral records.")
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [loadReferrals])

  async function changeStatus(id: string, status: ReferralStatus) {
    const enteredReason = reasonDrafts[id]?.trim()
    if (status === "rejected" && (!enteredReason || enteredReason === "Awaiting manual review")) {
      setError("Add a specific review reason before rejecting this referral.")
      return
    }

    setBusyId(id)
    setError("")
    try {
      const response = await fetch("/api/owner/referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-status",
          id,
          status,
          reason: enteredReason && enteredReason !== "Awaiting manual review"
            ? enteredReason
            : status === "pending"
              ? "Awaiting manual review"
              : null,
        }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error
          : "Could not update referral status."
        throw new Error(message)
      }
      await loadReferrals()
    } catch (caught) {
      console.error("Could not update referral status.", caught)
      setError(caught instanceof Error ? caught.message : "Could not update referral status.")
    } finally {
      setBusyId("")
    }
  }

  async function saveProgram(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!program) return
    setSavingProgram(true)
    setError("")
    try {
      const formData = new FormData(event.currentTarget)
      const validUntilInput = String(formData.get("validUntil") ?? "")
      const validUntilDate = validUntilInput ? new Date(validUntilInput) : null
      if (validUntilDate && Number.isNaN(validUntilDate.getTime())) throw new Error("Enter a valid program expiry.")
      const minPurchaseValue = String(formData.get("minPurchaseAmount") ?? "")
      const maxReferralsValue = String(formData.get("maxReferrals") ?? "")
      const updatedProgram: ReferralProgram = {
        ...program,
        conditions: {
          minPurchaseAmount: minPurchaseValue ? Number(minPurchaseValue) : null,
          validUntil: validUntilDate?.toISOString() ?? null,
          maxReferrals: maxReferralsValue ? Number(maxReferralsValue) : null,
        },
      }
      const response = await fetch("/api/owner/referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-program", program: updatedProgram }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error
          : "Could not save the referral program."
        throw new Error(message)
      }
      setProgram(updatedProgram)
    } catch (caught) {
      console.error("Could not save the referral program.", caught)
      setError(caught instanceof Error ? caught.message : "Could not save the referral program.")
    } finally {
      setSavingProgram(false)
    }
  }

  function updateReward(side: "referrerReward" | "refereeReward", field: "type" | "amount" | "currency", value: string) {
    setProgram((current) => current ? {
      ...current,
      [side]: {
        ...current[side],
        [field]: field === "amount" ? Number(value) : field === "type" ? (value === "percentage" ? "percentage" : "fixed") : value.toUpperCase(),
      },
    } : current)
  }

  return (
    <section className="mx-auto max-w-6xl px-6 pb-16" aria-labelledby="referral-review-title">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-700 dark:text-cyan-200"><Users aria-hidden="true" size={19} /></span>
          <div>
            <h2 id="referral-review-title" className="text-lg font-bold">Referral review</h2>
            <p className="mt-1 text-sm text-muted-foreground">Review new referral signups and mark them active or rejected. Status tracking does not issue rewards.</p>
          </div>
        </div>
        {loading ? <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading referrals...</p> : null}
        {error ? <p className="mt-5 text-sm text-rose-600 dark:text-rose-300" role="alert">{error}</p> : null}
        {program ? (
          <form onSubmit={(event) => void saveProgram(event)} className="mt-5 rounded-xl border border-border bg-background/70 p-4">
            <h3 className="text-sm font-bold">Reward rules</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Set the reward terms shown to users. Minimum purchase is manually reviewed; this app does not automatically issue payouts.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {([
                ["referrerReward", "Reward for referrer"],
                ["refereeReward", "Reward for invited user"],
              ] as const).map(([side, label]) => (
                <fieldset key={side} className="grid gap-2 rounded-lg border border-border p-3">
                  <legend className="px-1 text-xs font-semibold">{label}</legend>
                  <div className="grid grid-cols-[1fr_1fr_5rem] gap-2">
                    <select aria-label={`${label} type`} value={program[side].type} onChange={(event) => updateReward(side, "type", event.target.value)} className="h-10 min-w-0 rounded-md border border-border bg-card px-2 text-xs">
                      <option value="fixed">Fixed</option><option value="percentage">Percent</option>
                    </select>
                    <input aria-label={`${label} amount`} type="number" min="0" max={program[side].type === "percentage" ? "100" : "1000000"} step="0.01" value={program[side].amount} onChange={(event) => updateReward(side, "amount", event.target.value)} className="h-10 min-w-0 rounded-md border border-border bg-card px-2 text-sm" />
                    <span className="flex h-10 items-center justify-center rounded-md border border-border bg-muted px-2 text-xs text-muted-foreground">
                      {program[side].type === "fixed" ? "INR ₹" : "%"}
                    </span>
                  </div>
                </fieldset>
              ))}
              <label className="space-y-1 text-xs font-medium">
                Minimum qualifying purchase (INR ₹)
                <input name="minPurchaseAmount" type="number" min="0" step="0.01" defaultValue={program.conditions.minPurchaseAmount ?? ""} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
              </label>
              <label className="space-y-1 text-xs font-medium">
                Program expiry
                <input name="validUntil" type="datetime-local" defaultValue={program.conditions.validUntil ? formatDateTimeLocal(program.conditions.validUntil) : ""} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
              </label>
              <label className="space-y-1 text-xs font-medium">
                Maximum referrals per user
                <input name="maxReferrals" type="number" min="1" step="1" defaultValue={program.conditions.maxReferrals ?? ""} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
              </label>
            </div>
            <button type="submit" disabled={savingProgram} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60">
              {savingProgram ? <LoaderCircle className="size-4 animate-spin" /> : <Save aria-hidden="true" size={16} />}
              {savingProgram ? "Saving..." : "Save reward rules"}
            </button>
          </form>
        ) : null}
        {!loading && referrals.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">No referrals have been recorded.</p> : null}
        {referrals.length > 0 ? (
          <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
            {referrals.map((referral) => (
              <li key={referral.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{referral.name}</span>
                  <span className="text-xs text-muted-foreground">{new Date(referral.createdAt).toLocaleString()}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold capitalize">{referral.status}</span>
                  <label className="sr-only" htmlFor={`referral-reason-${referral.id}`}>Review reason for {referral.name}</label>
                  <input
                    id={`referral-reason-${referral.id}`}
                    value={reasonDrafts[referral.id] ?? ""}
                    onChange={(event) => setReasonDrafts((current) => ({ ...current, [referral.id]: event.target.value }))}
                    maxLength={500}
                    placeholder="Review reason"
                    className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs sm:w-48"
                  />
                  {(["pending", "active", "rejected"] as const).map((status) => (
                    <button key={status} type="button" disabled={busyId === referral.id || referral.status === status} onClick={() => void changeStatus(referral.id, status)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold capitalize transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45">
                      {busyId === referral.id ? "Saving..." : status}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
