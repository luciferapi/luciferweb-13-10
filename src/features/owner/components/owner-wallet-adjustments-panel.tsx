"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { ChevronLeft, ChevronRight, CircleDollarSign, LoaderCircle, RefreshCw, Search, X } from "lucide-react"
import type { OwnerWalletUser } from "@/features/owner/server/owner-wallet"

type WalletUsersResult = {
  users: OwnerWalletUser[]
  total: number
  page: number
  pageSize: number
}

function isWalletUser(value: unknown): value is OwnerWalletUser {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "string" &&
    "publicUid" in value && typeof value.publicUid === "string" &&
    "name" in value && typeof value.name === "string" &&
    "email" in value && (typeof value.email === "string" || value.email === null) &&
    "walletBalancePaise" in value && typeof value.walletBalancePaise === "number" && Number.isSafeInteger(value.walletBalancePaise)
}

function isWalletUsersResult(value: unknown): value is WalletUsersResult {
  return typeof value === "object" && value !== null &&
    "users" in value && Array.isArray(value.users) && value.users.every(isWalletUser) &&
    "total" in value && typeof value.total === "number" &&
    "page" in value && typeof value.page === "number" &&
    "pageSize" in value && typeof value.pageSize === "number"
}

function getErrorMessage(value: unknown) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
    ? value.error
    : "Could not load wallet balances."
}

function formatInr(amountPaise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amountPaise / 100)
}

export function OwnerWalletAdjustmentsPanel({ onWalletChanged }: { onWalletChanged: () => Promise<void> }) {
  const [data, setData] = useState<WalletUsersResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [walletUser, setWalletUser] = useState<OwnerWalletUser | null>(null)
  const [saving, setSaving] = useState(false)

  const loadUsers = useCallback(async (signal?: AbortSignal) => {
    setError("")
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set("search", search)
    const response = await fetch(`/api/owner/wallet/users?${params}`, { cache: "no-store", signal })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok || !isWalletUsersResult(result)) throw new Error(getErrorMessage(result))
    setData(result)
  }, [page, search])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    loadUsers(controller.signal)
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return
        console.error("Could not load owner wallet user balances.", caught)
        setError(caught instanceof Error ? caught.message : "Could not load wallet balances.")
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [loadUsers])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  async function adjustWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!walletUser) return
    const formData = new FormData(event.currentTarget)
    const amount = Number(formData.get("amount"))
    const reason = String(formData.get("reason") ?? "").trim()
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
      setError("Enter a wallet adjustment amount between ₹0.01 and ₹10,000,000.")
      return
    }
    const amountPaise = Math.round(amount * 100)
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 1 || reason.length < 3 || reason.length > 500) {
      setError("Enter a valid amount and a reason of 3 to 500 characters.")
      return
    }

    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/owner/wallet/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: walletUser.id,
          direction: String(formData.get("direction")),
          amountPaise,
          reason,
        }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(getErrorMessage(result))
      setWalletUser(null)
      await loadUsers()
      await onWalletChanged()
    } catch (caught) {
      console.error("Could not adjust user wallet.", caught)
      setError(caught instanceof Error ? caught.message : "Could not adjust the user wallet.")
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 25)))

  return (
    <section className="owner-users-panel" aria-label="Wallet user balances and adjustments">
      <div className="owner-users-toolbar">
        <form onSubmit={submitSearch} className="owner-users-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Search wallet users"
            placeholder="Search name, email, or public ID"
            value={searchInput}
            maxLength={80}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit">Search</button>
        </form>
        <button type="button" className="owner-users-refresh" onClick={() => void loadUsers()} disabled={loading} aria-label="Refresh wallet user balances">
          {loading ? <LoaderCircle size={16} className="owner-users-spinner" /> : <RefreshCw size={16} />}
          Refresh
        </button>
      </div>

      {error ? <p role="alert" className="owner-users-error">{error}</p> : null}

      <div className="owner-users-table-wrap">
        <table className="owner-users-table">
          <thead><tr><th>User</th><th>Public ID</th><th>Available balance</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="owner-users-empty"><LoaderCircle size={18} className="owner-users-spinner" /> Loading wallet balances…</td></tr>
            ) : data?.users.length ? data.users.map((user) => (
              <tr key={user.id}>
                <td><strong className="owner-users-name">{user.name}</strong><span className="owner-users-sub">{user.email ?? "No email"}</span></td>
                <td><code className="owner-users-uid">{user.publicUid}</code></td>
                <td><strong className="owner-users-wallet">{formatInr(user.walletBalancePaise)}</strong></td>
                <td>
                  <button type="button" className="owner-users-wallet-edit" onClick={() => { setError(""); setWalletUser(user) }}>
                    <CircleDollarSign size={13} aria-hidden="true" /> Adjust
                  </button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="owner-users-empty">No users match this search.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="owner-users-pagination">
        <span>{data?.total ? `Showing ${(page - 1) * (data?.pageSize ?? 25) + 1}–${Math.min(page * (data?.pageSize ?? 25), data.total)} of ${data.total}` : "No user records"}</span>
        <div>
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} aria-label="Previous page">
            <ChevronLeft size={16} aria-hidden="true" /> Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading} aria-label="Next page">
            Next <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {walletUser ? (
        <div className="owner-users-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setWalletUser(null)
        }}>
          <section className="owner-users-modal" role="dialog" aria-modal="true" aria-labelledby="owner-adjust-wallet-title">
            <div className="owner-users-modal-heading">
              <div>
                <p>WALLET / {walletUser.publicUid}</p>
                <h2 id="owner-adjust-wallet-title">Adjust wallet balance</h2>
                <span className="owner-users-wallet-current">Current available balance: {formatInr(walletUser.walletBalancePaise)}</span>
              </div>
              <button type="button" onClick={() => setWalletUser(null)} disabled={saving} aria-label="Close wallet adjustment dialog"><X size={18} /></button>
            </div>
            <form onSubmit={(event) => void adjustWallet(event)}>
              <label>Adjustment type
                <select name="direction" required defaultValue="credit">
                  <option value="credit">Credit — add funds</option>
                  <option value="debit">Debit — remove funds</option>
                </select>
              </label>
              <label>Amount (INR)
                <input name="amount" type="number" required min="0.01" max="10000000" step="0.01" inputMode="decimal" placeholder="0.00" />
              </label>
              <label className="owner-users-wallet-reason">Reason for adjustment
                <textarea name="reason" required minLength={3} maxLength={500} rows={3} placeholder="Explain why this adjustment is required" />
              </label>
              <p className="owner-users-edit-note">Each adjustment is recorded with its reason and owner audit details. Debit cannot exceed the available balance.</p>
              <div className="owner-users-modal-actions">
                <button type="button" onClick={() => setWalletUser(null)} disabled={saving}>Cancel</button>
                <button type="submit" disabled={saving}>
                  {saving ? <LoaderCircle size={15} className="owner-users-spinner" /> : null}
                  Save wallet adjustment
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  )
}
