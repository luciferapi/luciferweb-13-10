"use client"

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import Image from "next/image"
import { ImagePlus, LoaderCircle, Pencil, Plus, Save, Trash2, X } from "lucide-react"
import { ownerRouteOptions } from "@/features/owner/owner-route-options"
import { validateUploadFile } from "@/lib/upload-validation"

type Banner = {
  id: string
  message: string
  linkUrl: string | null
  imageUrl: string | null
  isEnabled: boolean
  sortOrder: number
}

type BannerFields = {
  message: string
  linkUrl: string
  imageUrl: string
  isEnabled: boolean
  sortOrder: number
}
const emptyFields: BannerFields = { message: "", linkUrl: "", imageUrl: "", isEnabled: true, sortOrder: 0 }
const noLinkValue = "__no_link__"
const customLinkValue = "__custom_link__"

function isKnownRoute(value: string) {
  return ownerRouteOptions.some((option) => option.path === value && !option.path.endsWith("/*"))
}

function isBanner(value: unknown): value is Banner {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "string" &&
    "message" in value && typeof value.message === "string" &&
    "linkUrl" in value && (typeof value.linkUrl === "string" || value.linkUrl === null) &&
    "imageUrl" in value && (typeof value.imageUrl === "string" || value.imageUrl === null) &&
    "isEnabled" in value && typeof value.isEnabled === "boolean" &&
    "sortOrder" in value && typeof value.sortOrder === "number"
}

function readError(value: unknown) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
    ? value.error
    : "The banner request could not be completed."
}

