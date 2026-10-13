"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { ChevronLeft, ChevronRight, CircleDollarSign, LoaderCircle, Pencil, RefreshCw, Search, Shield, ShieldBan, Trash2, X } from "lucide-react"
import type { OwnerUser } from "@/features/owner/server/owner-users"

type UserStatusFilter = "all" | "active" | "blocked"
type OwnerUsersResult = {
  users: OwnerUser[]
  total: number
  page: number
  pageSize: number
  stats: { total: number; active: number; blocked: number }
}

function isOwnerUser(value: unknown): value is OwnerUser {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "string" &&
    "publicUid" in value && typeof value.publicUid === "string" &&
    "name" in value && typeof value.name === "string" &&
    "email" in value && (typeof value.email === "string" || value.email === null) &&
    "dateOfBirth" in value && (typeof value.dateOfBirth === "string" || value.dateOfBirth === null) &&
    "telegramUsername" in value && (typeof value.telegramUsername === "string" || value.telegramUsername === null) &&
    "xUsername" in value && (typeof value.xUsername === "string" || value.xUsername === null) &&
    "nameEditUsed" in value && typeof value.nameEditUsed === "boolean" &&
    "dateOfBirthEditUsed" in value && typeof value.dateOfBirthEditUsed === "boolean" &&
    "isBlocked" in value && typeof value.isBlocked === "boolean" &&
    "blockedAt" in value && (typeof value.blockedAt === "string" || value.blockedAt === null) &&
    "createdAt" in value && typeof value.createdAt === "string" &&
    "providers" in value && Array.isArray(value.providers) && value.providers.every((provider) => typeof provider === "string") &&
    "isOwnerAdmin" in value && typeof value.isOwnerAdmin === "boolean" &&
    "walletBalancePaise" in value && typeof value.walletBalancePaise === "number" && Number.isSafeInteger(value.walletBalancePaise) &&
    "referrals" in value && Array.isArray(value.referrals) && value.referrals.every((referral) =>
      typeof referral === "object" && referral !== null &&
      "uid" in referral && typeof referral.uid === "string" &&
      "publicUid" in referral && typeof referral.publicUid === "string"
    )
}

