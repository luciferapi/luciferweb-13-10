"use client"

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react"
import { CheckCircle2, CircleDollarSign, Database, ExternalLink, LoaderCircle, Plus, Save, Search, Trash2, Upload, X } from "lucide-react"
import { findAvailableApiEndpointCode } from "@/features/api-endpoints/server/api-endpoint-codes"
import type { ApiEndpoint } from "@/features/api-endpoints/server/api-endpoint-types"
import { formatPriceInr } from "@/features/projects/server/project-pricing"
import { validateUploadFile } from "@/lib/upload-validation"

const emptyEndpoint = { name: "", path: "", note: "", category: "", imageUrl: "", demoVideo: "", linkUrl: "", isEnabled: true, pricePaise: 0 }

function isEndpoint(value: unknown): value is ApiEndpoint {
  return typeof value === "object" &&
    value !== null &&
    "id" in value && typeof value.id === "string" &&
    "name" in value && typeof value.name === "string" &&
    "path" in value && typeof value.path === "string" &&
    "note" in value && typeof value.note === "string" &&
    "category" in value && typeof value.category === "string" &&
    "imageUrl" in value && typeof value.imageUrl === "string" &&
    "demoVideo" in value && typeof value.demoVideo === "string" &&
    "linkUrl" in value && typeof value.linkUrl === "string" &&
    "isEnabled" in value && typeof value.isEnabled === "boolean" &&
    "pricePaise" in value && typeof value.pricePaise === "number" && Number.isSafeInteger(value.pricePaise)
}

