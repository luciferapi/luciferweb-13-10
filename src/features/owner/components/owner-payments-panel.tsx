"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Check, Clock3, LoaderCircle, RefreshCw, X } from "lucide-react"
import type { OwnerPayoutRequest } from "@/features/owner/server/owner-payments"

type PayoutFilter = "pending" | "all"
type PayoutResult = { requests: OwnerPayoutRequest[]; pendingCount: number; limit: number; totalShown: number }

function isPayoutRequest(value: unknown): value is OwnerPayoutRequest {
  if (typeof value !== "object" || value === null) return false
  return "requestId" in value && typeof value.requestId === "string" &&
    "withdrawalId" in value && typeof value.withdrawalId === "string" &&
    "userId" in value && typeof value.userId === "string" &&
    "publicUid" in value && typeof value.publicUid === "string" &&
    "userName" in value && typeof value.userName === "string" &&
    "email" in value && (typeof value.email === "string" || value.email === null) &&
    "amountPaise" in value && typeof value.amountPaise === "number" && Number.isSafeInteger(value.amountPaise) &&
    "method" in value && (value.method === "upi" || value.method === "bank") &&
    "destination" in value && (value.destination === null || isPayoutDetails(value.destination, value.method)) &&
    "maskedDestination" in value && typeof value.maskedDestination === "string" &&
    "paymentReference" in value && (value.paymentReference === null || typeof value.paymentReference === "string") &&
    "ownerResponse" in value && (value.ownerResponse === null || typeof value.ownerResponse === "string") &&
    "ownerNote" in value && (value.ownerNote === null || typeof value.ownerNote === "string") &&
    "processedAt" in value && (value.processedAt === null || typeof value.processedAt === "string") &&
    "status" in value && ["pending", "paid", "rejected", "cancelled"].includes(String(value.status)) &&
    "createdAt" in value && typeof value.createdAt === "string"
}

function isPayoutDetails(value: unknown, method: "upi" | "bank") {
  if (typeof value !== "object" || value === null || !("method" in value) || value.method !== method || !("accountHolder" in value) || typeof value.accountHolder !== "string") return false
  return method === "upi"
    ? "upiId" in value && typeof value.upiId === "string"
    : "accountNumber" in value && typeof value.accountNumber === "string" && "ifscCode" in value && typeof value.ifscCode === "string"
}

function isPayoutResult(value: unknown): value is PayoutResult {
  return typeof value === "object" && value !== null &&
    "requests" in value && Array.isArray(value.requests) && value.requests.every(isPayoutRequest) &&
    "pendingCount" in value && typeof value.pendingCount === "number" &&
    "limit" in value && typeof value.limit === "number" &&
    "totalShown" in value && typeof value.totalShown === "number"
}

function formatInr(amountPaise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amountPaise / 100)
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function errorMessage(value: unknown) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
    ? value.error
    : "Could not load payout requests."
}

type PayoutAction = { request: OwnerPayoutRequest; status: "paid" | "rejected" }