export function OwnerBannersPanel() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [fields, setFields] = useState<BannerFields>(emptyFields)
  const [linkMode, setLinkMode] = useState<"none" | "page" | "custom">("none")
  const [editingId, setEditingId] = useState("")
  const [imageUploading, setImageUploading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  async function loadBanners() {
    setError("")
    const response = await fetch("/api/owner/banners", { cache: "no-store" })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok || typeof result !== "object" || result === null ||
      !("banners" in result) || !Array.isArray(result.banners) || !result.banners.every(isBanner)) {
      throw new Error(readError(result))
    }
    setBanners(result.banners)
  }

  useEffect(() => {
    loadBanners()
      .catch((caught: unknown) => {
        console.error("Could not load owner live banners.", caught)
        setError(caught instanceof Error ? caught.message : "Could not load live banners.")
      })
      .finally(() => setLoading(false))
  }, [])

  function editBanner(banner: Banner) {
    setEditingId(banner.id)
    setLinkMode(!banner.linkUrl ? "none" : isKnownRoute(banner.linkUrl) ? "page" : "custom")
    setFields({
      message: banner.message,
      linkUrl: banner.linkUrl ?? "",
      imageUrl: banner.imageUrl ?? "",
      isEnabled: banner.isEnabled,
      sortOrder: banner.sortOrder,
    })
    setError("")
    setNotice("")
  }

  function clearForm() {
    setEditingId("")
    setLinkMode("none")
    setFields(emptyFields)
    if (imageInputRef.current) imageInputRef.current.value = ""
    setError("")
  }

  async function uploadBannerImage(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0]
    event.target.value = ""
    if (!image) return

    const validationError = validateUploadFile(
      image,
      ["image/jpeg", "image/png", "image/webp", "image/gif"],
      5 * 1024 * 1024,
      "banner image",
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
      const response = await fetch("/api/owner/banners/upload", { method: "POST", body: formData })
      const result: unknown = await response.json().catch(() => null)
      if (
        !response.ok || typeof result !== "object" || result === null ||
        !("imageUrl" in result) || typeof result.imageUrl !== "string"
      ) throw new Error(readError(result))
      const imageUrl = result.imageUrl
      setFields((current) => ({ ...current, imageUrl }))
      setNotice("Banner image uploaded. Save the banner to publish it.")
    } catch (caught) {
      console.error("Could not upload the homepage banner image.", caught)
      setError(caught instanceof Error ? caught.message : "Could not upload the banner image.")
    } finally {
      setImageUploading(false)
    }
  }

  async function saveBanner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/owner/banners", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          linkUrl: fields.linkUrl.trim(),
          ...(editingId ? { id: editingId } : {}),
        }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok || typeof result !== "object" || result === null || !("banner" in result) || !isBanner(result.banner)) {
        throw new Error(readError(result))
      }
      const savedBanner = result.banner
      setBanners((current) => {
        const next = editingId
          ? current.map((banner) => banner.id === editingId ? savedBanner : banner)
          : [...current, savedBanner]
        return next.sort((left, right) => left.sortOrder - right.sortOrder)
      })
      clearForm()
      setNotice(editingId ? "Banner updated." : "Banner added.")
    } catch (caught) {
      console.error("Could not save owner live banner.", caught)
      setError(caught instanceof Error ? caught.message : "Could not save the banner.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteBanner(banner: Banner) {
    if (!window.confirm("Delete this homepage banner?")) return
    setBusyId(banner.id)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/owner/banners", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: banner.id }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(readError(result))
      if (editingId === banner.id) clearForm()
      setBanners((current) => current.filter((item) => item.id !== banner.id))
      setNotice("Banner deleted.")
    } catch (caught) {
      console.error("Could not delete owner live banner.", caught)
      setError(caught instanceof Error ? caught.message : "Could not delete the banner.")
    } finally {
      setBusyId("")
    }
  }

  return (
    <section className="owner-banners-panel" aria-labelledby="owner-banners-title">
      <div className="owner-admins-heading">
        <div>
          <h2 id="owner-banners-title">Homepage live banners</h2>
          <p>Manage the announcements that scroll across the homepage hero.</p>
        </div>
        <span className="owner-access-pill">{banners.filter((banner) => banner.isEnabled).length} live</span>
      </div>

      {notice ? <p className="owner-admins-notice" role="status">{notice}</p> : null}
      {error ? <p className="owner-support-notice" role="alert">{error}</p> : null}

      <div className="owner-banners-layout">
        <section className="owner-banners-list" aria-label="Saved banners">
          <div className="owner-admins-section-heading">
            <div>
              <h3>Saved banners</h3>
              <p>Lower order numbers appear first.</p>
            </div>
            <span>{banners.length}</span>
          </div>
          {loading ? (
            <p className="owner-support-empty"><LoaderCircle aria-hidden="true" size={16} className="animate-spin" /> Loading banners</p>
          ) : banners.length === 0 ? (
            <p className="owner-support-empty">No banners yet. Add one to show a live announcement on the homepage.</p>
          ) : banners.map((banner) => (
            <article className={`owner-banner-card${editingId === banner.id ? " is-selected" : ""}`} key={banner.id}>
              <div className="owner-banner-copy">
                <span className={banner.isEnabled ? "owner-banner-state is-live" : "owner-banner-state"}>
                  {banner.isEnabled ? "Live" : "Paused"}
                </span>
                {banner.imageUrl ? (
                  <Image src={banner.imageUrl} alt="" width={320} height={100} unoptimized className="owner-banner-thumbnail" />
                ) : null}
                {banner.message ? <p>{banner.message}</p> : null}
                {banner.linkUrl ? <span className="owner-banner-link">{banner.linkUrl}</span> : null}
                <small>Order {banner.sortOrder}</small>
              </div>
              <div className="owner-banner-actions">
                <button type="button" className="owner-secondary-button" onClick={() => editBanner(banner)} aria-label={`Edit banner: ${banner.message || "Image banner"}`}>
                  <Pencil aria-hidden="true" size={14} /> Edit
                </button>
                <button type="button" className="owner-danger-button" disabled={busyId === banner.id} onClick={() => void deleteBanner(banner)} aria-label={`Delete banner: ${banner.message || "Image banner"}`}>
                  {busyId === banner.id ? <LoaderCircle aria-hidden="true" size={14} className="animate-spin" /> : <Trash2 aria-hidden="true" size={14} />}
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>

        <form className="owner-banners-editor" onSubmit={saveBanner}>
          <div className="owner-admins-section-heading">
            <div>
              <h3>{editingId ? "Edit banner" : "Add a banner"}</h3>
              <p>Announcement text is optional when you upload an image.</p>
            </div>
            {editingId ? (
              <button type="button" className="owner-secondary-button" onClick={clearForm}><X aria-hidden="true" size={14} /> Cancel</button>
            ) : null}
          </div>

          <label className="owner-banner-field">
            <span>Announcement (optional)</span>
            <textarea
              maxLength={240}
              rows={3}
              value={fields.message}
              onChange={(event) => setFields((current) => ({ ...current, message: event.target.value }))}
              placeholder="Add announcement text, or leave blank for an image-only banner"
            />
            <small>{fields.message.length}/240 characters. Add text or upload an image.</small>
          </label>

          <div className="owner-banner-field">
            <label htmlFor="owner-banner-link-mode">Link destination (optional)</label>
            <select
              id="owner-banner-link-mode"
              value={linkMode === "none" ? noLinkValue : linkMode === "custom" ? customLinkValue : "page"}
              onChange={(event) => {
                const value = event.target.value
                if (value === noLinkValue) {
                  setLinkMode("none")
                  setFields((current) => ({ ...current, linkUrl: "" }))
                } else if (value === customLinkValue) {
                  setLinkMode("custom")
                  setFields((current) => ({ ...current, linkUrl: isKnownRoute(current.linkUrl) ? "" : current.linkUrl }))
                } else {
                  const firstPage = ownerRouteOptions.find((option) => !option.path.endsWith("/*"))
                  setLinkMode("page")
                  setFields((current) => ({ ...current, linkUrl: firstPage?.path ?? "/" }))
                }
              }}
            >
              <option value={noLinkValue}>No link</option>
              <option value="page">Choose a site page</option>
              <option value={customLinkValue}>Custom URL or path</option>
            </select>
            {linkMode === "page" ? (
              <select
                aria-label="Select banner destination page"
                value={fields.linkUrl}
                onChange={(event) => setFields((current) => ({ ...current, linkUrl: event.target.value }))}
              >
                {["Main pages", "Owner workspace"].map((group) => (
                  <optgroup key={group} label={group}>
                    {ownerRouteOptions.filter((option) => option.group === group && !option.path.endsWith("/*")).map((option) => (
                      <option key={option.path} value={option.path}>{option.label} — {option.path}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : null}
            {linkMode === "custom" ? (
              <input
                type="text"
                maxLength={500}
                value={fields.linkUrl}
                onChange={(event) => setFields((current) => ({ ...current, linkUrl: event.target.value }))}
                placeholder="https://example.com or /custom-path"
                aria-label="Custom banner link"
              />
            ) : null}
          </div>

          <div className="owner-banner-field">
            <span>Full-width image banner (optional)</span>
            {fields.imageUrl ? (
              <div className="owner-banner-image-preview">
                <Image src={fields.imageUrl} alt="Banner image preview" width={720} height={225} unoptimized />
                <button
                  type="button"
                  className="owner-secondary-button"
                  onClick={() => setFields((current) => ({ ...current, imageUrl: "" }))}
                  disabled={imageUploading}
                >
                  <X aria-hidden="true" size={14} /> Remove image
                </button>
              </div>
            ) : null}
            <label className="owner-banner-upload">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(event) => void uploadBannerImage(event)}
                disabled={imageUploading}
              />
              {imageUploading ? <LoaderCircle aria-hidden="true" size={15} className="animate-spin" /> : <ImagePlus aria-hidden="true" size={15} />}
              {imageUploading ? "Uploading image..." : fields.imageUrl ? "Replace image" : "Choose image"}
            </label>
            <small>JPG, PNG, WebP, or GIF. Maximum file size: 5 MB. The image scrolls separately from text banners.</small>
          </div>

          <label className="owner-banner-field">
            <span>Display order</span>
            <input
              type="number"
              min={0}
              max={10000}
              step={1}
              value={fields.sortOrder}
              onChange={(event) => setFields((current) => ({ ...current, sortOrder: Number(event.target.value) }))}
            />
          </label>

          <label className="owner-banner-checkbox">
            <input
              type="checkbox"
              checked={fields.isEnabled}
              onChange={(event) => setFields((current) => ({ ...current, isEnabled: event.target.checked }))}
            />
            Show this banner on the homepage
          </label>

          <button type="submit" className="owner-primary-button" disabled={saving || imageUploading}>
            {saving ? <LoaderCircle aria-hidden="true" size={15} className="animate-spin" /> : editingId ? <Save aria-hidden="true" size={15} /> : <Plus aria-hidden="true" size={15} />}
            {saving ? "Saving..." : editingId ? "Save changes" : "Add banner"}
          </button>
        </form>
      </div>
    </section>
  )
}
