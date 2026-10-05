"use client"

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react"
import { ExternalLink, LoaderCircle, Plus, Save, Trash2, Upload, X } from "lucide-react"
import { findAvailableApiEndpointCode } from "@/lib/api-endpoint-codes"
import type { ApiEndpoint } from "@/lib/api-endpoint-types"

const emptyEndpoint = { name: "", path: "", note: "", category: "", imageUrl: "", demoVideo: "", linkUrl: "", isEnabled: true }

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
    "isEnabled" in value && typeof value.isEnabled === "boolean"
}

export function OwnerApiEndpointsPanel() {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fields, setFields] = useState(emptyEndpoint)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState("")
  const [uploading, setUploading] = useState<"image" | "video" | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const codePreview = editingId ?? findAvailableApiEndpointCode(fields.name, endpoints.map((endpoint) => endpoint.id))

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
    } catch (loadError) {
      console.error("Could not load API endpoint management data.", loadError)
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
    setFields({
      name: endpoint.name,
      path: endpoint.path,
      note: endpoint.note,
      category: endpoint.category,
      imageUrl: endpoint.imageUrl,
      demoVideo: endpoint.demoVideo,
      linkUrl: endpoint.linkUrl,
      isEnabled: endpoint.isEnabled,
    })
    setNotice("")
  }

  async function uploadMedia(event: ChangeEvent<HTMLInputElement>, mediaType: "image" | "video") {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ""
    if (!file || !editingId) return

    setUploading(mediaType)
    setError("")
    setNotice("")
    try {
      const formData = new FormData()
      formData.set("project_code", editingId)
      formData.set(mediaType, file)
      const endpoint = mediaType === "image" ? "/api/owner/projects/upload" : "/api/owner/projects/video-upload"
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
      setEditingId(null)
      setFields(emptyEndpoint)
      setNotice(editingId ? "API endpoint updated." : "API endpoint added.")
      await loadEndpoints()
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
    <section className="space-y-6" aria-labelledby="owner-api-endpoints-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">Live API Explorer catalog</p>
          <h2 id="owner-api-endpoints-heading" className="mt-2 text-xl font-bold">Manage API endpoints</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Add, edit, enable, disable, or remove endpoints shown in API Explorer. Upstream requests are restricted to luciferapi.com.</p>
        </div>
        <a href="/api-explorer" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-cyan-700 hover:underline dark:text-cyan-200">
          Preview API Explorer <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      </div>

      {error ? <p role="alert" className="border-l-2 border-rose-500 pl-3 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      {notice ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}

      <form onSubmit={(event) => void saveEndpoint(event)} className="grid gap-4 rounded-xl border border-border bg-card/50 p-4 sm:grid-cols-2 sm:p-5">
        <div className="sm:col-span-2">
          <h3 className="font-semibold">{editingId ? "Edit API endpoint" : "Add API endpoint"}</h3>
          <p className="mt-1 text-xs text-muted-foreground">The public base URL is fixed to https://luciferapi.com/.</p>
        </div>
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          Unique API code
          <input readOnly value={fields.name ? codePreview : editingId ?? ""} placeholder="Generated from endpoint name as you type" className="h-11 w-full rounded-lg border border-border bg-muted px-3 font-mono text-xs text-muted-foreground" />
          <span className="block text-xs font-normal text-muted-foreground">{editingId ? "Stable code used by this endpoint's image and video files." : "Generated from the endpoint name as you type; the server reserves it when saved."}</span>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Endpoint name
          <input required maxLength={100} value={fields.name} onChange={(event) => setFields({ ...fields, name: event.target.value })} placeholder="Example API" className="h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground outline-none focus:border-cyan-400" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Category
          <input required maxLength={60} value={fields.category} onChange={(event) => setFields({ ...fields, category: event.target.value })} placeholder="Example" className="h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground outline-none focus:border-cyan-400" />
        </label>
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          Relative endpoint path
          <div className="flex min-w-0 items-center rounded-lg border border-border bg-background focus-within:border-cyan-400">
            <span className="shrink-0 pl-3 font-mono text-xs text-muted-foreground">https://luciferapi.com/</span>
            <input required maxLength={200} value={fields.path} onChange={(event) => setFields({ ...fields, path: event.target.value })} placeholder="path/to/endpoint.php" className="h-11 min-w-0 flex-1 bg-transparent px-2 text-foreground outline-none" />
          </div>
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
            <button type="button" onClick={() => { setEditingId(null); setFields(emptyEndpoint); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground hover:text-foreground">
              <X aria-hidden="true" className="size-4" /> Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      {loading ? <p role="status" className="text-sm text-muted-foreground">Loading API endpoints...</p> : null}
      {!loading && endpoints.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">No API endpoints are configured.</p> : null}
      <ul className="divide-y divide-border border-y border-border">
        {endpoints.map((endpoint) => (
          <li key={endpoint.id} className="flex flex-wrap items-center gap-3 py-4">
            <button type="button" onClick={() => editEndpoint(endpoint)} className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left transition ${editingId === endpoint.id ? "bg-muted" : "hover:bg-muted/60"}`}>
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{endpoint.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">Code: {endpoint.id}</span>
                <span className="rounded-md border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{endpoint.category}</span>
                <span className={`text-xs ${endpoint.isEnabled ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>{endpoint.isEnabled ? "Enabled" : "Disabled"}</span>
              </span>
              <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">{endpoint.path}{endpoint.note ? ` · ${endpoint.note}` : ""}</span>
            </button>
            <button type="button" disabled={Boolean(busyId)} onClick={() => void deleteEndpoint(endpoint.id)} aria-label={`Delete ${endpoint.name}`} className="grid size-10 shrink-0 place-items-center rounded-lg border border-border text-rose-600 hover:border-rose-400 disabled:opacity-50 dark:text-rose-300">
              {busyId === endpoint.id ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Trash2 aria-hidden="true" className="size-4" />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