function isOwnerUsersResult(value: unknown): value is OwnerUsersResult {
  return typeof value === "object" && value !== null &&
    "users" in value && Array.isArray(value.users) && value.users.every(isOwnerUser) &&
    "total" in value && typeof value.total === "number" &&
    "page" in value && typeof value.page === "number" &&
    "pageSize" in value && typeof value.pageSize === "number" &&
    "stats" in value && typeof value.stats === "object" && value.stats !== null &&
    "total" in value.stats && typeof value.stats.total === "number" &&
    "active" in value.stats && typeof value.stats.active === "number" &&
    "blocked" in value.stats && typeof value.stats.blocked === "number"
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function getErrorMessage(result: unknown, fallback: string) {
  return typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
    ? result.error
    : fallback
}

export function OwnerUsersPanel() {
  const [data, setData] = useState<OwnerUsersResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState("")
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<UserStatusFilter>("all")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [editingUser, setEditingUser] = useState<OwnerUser | null>(null)
  const [walletUser, setWalletUser] = useState<OwnerUser | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [savingWallet, setSavingWallet] = useState(false)

  const loadUsers = useCallback(async (signal?: AbortSignal) => {
    setError("")
    const params = new URLSearchParams({ page: String(page), status })
    if (search) params.set("search", search)
    const response = await fetch(`/api/owner/users?${params}`, { cache: "no-store", signal })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok || !isOwnerUsersResult(result)) throw new Error(getErrorMessage(result, "Could not load user records."))
    setData(result)
  }, [page, search, status])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    loadUsers(controller.signal)
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return
        console.error("Could not load owner user records.", caught)
        setError(caught instanceof Error ? caught.message : "Could not load user records.")
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [loadUsers])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  async function updateStatus(user: OwnerUser) {
    setBusyId(user.id)
    setError("")
    try {
      const response = await fetch("/api/owner/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-blocked", id: user.id, isBlocked: !user.isBlocked }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not update user status."))
      await loadUsers()
    } catch (caught) {
      console.error("Could not update user status.", caught)
      setError(caught instanceof Error ? caught.message : "Could not update user status.")
    } finally {
      setBusyId("")
    }
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingUser) return
    const formData = new FormData(event.currentTarget)
    setSavingEdit(true)
    setError("")
    try {
      const response = await fetch("/api/owner/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingUser.id,
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? "").trim().toLowerCase(),
          dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
          telegramUsername: String(formData.get("telegramUsername") ?? ""),
          xUsername: String(formData.get("xUsername") ?? ""),
        }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not save user details."))
      setEditingUser(null)
      await loadUsers()
    } catch (caught) {
      console.error("Could not save user details.", caught)
      setError(caught instanceof Error ? caught.message : "Could not save user details.")
    } finally {
      setSavingEdit(false)
    }
  }

  async function adjustWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!walletUser) return
    const formData = new FormData(event.currentTarget)
    const amount = Number(formData.get("amount"))
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
      setError("Enter a wallet adjustment amount between ₹0.01 and ₹10,000,000.")
      return
    }
    const amountPaise = Math.round(amount * 100)
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 1) {
      setError("Enter a valid wallet amount.")
      return
    }

    setSavingWallet(true)
    setError("")
    try {
      const response = await fetch("/api/owner/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: walletUser.id,
          direction: String(formData.get("direction")),
          amountPaise,
          reason: String(formData.get("reason") ?? ""),
        }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not adjust the user wallet."))
      setWalletUser(null)
      await loadUsers()
    } catch (caught) {
      console.error("Could not adjust user wallet.", caught)
      setError(caught instanceof Error ? caught.message : "Could not adjust the user wallet.")
    } finally {
      setSavingWallet(false)
    }
  }

  async function deleteUser(user: OwnerUser) {
    const confirmed = window.confirm(
      `Permanently delete ${user.name} (${user.publicUid})?\n\nThis removes their profile, sign-in access, wallet and payment history, purchases, referrals, and other linked records. This cannot be undone.`,
    )
    if (!confirmed) return

    setBusyId(user.id)
    setError("")
    try {
      const response = await fetch("/api/owner/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not delete user."))
      if (data?.users.length === 1 && page > 1) setPage((currentPage) => currentPage - 1)
      else await loadUsers()
    } catch (caught) {
      console.error("Could not delete user.", caught)
      setError(caught instanceof Error ? caught.message : "Could not delete user.")
    } finally {
      setBusyId("")
    }
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 25)))

  return (
    <section className="owner-users-panel" aria-label="User management">
      <div className="owner-users-stats">
        <article><span>Total users</span><strong>{data?.stats.total ?? "—"}</strong></article>
        <article><span>Active users</span><strong>{data?.stats.active ?? "—"}</strong></article>
        <article><span>Blocked users</span><strong>{data?.stats.blocked ?? "—"}</strong></article>
      </div>

      <div className="owner-users-toolbar">
        <form onSubmit={submitSearch} className="owner-users-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Search users"
            placeholder="Search name, email, or public ID"
            value={searchInput}
            maxLength={80}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit">Search</button>
        </form>
        <label className="owner-users-filter">
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as UserStatusFilter)
              setPage(1)
            }}
          >
            <option value="all">All users</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>
        </label>
        <button type="button" className="owner-users-refresh" onClick={() => void loadUsers()} disabled={loading} aria-label="Refresh user list">
          {loading ? <LoaderCircle size={16} className="owner-users-spinner" /> : <RefreshCw size={16} />}
          Refresh
        </button>
      </div>

      {error ? <p role="alert" className="owner-users-error">{error}</p> : null}

      <div className="owner-users-table-wrap">
        <table className="owner-users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>UID</th>
              <th>Wallet balance</th>
              <th>Referrals</th>
              <th>Profile details</th>
              <th>Sign-in</th>
              <th>Joined</th>
              <th>Status</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="owner-users-empty"><LoaderCircle size={18} className="owner-users-spinner" /> Loading user records…</td></tr>
            ) : data?.users.length ? data.users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong className="owner-users-name">{user.name}</strong>
                  <span className="owner-users-sub">{user.email ?? "No email"}</span>
                  <span className="owner-users-sub">Public ID: {user.publicUid}</span>
                  {user.isOwnerAdmin ? <span className="owner-users-admin"><Shield size={12} aria-hidden="true" /> Owner admin</span> : null}
                </td>
                <td><code className="owner-users-uid" title={user.id}>{user.id}</code></td>
                <td>
                  <strong className="owner-users-wallet">{formatInr(user.walletBalancePaise)}</strong>
                  <button type="button" className="owner-users-wallet-edit" onClick={() => setWalletUser(user)} disabled={busyId === user.id} aria-label={`Adjust wallet for ${user.name}`}>
                    <CircleDollarSign size={13} aria-hidden="true" /> Adjust
                  </button>
                </td>
                <td>
                  <strong className="owner-users-referral-count">{user.referrals.length}</strong>
                  {user.referrals.length ? (
                    <details className="owner-users-referral-list">
                      <summary>View referred UIDs</summary>
                      <ul>
                        {user.referrals.map((referral) => (
                          <li key={referral.uid}>
                            <code title={referral.uid}>{referral.uid}</code>
                            <span>Public ID: {referral.publicUid}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : <span className="owner-users-sub">No referrals</span>}
                </td>
                <td>
                  <span className="owner-users-detail">DOB: {formatDate(user.dateOfBirth)}</span>
                  <span className="owner-users-detail">Telegram: {user.telegramUsername ? `@${user.telegramUsername.replace(/^@/, "")}` : "—"}</span>
                  <span className="owner-users-detail">X: {user.xUsername ? `@${user.xUsername.replace(/^@/, "")}` : "—"}</span>
                  <span className="owner-users-sub">
                    Profile edits: name {user.nameEditUsed ? "used" : "available"} · DOB {user.dateOfBirthEditUsed ? "used" : "available"}
                  </span>
                </td>
                <td>{user.providers.length ? user.providers.join(", ") : "—"}</td>
                <td>{formatDateTime(user.createdAt)}</td>
                <td>
                  <span className={`owner-users-badge${user.isBlocked ? " is-blocked" : ""}`}>
                    {user.isBlocked ? "Blocked" : "Active"}
                  </span>
                  {user.blockedAt ? <span className="owner-users-sub">Since {formatDateTime(user.blockedAt)}</span> : null}
                </td>
                <td>
                  <div className="owner-users-actions">
                    <button type="button" onClick={() => setEditingUser(user)} disabled={busyId === user.id} aria-label={`Edit ${user.name}`} title="Edit user">
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateStatus(user)}
                      disabled={busyId === user.id || user.isOwnerAdmin}
                      aria-label={`${user.isBlocked ? "Unblock" : "Block"} ${user.name}`}
                      title={user.isOwnerAdmin ? "Revoke admin access before changing status" : user.isBlocked ? "Unblock user" : "Block user"}
                    >
                      {user.isBlocked ? <Shield size={15} aria-hidden="true" /> : <ShieldBan size={15} aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => void deleteUser(user)}
                      disabled={busyId === user.id || user.isOwnerAdmin}
                      aria-label={`Delete ${user.name}`}
                      title={user.isOwnerAdmin ? "Revoke admin access before deleting" : "Permanently delete user"}
                    >
                      {busyId === user.id ? <LoaderCircle size={15} className="owner-users-spinner" /> : <Trash2 size={15} aria-hidden="true" />}
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={9} className="owner-users-empty">No users match this search.</td></tr>
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

      {editingUser ? (
        <div className="owner-users-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !savingEdit) setEditingUser(null)
        }}>
          <section className="owner-users-modal" role="dialog" aria-modal="true" aria-labelledby="owner-edit-user-title">
            <div className="owner-users-modal-heading">
              <div><p>USER PROFILE / {editingUser.publicUid}</p><h2 id="owner-edit-user-title">Edit user information</h2></div>
              <button type="button" onClick={() => setEditingUser(null)} disabled={savingEdit} aria-label="Close edit user dialog"><X size={18} /></button>
            </div>
            <form onSubmit={(event) => void saveUser(event)}>
              <label>Name<input name="name" required maxLength={100} defaultValue={editingUser.name} /></label>
              <label>Email<input name="email" type="email" maxLength={320} defaultValue={editingUser.email ?? ""} /></label>
              <label>Date of birth<input name="dateOfBirth" type="date" defaultValue={editingUser.dateOfBirth ?? ""} /></label>
              <label>Telegram username<input name="telegramUsername" maxLength={100} defaultValue={editingUser.telegramUsername ?? ""} placeholder="@username" /></label>
              <label>X username<input name="xUsername" maxLength={100} defaultValue={editingUser.xUsername ?? ""} placeholder="@username" /></label>
              <p className="owner-users-edit-note">Profile name and date-of-birth edit limits do not restrict owner corrections.</p>
              <div className="owner-users-modal-actions">
                <button type="button" onClick={() => setEditingUser(null)} disabled={savingEdit}>Cancel</button>
                <button type="submit" disabled={savingEdit}>
                  {savingEdit ? <LoaderCircle size={15} className="owner-users-spinner" /> : null}
                  Save changes
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {walletUser ? (
        <div className="owner-users-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !savingWallet) setWalletUser(null)
        }}>
          <section className="owner-users-modal" role="dialog" aria-modal="true" aria-labelledby="owner-adjust-wallet-title">
            <div className="owner-users-modal-heading">
              <div>
                <p>WALLET / {walletUser.publicUid}</p>
                <h2 id="owner-adjust-wallet-title">Adjust wallet balance</h2>
                <span className="owner-users-wallet-current">Current available balance: {formatInr(walletUser.walletBalancePaise)}</span>
              </div>
              <button type="button" onClick={() => setWalletUser(null)} disabled={savingWallet} aria-label="Close wallet adjustment dialog"><X size={18} /></button>
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
                <button type="button" onClick={() => setWalletUser(null)} disabled={savingWallet}>Cancel</button>
                <button type="submit" disabled={savingWallet}>
                  {savingWallet ? <LoaderCircle size={15} className="owner-users-spinner" /> : null}
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

function formatInr(amountPaise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amountPaise / 100)
}