export function OwnerApiEndpointsPanel() {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fields, setFields] = useState(emptyEndpoint)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState("")
  const [uploading, setUploading] = useState<"image" | "video" | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">("all")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const codePreview = editingId ?? findAvailableApiEndpointCode(fields.name, endpoints.map((endpoint) => endpoint.id))
  const enabledCount = endpoints.filter((endpoint) => endpoint.isEnabled).length
  const paidCount = endpoints.filter((endpoint) => endpoint.pricePaise > 0).length
  const categoryCount = new Set(endpoints.map((endpoint) => endpoint.category.trim().toLowerCase()).filter(Boolean)).size
  const filteredEndpoints = endpoints.filter((endpoint) => {
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "enabled" ? endpoint.isEnabled : !endpoint.isEnabled)
    const searchable = `${endpoint.name} ${endpoint.id} ${endpoint.path} ${endpoint.category} ${endpoint.note}`.toLowerCase()
    return matchesStatus && searchable.includes(search.trim().toLowerCase())
  })

  async function loadEndpoints() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/owner/api-endpoints", { cache: "no-store" })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error
          : "Could not load API endpoints."
        throw new Error(message)
      }
      if (
        typeof result !== "object" ||
        result === null ||
        !("endpoints" in result) ||
        !Array.isArray(result.endpoints) ||
        !result.endpoints.every(isEndpoint)
      ) throw new Error("The API endpoint list had an invalid format.")
      setEndpoints(result.endpoints)
      setLoadFailed(false)
    } catch (loadError) {
      console.error("Could not load API endpoint management data.", loadError)
      setLoadFailed(true)
      setError(loadError instanceof Error ? loadError.message : "Could not load API endpoints.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEndpoints()
  }, [])

  function editEndpoint(endpoint: ApiEndpoint) {
    setEditingId(endpoint.id)
    setShowForm(true)
    setFields({
      name: endpoint.name,
      path: new URL(endpoint.path, "https://luciferapi.com/").toString(),
      note: endpoint.note,
      category: endpoint.category,
      imageUrl: endpoint.imageUrl,
      demoVideo: endpoint.demoVideo,
      linkUrl: endpoint.linkUrl,
      isEnabled: endpoint.isEnabled,
      pricePaise: endpoint.pricePaise,
    })
    setNotice("")
  }

  async function uploadMedia(event: ChangeEvent<HTMLInputElement>, mediaType: "image" | "video") {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ""
    if (!file || !editingId) return

    const validationError = mediaType === "image"
      ? validateUploadFile(file, ["image/jpeg", "image/png", "image/webp", "image/gif"], 5 * 1024 * 1024, "API image")
      : validateUploadFile(file, ["video/mp4", "video/x-m4v", "video/quicktime", "video/webm"], 100 * 1024 * 1024, "demo video")
    if (validationError) {
      setError(validationError)
      return
    }

    setUploading(mediaType)
    setError("")
    setNotice("")
    try {
      const formData = new FormData()
      formData.set("project_code", editingId)
      formData.set(mediaType, file)
      const endpoint = mediaType === "image" ? "/api/owner/projects/upload?type=api" : "/api/owner/projects/video-upload?type=api"
      const response = await fetch(endpoint, { method: "POST", body: formData })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error
          : `Could not upload API ${mediaType}.`
        throw new Error(message)
      }

      if (typeof result !== "object" || result === null) throw new Error(`The uploaded API ${mediaType} response was invalid.`)
      if (mediaType === "image" && "imageUrl" in result && typeof result.imageUrl === "string") {
        const imageUrl = result.imageUrl
        setFields((current) => ({ ...current, imageUrl }))
      } else if (mediaType === "video" && "filename" in result && typeof result.filename === "string") {
        const filename = result.filename
        const remoteUrl = "url" in result && typeof result.url === "string" ? result.url : ""
        setFields((current) => ({ ...current, demoVideo: remoteUrl || filename }))
      } else {
        throw new Error(`The uploaded API ${mediaType} response was invalid.`)
      }
      setNotice(`API ${mediaType} uploaded. Save the endpoint to link it.`)
    } catch (uploadError) {
      console.error(`Could not upload API ${mediaType}.`, uploadError)
      setError(uploadError instanceof Error ? uploadError.message : `Could not upload API ${mediaType}.`)
    } finally {
      setUploading(null)
    }
  }

  async function saveEndpoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (fields.pricePaise > 0 && fields.pricePaise < 100) {
      setError("Set the API as free or enter a price of at least ₹1.00.")
      return
    }
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/owner/api-endpoints", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...fields, id: editingId } : fields),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error
          : "Could not save API endpoint."
        throw new Error(message)
      }
      if (typeof result !== "object" || result === null || !("endpoint" in result) || !isEndpoint(result.endpoint)) {
        throw new Error("The saved API endpoint response was invalid.")
      }
      const savedEndpoint = result.endpoint
      const wasEditing = editingId !== null
      setEndpoints((current) => [savedEndpoint, ...current.filter((endpoint) => endpoint.id !== savedEndpoint.id)])
      setEditingId(savedEndpoint.id)
      setFields({
        name: savedEndpoint.name,
        path: new URL(savedEndpoint.path, "https://luciferapi.com/").toString(),
        note: savedEndpoint.note,
        category: savedEndpoint.category,
        imageUrl: savedEndpoint.imageUrl,
        demoVideo: savedEndpoint.demoVideo,
        linkUrl: savedEndpoint.linkUrl,
        isEnabled: savedEndpoint.isEnabled,
        pricePaise: savedEndpoint.pricePaise,
      })
      setNotice(wasEditing ? "API endpoint updated." : "API endpoint added. Its image and video upload fields are ready below.")
    } catch (saveError) {
      console.error("Could not save API endpoint.", saveError)
      setError(saveError instanceof Error ? saveError.message : "Could not save API endpoint.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteEndpoint(id: string) {
    if (!window.confirm("Delete this API endpoint?")) return
    setBusyId(id)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/owner/api-endpoints", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error
          : "Could not delete API endpoint."
        throw new Error(message)
      }
      if (editingId === id) {
        setEditingId(null)
        setFields(emptyEndpoint)
      }
      setNotice("API endpoint deleted.")
      await loadEndpoints()
    } catch (deleteError) {
      console.error("Could not delete API endpoint.", deleteError)
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete API endpoint.")
    } finally {
      setBusyId("")
    }
  }

  return (
    <section className="owner-api-endpoints space-y-6" aria-labelledby="owner-api-endpoints-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-cyan-300">API catalog</p>
          <h2 id="owner-api-endpoints-heading" className="mt-2 text-2xl font-bold">Endpoint catalog</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Configure pricing, visibility, and the details shown in API Explorer.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/api-explorer" target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-foreground transition hover:border-cyan-400/60 hover:bg-muted">
            Preview explorer <ExternalLink aria-hidden="true" className="size-4" />
          </a>
          <button
            type="button"
            onClick={() => {
              setEditingId(null)
              setFields(emptyEndpoint)
              setShowForm(true)
              setError("")
              setNotice("")
            }}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
          >
            <Plus aria-hidden="true" className="size-4" /> Add endpoint
          </button>
        </div>
      </div>

      {error ? <p role="alert" className="border-l-2 border-rose-500 pl-3 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      {notice ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}

      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-slate-950/25 sm:grid-cols-4">
        <div className="border-b border-r border-border p-4 sm:border-b-0">
          <dt className="text-xs font-medium text-muted-foreground">All endpoints</dt>
          <dd className="mt-2 flex items-center gap-2 text-2xl font-bold text-foreground">
            <Database aria-hidden="true" className="size-4 text-cyan-300" />{loading ? "…" : endpoints.length}
          </dd>
        </div>
        <div className="border-b border-border p-4 sm:border-r sm:border-b-0">
          <dt className="text-xs font-medium text-muted-foreground">Visible in explorer</dt>
          <dd className="mt-2 flex items-center gap-2 text-2xl font-bold text-foreground">
            <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-300" />{loading ? "…" : enabledCount}
          </dd>
        </div>
        <div className="border-r border-border p-4">
          <dt className="text-xs font-medium text-muted-foreground">Paid access</dt>
          <dd className="mt-2 flex items-center gap-2 text-2xl font-bold text-foreground">
            <CircleDollarSign aria-hidden="true" className="size-4 text-cyan-300" />{loading ? "…" : paidCount}
          </dd>
        </div>
        <div className="p-4">
          <dt className="text-xs font-medium text-muted-foreground">Categories</dt>
          <dd className="mt-2 text-2xl font-bold text-foreground">{loading ? "…" : categoryCount}</dd>
        </div>
      </dl>

      {showForm ? <form onSubmit={(event) => void saveEndpoint(event)} className="grid gap-4 rounded-xl border border-border bg-card/50 p-4 sm:grid-cols-2 sm:p-5">
        <div className="sm:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">{editingId ? `Edit ${fields.name}` : "Create an endpoint"}</h3>
              <p className="mt-1 text-sm text-muted-foreground">Add the public URL, access price, and details shown in API Explorer.</p>
            </div>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setFields(emptyEndpoint); setError(""); setNotice(""); }} aria-label="Close endpoint form" className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          Unique API code
          <input readOnly value={fields.name ? codePreview : editingId ?? ""} placeholder="Generated from endpoint name as you type" className="h-11 w-full rounded-lg border border-border bg-muted px-3 font-mono text-xs text-muted-foreground" />
          <span className="block text-xs font-normal text-muted-foreground">{editingId ? "Permanent code used by this endpoint's purchase history and media." : "Title preview only; a unique permanent suffix is added and reserved when you save."}</span>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Endpoint name
          <input required maxLength={100} value={fields.name} onChange={(event) => setFields({ ...fields, name: event.target.value })} placeholder="Example API" className="h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground outline-none focus:border-cyan-400" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Category
          <input required maxLength={60} value={fields.category} onChange={(event) => setFields({ ...fields, category: event.target.value })} placeholder="Example" className="h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground outline-none focus:border-cyan-400" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          One-time Explorer price (INR)
          <input
            type="number"
            min="0"
            max="10000000"
            step="0.01"
            inputMode="decimal"
            value={(fields.pricePaise / 100).toFixed(2)}
            onChange={(event) => {
              const rupees = Number(event.target.value)
              const pricePaise = Number.isFinite(rupees) ? Math.round(rupees * 100) : 0
              setFields({ ...fields, pricePaise })
            }}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground outline-none focus:border-cyan-400"
          />
          <span className="block text-xs font-normal text-muted-foreground">Set ₹0.00 for free. Paid access must be at least ₹1 and unlocks testing in this website only.</span>
        </label>
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          Full endpoint URL
          <input required type="url" maxLength={2000} value={fields.path} onChange={(event) => setFields({ ...fields, path: event.target.value })} placeholder="https://api.example.com/v1/endpoint?format=json" className="h-11 w-full rounded-lg border border-border bg-background px-3 font-mono text-xs text-foreground outline-none focus:border-cyan-400" />
          <span className="block text-xs font-normal text-muted-foreground">HTTPS only. Private, local, and IP-literal destinations are blocked.</span>
        </label>
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          Description
          <input maxLength={300} value={fields.note} onChange={(event) => setFields({ ...fields, note: event.target.value })} placeholder="What this endpoint returns" className="h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground outline-none focus:border-cyan-400" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          API image
          {editingId ? (
            <span className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
              <Upload aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label={`Upload image for API ${fields.name}`} onChange={(event) => void uploadMedia(event, "image")} disabled={uploading !== null} className="min-w-0 flex-1 text-xs text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-foreground disabled:opacity-50" />
            </span>
          ) : <span className="block rounded-lg border border-border bg-background px-3 py-3 text-xs font-normal text-muted-foreground">Save the endpoint first to assign its unique code, then upload an image.</span>}
          <span className="block text-xs font-normal text-muted-foreground">JPG, PNG, WebP, or GIF · max 5 MB · stored by API code</span>
          {fields.imageUrl ? <img src={fields.imageUrl} alt={`${fields.name || "API"} preview`} className="aspect-video w-full rounded-lg border border-border object-cover" /> : null}
        </label>
        <label className="space-y-2 text-sm font-medium">
          Demo video
          {editingId ? (
            <span className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
              <Upload aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <input type="file" accept="video/mp4,video/x-m4v,video/quicktime,video/webm" aria-label={`Upload demo video for API ${fields.name}`} onChange={(event) => void uploadMedia(event, "video")} disabled={uploading !== null} className="min-w-0 flex-1 text-xs text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-foreground disabled:opacity-50" />
            </span>
          ) : <span className="block rounded-lg border border-border bg-background px-3 py-3 text-xs font-normal text-muted-foreground">Save the endpoint first to assign its unique code, then upload a video.</span>}
          <span className="block text-xs font-normal text-muted-foreground">{fields.demoVideo || "MP4, M4V, MOV, or WebM · max 100 MB"}</span>
        </label>
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          Documentation or related link
          <input type="url" maxLength={300} value={fields.linkUrl} onChange={(event) => setFields({ ...fields, linkUrl: event.target.value })} placeholder="https://example.com/docs" className="h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground outline-none focus:border-cyan-400" />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
          <input type="checkbox" checked={fields.isEnabled} onChange={(event) => setFields({ ...fields, isEnabled: event.target.checked })} className="size-4 accent-cyan-500" />
          Show in the public API Explorer
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="submit" disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50">
            {saving ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : editingId ? <Save aria-hidden="true" className="size-4" /> : <Plus aria-hidden="true" className="size-4" />}
            {editingId ? "Save endpoint" : "Add endpoint"}
          </button>
          {editingId ? (
            <button type="button" onClick={() => { setEditingId(null); setFields(emptyEndpoint); setNotice(""); setError(""); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground hover:text-foreground">
              <X aria-hidden="true" className="size-4" /> New endpoint
            </button>
          ) : null}
        </div>
      </form> : null}

      <div className="overflow-hidden rounded-xl border border-border bg-slate-950/20">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold">Endpoints <span className="font-mono text-sm font-normal text-muted-foreground">{loading ? "" : endpoints.length}</span></h3>
            <p className="mt-1 text-xs text-muted-foreground">Select an endpoint to review or update its configuration.</p>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Search endpoints</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, URL, or code" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:border-cyan-400" />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3" aria-label="Filter endpoints">
          {(["all", "enabled", "disabled"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={statusFilter === filter}
              onClick={() => setStatusFilter(filter)}
              className={`min-h-8 rounded-md border px-3 text-xs font-semibold capitalize transition ${statusFilter === filter ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-200" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {filter} {loading ? "" : filter === "all" ? endpoints.length : filter === "enabled" ? enabledCount : endpoints.length - enabledCount}
            </button>
          ))}
        </div>

        {loading ? (
          <div role="status" aria-label="Loading API endpoints" className="grid gap-3 p-4">
            {[0, 1, 2].map((item) => <div key={item} className="h-[4.5rem] animate-pulse rounded-lg bg-slate-800/70 motion-reduce:animate-none" />)}
          </div>
        ) : loadFailed ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-rose-200">The endpoint catalog could not be loaded.</p>
            <button type="button" onClick={() => void loadEndpoints()} className="mt-4 inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-sm font-semibold text-foreground transition hover:bg-muted">
              Try again
            </button>
          </div>
        ) : endpoints.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Database aria-hidden="true" className="mx-auto size-8 text-slate-500" />
            <h4 className="mt-3 font-semibold text-foreground">Your API catalog is empty</h4>
            <p className="mt-1 text-sm text-muted-foreground">Add a public endpoint to make it available in the explorer.</p>
            <button type="button" onClick={() => { setEditingId(null); setFields(emptyEndpoint); setShowForm(true); }} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">
              <Plus aria-hidden="true" className="size-4" /> Add first endpoint
            </button>
          </div>
        ) : filteredEndpoints.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No endpoints match these filters.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filteredEndpoints.map((endpoint) => (
              <li key={endpoint.id} className={`flex min-w-0 items-center gap-3 p-3 transition-colors sm:gap-4 sm:px-4 ${editingId === endpoint.id ? "bg-cyan-300/[0.06]" : "hover:bg-white/[0.025]"}`}>
                <button type="button" onClick={() => editEndpoint(endpoint)} className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:gap-4">
                  {endpoint.imageUrl ? (
                    <img src={endpoint.imageUrl} alt="" className="size-11 shrink-0 rounded-lg border border-border object-cover" />
                  ) : (
                    <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-slate-900 text-cyan-200">
                      <Database aria-hidden="true" className="size-5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-semibold text-foreground">{endpoint.name}</span>
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${endpoint.isEnabled ? "border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-200" : "border-border text-muted-foreground"}`}>{endpoint.isEnabled ? "Enabled" : "Disabled"}</span>
                    </span>
                    <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">{endpoint.path}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      <span>{endpoint.category}</span><span aria-hidden="true" className="text-slate-600">/</span>
                      <span className="font-mono">{endpoint.id}</span>
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-right sm:block">
                    <span className="block text-sm font-semibold text-foreground">{endpoint.pricePaise === 0 ? "Free" : formatPriceInr(endpoint.pricePaise)}</span>
                    <span className="text-[11px] text-muted-foreground">{endpoint.pricePaise === 0 ? "No access fee" : "One-time access"}</span>
                  </span>
                </button>
                <button type="button" disabled={Boolean(busyId)} onClick={() => void deleteEndpoint(endpoint.id)} aria-label={`Delete ${endpoint.name}`} className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:border-rose-400/50 hover:bg-rose-400/10 hover:text-rose-200 disabled:opacity-50">
                  {busyId === endpoint.id ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Trash2 aria-hidden="true" className="size-4" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
