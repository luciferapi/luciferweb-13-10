"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { LoaderCircle, RefreshCw, Save, Search, Shield, Trash2, UserPlus, X } from "lucide-react"
import type { OwnerStaffMember, StaffRole } from "@/features/owner/server/owner-staff"

type AvailableModule = { slug: string; title: string }
type OwnerStaffResult = {
  staff: OwnerStaffMember[]
  candidate: { id: string; email: string; name: string; isBlocked: boolean; isStaff: boolean } | null
  availableModules: AvailableModule[]
}

const roleLabels: Record<StaffRole, string> = {
  co_owner: "Co-owner",
  admin: "Admin",
  customer_support: "Customer support",
}

function isStaffMember(value: unknown): value is OwnerStaffMember {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "string" &&
    "email" in value && typeof value.email === "string" &&
    "name" in value && typeof value.name === "string" &&
    "role" in value && ["co_owner", "admin", "customer_support"].includes(String(value.role)) &&
    "modules" in value && Array.isArray(value.modules) && value.modules.every((module) => typeof module === "string") &&
    "createdAt" in value && typeof value.createdAt === "string"
}

function isOwnerStaffResult(value: unknown): value is OwnerStaffResult {
  return typeof value === "object" && value !== null &&
    "staff" in value && Array.isArray(value.staff) && value.staff.every(isStaffMember) &&
    "candidate" in value && (
      value.candidate === null ||
      (
        typeof value.candidate === "object" &&
        value.candidate !== null &&
        "id" in value.candidate && typeof value.candidate.id === "string" &&
        "email" in value.candidate && typeof value.candidate.email === "string" &&
        "name" in value.candidate && typeof value.candidate.name === "string" &&
        "isBlocked" in value.candidate && typeof value.candidate.isBlocked === "boolean" &&
        "isStaff" in value.candidate && typeof value.candidate.isStaff === "boolean"
      )
    ) &&
    "availableModules" in value && Array.isArray(value.availableModules) && value.availableModules.every((module) =>
      typeof module === "object" && module !== null &&
      "slug" in module && typeof module.slug === "string" &&
      "title" in module && typeof module.title === "string"
    )
}

function readError(value: unknown) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
    ? value.error
    : "Could not update staff access."
}

