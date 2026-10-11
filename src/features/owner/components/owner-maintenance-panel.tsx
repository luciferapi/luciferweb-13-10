"use client"

import Image from "next/image"
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { ImagePlus, LoaderCircle, Pencil, Save, Trash2 } from "lucide-react"
import { ownerRouteOptions } from "@/features/owner/owner-route-options"
import { validateUploadFile } from "@/lib/upload-validation"

type MaintenanceEntry = {
  id: string
  path: string
  title: string
  message: string
  imageUrl: string | null
  isEnabled: boolean
  sortOrder: number
}

type MaintenanceFields = {
  path: string
  title: string
  message: string
  imageUrl: string
  isEnabled: boolean
  sortOrder: number
}

const customPathValue = "__custom_path__"

const emptyFields: MaintenanceFields = {
  path: "/",
  title: "",
  message: "",
  imageUrl: "",
  isEnabled: true,
  sortOrder: 0,
}

function isMaintenanceEntry(value: unknown): value is MaintenanceEntry {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "string" &&
    "path" in value && typeof value.path === "string" &&
    "title" in value && typeof value.title === "string" &&
    "message" in value && typeof value.message === "string" &&
    "imageUrl" in value && (typeof value.imageUrl === "string" || value.imageUrl === null) &&
    "isEnabled" in value && typeof value.isEnabled === "boolean" &&
    "sortOrder" in value && typeof value.sortOrder === "number"
}

function readError(value: unknown) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
    ? value.error
    : "The maintenance request could not be completed."
}