export function OwnerPaymentsPanel() {
  const [filter, setFilter] = useState<PayoutFilter>("pending")
  const [data, setData] = useState<PayoutResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState("")
  const [error, setError] = useState("")
  const [action, setAction] = useState<PayoutAction | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setError("")
    const response = await fetch(`/api/owner/payments?status=${filter}`, { cache: "no-store", signal })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok || !isPayoutResult(result)) throw new Error(errorMessage(result))
    setData(result)
  }, [filter])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    load(controller.signal)
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return
        console.error("Could not load owner payout requests.", caught)
        setError(caught instanceof Error ? caught.message : "Could not load payout requests.")
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [load])

  async function updateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!action) return
    const formData = new FormData(event.currentTarget)
    const ownerResponse = String(formData.get("ownerResponse") ?? "").trim()
    const paymentReference = String(formData.get("paymentReference") ?? "").trim()
    const ownerNote = String(formData.get("ownerNote") ?? "").trim()
    const externalPaymentConfirmed = formData.get("externalPaymentConfirmed") === "on"
    if (ownerResponse.length < 3 || ownerResponse.length > 1000) {
      setError("Write a response to the user (3–1,000 characters).")
      return
    }
    if (action.status === "paid" && !externalPaymentConfirmed) {
      setError("Confirm that the payout was sent outside the app.")
      return
    }
    if (action.status === "paid" && (paymentReference.length < 3 || paymentReference.length > 120)) {
      setError("Enter a valid payment reference or UTR (3–120 characters).")
      return
    }
    if (ownerNote.length > 1000) {
      setError("The private owner note must be 1,000 characters or fewer.")
      return
    }

    setBusyId(action.request.requestId)
    setError("")
    try {
      const response = await fetch("/api/owner/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: action.request.requestId,
          status: action.status,
          externalPaymentConfirmed,
          ownerResponse,
          paymentReference,
          ownerNote,
        }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(errorMessage(result))
      setAction(null)
      await load()
    } catch (caught) {
      console.error("Could not update owner payout request.", caught)
      setError(caught instanceof Error ? caught.message : "Could not update the payout request.")
    } finally {
      setBusyId("")
    }
  }

  function openAction(request: OwnerPayoutRequest, status: "paid" | "rejected") {
    setError("")
    setAction({ request, status })
  }

  async function refresh() {
    setLoading(true)
    try {
      await load()
    } catch (caught) {
      console.error("Could not refresh owner payout requests.", caught)
      setError(caught instanceof Error ? caught.message : "Could not refresh payout requests.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="owner-payments-panel" aria-label="Withdrawal requests">
      {error ? <p className="owner-users-error" role="alert">{error}</p> : null}

      <div className="owner-payments-toolbar">
        <div>
          <div className="owner-payments-count"><Clock3 size={16} aria-hidden="true" /> {data?.pendingCount ?? "—"} pending requests</div>
          <p>Withdrawal requests submitted by users appear here for payout review.</p>
        </div>
        <div className="owner-payments-controls">
          <label className="owner-users-filter">
            <span>Show</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value as PayoutFilter)}>
              <option value="pending">Pending</option>
              <option value="all">All recent</option>
            </select>
          </label>
          <button type="button" className="owner-users-refresh" onClick={() => void refresh()} disabled={loading}>
            {loading ? <LoaderCircle size={16} className="owner-users-spinner" /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>
      </div>

      <p className="owner-payments-security-note">
        Payout details are decrypted only for this verified owner view. For bank or UPI transfers, send payment using your payment provider first, then mark the request paid.
      </p>

      <div className="owner-users-table-wrap">
        <table className="owner-payments-table">
          <thead>
            <tr><th>User</th><th>Amount</th><th>Payout destination</th><th>Request / payment info</th><th>Status</th><th>Response / owner note</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr><td className="owner-users-empty" colSpan={7}><LoaderCircle size={18} className="owner-users-spinner" /> Loading withdrawal requests…</td></tr>
            ) : data?.requests.length ? data.requests.map((request) => (
              <tr key={request.requestId}>
                <td>
                  <strong>{request.userName}</strong>
                  <span>{request.email ?? "No email"} · UID <code title={request.publicUid}>{request.publicUid}</code></span>
                </td>
                <td className="owner-payments-amount">{formatInr(request.amountPaise)}</td>
                <td>
                  {request.destination ? (
                    <>
                      <strong>{request.destination.accountHolder}</strong>
                      {request.destination.method === "upi" ? (
                        <span>UPI · <code>{request.destination.upiId}</code></span>
                      ) : (
                        <>
                          <span>Bank account · <code>{request.destination.accountNumber}</code></span>
                          <span>IFSC · <code>{request.destination.ifscCode}</code></span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <strong>{request.method === "upi" ? "UPI" : "Bank account"}</strong>
                      <span>{request.maskedDestination}</span>
                    </>
                  )}
                </td>
                <td>
                  <code>{request.withdrawalId}</code>
                  <span>{formatDate(request.createdAt)}</span>
                  {request.paymentReference ? <span>UTR / reference: <code>{request.paymentReference}</code></span> : null}
                </td>
                <td><span className={`owner-wallet-status status-${request.status}`}>{request.status}</span></td>
                <td>
                  {request.ownerResponse ? <span className="owner-payments-user-response">{request.ownerResponse}</span> : null}
                  {request.ownerNote ? <span className="owner-payments-private-note"><strong>Owner-only note:</strong> {request.ownerNote}</span> : null}
                  {!request.ownerResponse && !request.ownerNote ? <span className="owner-payments-terminal">—</span> : null}
                </td>
                <td>
                  {request.status === "pending" ? (
                    <div className="owner-payments-actions">
                      <button type="button" onClick={() => openAction(request, "paid")} disabled={busyId !== ""} aria-label={`Mark ${request.withdrawalId} as paid`} title="Mark paid after sending the payout">
                        <Check size={15} />
                        Mark paid
                      </button>
                      <button type="button" className="is-reject" onClick={() => openAction(request, "rejected")} disabled={busyId !== ""} aria-label={`Reject ${request.withdrawalId}`} title="Reject this withdrawal request">
                        <X size={15} /> Reject
                      </button>
                    </div>
                  ) : <span className="owner-payments-terminal">No action available</span>}
                </td>
              </tr>
            )) : (
              <tr><td className="owner-users-empty" colSpan={7}>{filter === "pending" ? "No pending withdrawal requests." : "No withdrawal requests found."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {data && data.totalShown === data.limit ? (
        <p className="owner-payments-limit-note">Showing the newest {data.limit} matching requests.</p>
      ) : null}

      {action ? (
        <div className="owner-users-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busyId) setAction(null)
        }}>
          <section className="owner-users-modal" role="dialog" aria-modal="true" aria-labelledby="owner-payout-action-title">
            <div className="owner-users-modal-heading">
              <div>
                <p>WITHDRAWAL / {action.request.withdrawalId}</p>
                <h2 id="owner-payout-action-title">{action.status === "paid" ? "Confirm payout" : "Reject withdrawal"}</h2>
                <span className="owner-users-wallet-current">{formatInr(action.request.amountPaise)} · {action.request.userName}</span>
              </div>
              <button type="button" onClick={() => setAction(null)} disabled={Boolean(busyId)} aria-label="Close payout action dialog"><X size={18} /></button>
            </div>
            <form onSubmit={(event) => void updateStatus(event)}>
              {error ? <p className="owner-users-error" role="alert">{error}</p> : null}
              {action.status === "paid" ? (
                <>
                  <label className="owner-users-wallet-reason">Payment transfer reference / UTR
                    <input name="paymentReference" required minLength={3} maxLength={120} autoComplete="off" placeholder="Enter bank or payment provider reference" />
                  </label>
                  <label className="owner-payments-confirmation">
                    <input name="externalPaymentConfirmed" type="checkbox" required />
                    I have sent this payout outside the app to the displayed destination.
                  </label>
                </>
              ) : null}
              <label className="owner-users-wallet-reason">Response to the user
                <textarea name="ownerResponse" required minLength={3} maxLength={1000} rows={4} placeholder={action.status === "paid" ? "Tell the user their withdrawal was paid" : "Explain why this withdrawal was rejected"} />
              </label>
              <label className="owner-users-wallet-reason">Private owner note (not shown to the user)
                <textarea name="ownerNote" minLength={3} maxLength={1000} rows={3} placeholder="Optional internal note for owner records" />
              </label>
              <p className="owner-users-edit-note">The user response and payment reference will appear in the user’s withdrawal history. The private note remains owner-only.</p>
              <div className="owner-users-modal-actions">
                <button type="button" onClick={() => setAction(null)} disabled={Boolean(busyId)}>Cancel</button>
                <button type="submit" disabled={Boolean(busyId)}>
                  {busyId ? <LoaderCircle size={15} className="owner-users-spinner" /> : action.status === "paid" ? <Check size={15} /> : <X size={15} />}
                  {action.status === "paid" ? "Save payout and response" : "Reject and send response"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  )
}