export function OwnerAdminsPanel() {
  const [data, setData] = useState<OwnerStaffResult | null>(null)
  const [candidate, setCandidate] = useState<OwnerStaffResult["candidate"]>(null)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<StaffRole>("admin")
  const [modules, setModules] = useState<string[]>([])
  const [editingId, setEditingId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const load = useCallback(async (lookupEmail = ""): Promise<OwnerStaffResult> => {
    setError("")
    const query = lookupEmail ? `?email=${encodeURIComponent(lookupEmail.trim())}` : ""
    const response = await fetch(`/api/owner/admins${query}`, { cache: "no-store" })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok || !isOwnerStaffResult(result)) throw new Error(readError(result))
    setData(result)
    if (lookupEmail) setCandidate(result.candidate)
    return result
  }, [])

  useEffect(() => {
    load()
      .catch((caught: unknown) => {
        console.error("Could not load owner staff records.", caught)
        setError(caught instanceof Error ? caught.message : "Could not load staff access.")
      })
      .finally(() => setLoading(false))
  }, [load])

  async function lookupUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setNotice("")
    try {
      const result = await load(email)
      const requestedCandidate = result.candidate
      setNotice(requestedCandidate ? "" : "No registered user was found for that email.")
    } catch (caught) {
      console.error("Could not look up owner staff candidate.", caught)
      setError(caught instanceof Error ? caught.message : "Could not find that user.")
    }
  }

  function selectStaff(member: OwnerStaffMember) {
    setEditingId(member.id)
    setEmail(member.email)
    setRole(member.role)
    setModules(member.modules)
    setCandidate({
      id: member.id,
      email: member.email,
      name: member.name,
      isBlocked: false,
      isStaff: true,
    })
    setError("")
    setNotice("")
  }

  function clearForm() {
    setEditingId("")
    setEmail("")
    setRole("admin")
    setModules([])
    setCandidate(null)
    setError("")
    setNotice("")
  }

  async function saveAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!candidate) {
      setError("Look up a registered user by email first.")
      return
    }
    if (candidate.isBlocked) {
      setError("Unblock this account in User Management before granting staff access.")
      return
    }
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/owner/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: candidate.email, role, modules }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(readError(result))
      await load()
      const savedEmail = candidate.email
      clearForm()
      setNotice(`Staff access saved for ${savedEmail}.`)
    } catch (caught) {
      console.error("Could not save owner staff access.", caught)
      setError(caught instanceof Error ? caught.message : "Could not save staff access.")
    } finally {
      setSaving(false)
    }
  }

  async function removeAccess(member: OwnerStaffMember) {
    if (!window.confirm(`Remove ${roleLabels[member.role]} access for ${member.email}? Their owner sessions will be revoked.`)) return
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/owner/admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.id }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(readError(result))
      if (editingId === member.id) clearForm()
      await load()
      setNotice(`Staff access removed for ${member.email}.`)
    } catch (caught) {
      console.error("Could not remove owner staff access.", caught)
      setError(caught instanceof Error ? caught.message : "Could not remove staff access.")
    } finally {
      setSaving(false)
    }
  }

  function toggleModule(slug: string) {
    setModules((current) => current.includes(slug) ? current.filter((module) => module !== slug) : [...current, slug])
  }

  return (
    <section className="owner-admins-panel" aria-label="Owner staff and permissions">
      {error ? <p className="owner-users-error" role="alert">{error}</p> : null}
      {notice ? <p className="owner-admins-notice" role="status">{notice}</p> : null}

      <header className="owner-admins-heading">
        <div>
          <h2>Co-owners, admins &amp; support</h2>
          <p>Assign access to an existing account. Selected modules control both navigation and API access.</p>
        </div>
        <button type="button" className="owner-users-refresh" disabled={loading || saving} onClick={() => {
          setLoading(true)
          load().catch((caught: unknown) => {
            console.error("Could not refresh owner staff records.", caught)
            setError(caught instanceof Error ? caught.message : "Could not refresh staff access.")
          }).finally(() => setLoading(false))
        }}>
          {loading ? <LoaderCircle size={16} className="owner-users-spinner" /> : <RefreshCw size={16} />}
          Refresh
        </button>
      </header>

      <div className="owner-admins-layout">
        <section className="owner-admins-list" aria-labelledby="owner-admins-list-title">
          <div className="owner-admins-section-heading">
            <h3 id="owner-admins-list-title">Assigned staff</h3>
            <span>{data?.staff.length ?? 0}</span>
          </div>
          {loading && !data ? <p className="owner-users-empty">Loading staff records…</p> : null}
          {data?.staff.length ? data.staff.map((member) => (
            <article className={`owner-staff-card${editingId === member.id ? " is-selected" : ""}`} key={member.id}>
              <div className="owner-staff-card-top">
                <span className="owner-staff-icon"><Shield size={16} aria-hidden="true" /></span>
                <div>
                  <strong>{member.name}</strong>
                  <span>{member.email}</span>
                </div>
                <span className={`owner-staff-role role-${member.role}`}>{roleLabels[member.role]}</span>
              </div>
              <p>{member.modules.length ? member.modules.map((slug) => data?.availableModules.find((item) => item.slug === slug)?.title ?? slug).join(" · ") : "No modules assigned"}</p>
              <div className="owner-staff-actions">
                <button type="button" onClick={() => selectStaff(member)} disabled={saving}><Save size={14} /> Edit access</button>
                <button type="button" className="is-danger" onClick={() => void removeAccess(member)} disabled={saving}><Trash2 size={14} /> Remove</button>
              </div>
            </article>
          )) : !loading && data ? <p className="owner-admins-empty">No staff members are assigned yet.</p> : null}
        </section>

        <section className="owner-admins-editor" aria-labelledby="owner-admins-editor-title">
          <div className="owner-admins-section-heading">
            <div>
              <h3 id="owner-admins-editor-title">{editingId ? "Edit staff permissions" : "Assign staff access"}</h3>
              <p>Only existing, unblocked user accounts can be assigned.</p>
            </div>
            {editingId ? <button type="button" className="owner-admins-clear" onClick={clearForm} aria-label="Cancel editing"><X size={16} /></button> : null}
          </div>

          {!editingId ? (
            <form className="owner-admins-lookup" onSubmit={(event) => void lookupUser(event)}>
              <label htmlFor="owner-staff-email">Find user by email</label>
              <div>
                <input id="owner-staff-email" type="email" required value={email} onChange={(event) => {
                  setEmail(event.target.value)
                  setCandidate(null)
                }} placeholder="user@example.com" />
                <button type="submit" disabled={loading}><Search size={15} /> Find</button>
              </div>
            </form>
          ) : null}

          {candidate ? (
            <div className={`owner-admins-candidate${candidate.isBlocked ? " is-blocked" : ""}`}>
              <strong>{candidate.name}</strong>
              <span>{candidate.email}{candidate.isStaff ? " · Existing staff" : ""}{candidate.isBlocked ? " · Blocked" : ""}</span>
            </div>
          ) : null}

          <form className="owner-admins-form" onSubmit={(event) => void saveAccess(event)}>
            <label>Staff role
              <select value={role} onChange={(event) => setRole(event.target.value as StaffRole)}>
                {Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <fieldset>
              <legend>Modules this person can access</legend>
              <div className="owner-admins-modules">
                {data?.availableModules.map((module) => (
                  <label key={module.slug}>
                    <input type="checkbox" checked={modules.includes(module.slug)} onChange={() => toggleModule(module.slug)} />
                    <span>{module.title}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="owner-users-edit-note">All actions inside a selected module are available. The Admin Management module remains primary-owner-only.</p>
            <button type="submit" disabled={saving || !candidate || candidate.isBlocked}>
              {saving ? <LoaderCircle size={15} className="owner-users-spinner" /> : <UserPlus size={15} />}
              {editingId ? "Save permissions" : "Assign access"}
            </button>
          </form>
        </section>
      </div>
    </section>
  )
}