export function OwnerMaintenancePanel() {
  const [entries, setEntries] = useState<MaintenanceEntry[]>([])
  const [fields, setFields] = useState<MaintenanceFields>(emptyFields)
  const [isCustomPath, setIsCustomPath] = useState(false)
  const [editingId, setEditingId] = useState("")
  const [imageUploading, setImageUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const imageInputRef = useRef<HTMLInputElement>(null)

  async function loadEntries() {
    setError("")
    const response = await fetch("/api/owner/maintenance", { cache: "no-store" })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok || typeof result !== "object" || result === null || !("maintenance" in result) || !Array.isArray(result.maintenance) || !result.maintenance.every(isMaintenanceEntry)) {
      throw new Error(readError(result))
    }
    setEntries(result.maintenance)
  }

  useEffect(() => {
    loadEntries()
      .catch((caught: unknown) => {
        console.error("Could not load maintenance entries.", caught)
        setError(caught instanceof Error ? caught.message : "Could not load maintenance entries.")
      })
      .finally(() => setLoading(false))
  }, [])

  function clearForm() {
    setEditingId("")
    setFields(emptyFields)
    setIsCustomPath(false)
    if (imageInputRef.current) imageInputRef.current.value = ""
    setError("")
  }

  function editEntry(entry: MaintenanceEntry) {
    setEditingId(entry.id)
    setIsCustomPath(!ownerRouteOptions.some((option) => option.path === entry.path))
    setFields({
      path: entry.path,
      title: entry.title,
      message: entry.message,
      imageUrl: entry.imageUrl ?? "",
      isEnabled: entry.isEnabled,
      sortOrder: entry.sortOrder,
    })
    setError("")
    setNotice("")
  }

  async function uploadMaintenanceImage(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0]
    event.target.value = ""
    if (!image) return

    const validationError = validateUploadFile(
      image,
      ["image/jpeg", "image/png", "image/webp", "image/gif"],
      5 * 1024 * 1024,
      "maintenance image",
    )
    if (validationError) {
      setError(validationError)
      return
    }

    setImageUploading(true)
    setError("")
    setNotice("")
    try {
      const formData = new FormData()
      formData.set("image", image)
      const response = await fetch("/api/owner/maintenance/upload", { method: "POST", body: formData })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok || typeof result !== "object" || result === null || !("imageUrl" in result) || typeof result.imageUrl !== "string") {
        throw new Error(readError(result))
      }
      const uploadedImageUrl = result.imageUrl
      setFields((current) => ({ ...current, imageUrl: uploadedImageUrl }))
      setNotice("Image uploaded to Cloudflare R2. Save the page to publish it.")
    } catch (caught) {
      console.error("Could not upload maintenance image.", caught)
      setError(caught instanceof Error ? caught.message : "Could not upload the maintenance image.")
    } finally {
      setImageUploading(false)
    }
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setNotice("")

    try {
      const response = await fetch("/api/owner/maintenance", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          path: fields.path.trim(),
          title: fields.title.trim(),
          message: fields.message.trim(),
          ...(editingId ? { id: editingId } : {}),
        }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok || typeof result !== "object" || result === null || !("maintenance" in result) || !isMaintenanceEntry(result.maintenance)) {
        throw new Error(readError(result))
      }

      const savedEntry = result.maintenance
      setEntries((current) => {
        const next = editingId
          ? current.map((entry) => entry.id === editingId ? savedEntry : entry)
          : [...current, savedEntry]
        return next.sort((left, right) => left.sortOrder - right.sortOrder || left.path.localeCompare(right.path))
      })
      clearForm()
      setNotice(editingId ? "Maintenance page updated." : "Maintenance page added.")
    } catch (caught) {
      console.error("Could not save maintenance page.", caught)
      setError(caught instanceof Error ? caught.message : "Could not save the maintenance page.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteEntry(entry: MaintenanceEntry) {
    if (!window.confirm(`Remove maintenance for ${entry.path}?`)) return
    setBusyId(entry.id)
    setError("")
    setNotice("")

    try {
      const response = await fetch("/api/owner/maintenance", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(readError(result))
      if (editingId === entry.id) clearForm()
      setEntries((current) => current.filter((item) => item.id !== entry.id))
      setNotice("Maintenance page removed.")
    } catch (caught) {
      console.error("Could not delete maintenance page.", caught)
      setError(caught instanceof Error ? caught.message : "Could not delete the maintenance page.")
    } finally {
      setBusyId("")
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">Maintenance pages</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Manage page outages</h2>
          </div>
          <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {entries.filter((entry) => entry.isEnabled).length} active
          </span>
        </div>
      </div>

      {notice ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}
      {error ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1.06fr_0.94fr]">
        <form onSubmit={saveEntry} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">{editingId ? "Edit maintenance route" : "Add a maintenance route"}</h3>
            {editingId ? (
              <button type="button" onClick={clearForm} className="text-sm font-medium text-muted-foreground hover:text-foreground">Clear</button>
            ) : null}
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="maintenance-path" className="mb-1.5 block text-sm font-medium text-foreground">Page path</label>
              <select
                id="maintenance-path"
                value={isCustomPath ? customPathValue : fields.path}
                onChange={(event) => {
                  const nextPath = event.target.value
                  const custom = nextPath === customPathValue
                  setIsCustomPath(custom)
                  setFields((current) => ({ ...current, path: custom ? "" : nextPath }))
                }}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-cyan-500"
              >
                {["Main pages", "Owner workspace"].map((group) => (
                  <optgroup key={group} label={group}>
                    {ownerRouteOptions.filter((option) => option.group === group).map((option) => (
                      <option key={option.path} value={option.path}>{option.label} — {option.path}</option>
                    ))}
                  </optgroup>
                ))}
                <option value={customPathValue}>Custom path…</option>
              </select>
              {isCustomPath ? (
                <input
                  value={fields.path}
                  onChange={(event) => setFields((current) => ({ ...current, path: event.target.value }))}
                  placeholder="/your-route"
                  aria-label="Custom page path"
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-cyan-500"
                />
              ) : null}
              {fields.path.startsWith("/owner/") ? (
                <p className="mt-1.5 text-xs text-muted-foreground">The maintenance manager at /owner/maintenance always stays available so you can turn maintenance off.</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Heading <span className="font-normal text-muted-foreground">(optional)</span></label>
              <input
                value={fields.title}
                onChange={(event) => setFields((current) => ({ ...current, title: event.target.value }))}
                placeholder="We'll be right back"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-0 transition focus:border-cyan-500"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">Leave blank to use the standard maintenance heading.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Message <span className="font-normal text-muted-foreground">(optional)</span></label>
              <textarea
                value={fields.message}
                onChange={(event) => setFields((current) => ({ ...current, message: event.target.value }))}
                placeholder="We're working to improve your experience. Please check back soon."
                rows={4}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-cyan-500"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">Leave blank to use the standard maintenance message.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Order</label>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={fields.sortOrder}
                  onChange={(event) => setFields((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-cyan-500"
                />
              </div>

              <div className="flex items-end">
                <label className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground">
                  <span>Active</span>
                  <input
                    type="checkbox"
                    checked={fields.isEnabled}
                    onChange={(event) => setFields((current) => ({ ...current, isEnabled: event.target.checked }))}
                    className="h-4 w-4 accent-cyan-600"
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Maintenance image</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground"
                >
                  {imageUploading ? <LoaderCircle aria-hidden="true" size={16} className="animate-spin" /> : <ImagePlus aria-hidden="true" size={16} />}
                  {imageUploading ? "Uploading to R2..." : "Upload to R2"}
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" onChange={uploadMaintenanceImage} className="hidden" />
                {fields.imageUrl ? (
                  <span className="truncate text-xs text-muted-foreground">Image ready</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Optional · stored in Cloudflare R2</span>
                )}
              </div>
              {fields.imageUrl ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background">
                  <div className="relative h-40 w-full">
                    <Image src={fields.imageUrl} alt="Maintenance preview" fill className="object-cover" unoptimized />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving || imageUploading} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? <LoaderCircle aria-hidden="true" size={16} className="animate-spin" /> : <Save aria-hidden="true" size={16} />}
                {saving ? "Saving..." : editingId ? "Update page" : "Save page"}
              </button>
            </div>
          </div>
        </form>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Active maintenance routes</h3>
            <span className="text-sm text-muted-foreground">{entries.length} total</span>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" size={16} className="animate-spin" /> Loading...</div>
          ) : entries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-background px-4 py-6 text-sm text-muted-foreground">
              No pages are marked for maintenance yet.
            </p>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <article key={entry.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{entry.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{entry.path}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${entry.isEnabled ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-slate-500/10 text-slate-600 dark:text-slate-300"}`}>
                        {entry.isEnabled ? "On" : "Off"}
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{entry.message}</p>

                  {entry.imageUrl ? (
                    <div className="relative mt-3 h-28 overflow-hidden rounded-lg border border-border">
                      <Image src={entry.imageUrl} alt={entry.title} fill className="object-cover" unoptimized />
                    </div>
                  ) : null}

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button type="button" onClick={() => editEntry(entry)} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground">
                      <Pencil aria-hidden="true" size={12} /> Edit
                    </button>
                    <button type="button" onClick={() => deleteEntry(entry)} disabled={busyId === entry.id} className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 disabled:cursor-not-allowed disabled:opacity-60">
                      <Trash2 aria-hidden="true" size={12} /> {busyId === entry.id ? "Removing..." : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
