"use client"

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react"
import { ExternalLink, LoaderCircle, Plus, Save, Trash2, Upload } from "lucide-react"
import { findAvailableProjectCode, PROJECT_CATEGORIES, type Project } from "@/lib/projects"
import { OwnerApiEndpointsPanel } from "@/components/owner-api-endpoints-panel"

type OwnerFilter = "all" | "api" | "projects"
type OwnerSection = "projects" | "endpoints" | "stats" | "graph" | "users"

function ProjectFields({
  project,
  projectCodePreview,
  onProjectTitleChange,
  uploadingImage,
  onUploadImage,
  uploadingVideo,
  onUploadVideo,
  uploadingSource,
  onUploadSource,
  demoVideos,
}: {
  project?: Project
  projectCodePreview: string
  onProjectTitleChange: (title: string) => void
  uploadingImage: boolean
  onUploadImage: (event: ChangeEvent<HTMLInputElement>) => void
  uploadingVideo: boolean
  onUploadVideo: (event: ChangeEvent<HTMLInputElement>) => void
  uploadingSource: boolean
  onUploadSource: (event: ChangeEvent<HTMLInputElement>) => void
  demoVideos: string[]
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="imageUrl" defaultValue={project?.imageUrl ?? ""} />
      <label className="space-y-2 text-sm font-medium md:col-span-2">
        Project ID number
        <input aria-label="Unique project ID number" readOnly value={project ? String(project.projectNumber) : "Assigned when saved"} className="h-11 w-full rounded-lg border border-border bg-muted px-3 font-mono text-xs text-muted-foreground" />
        <span className="block text-xs font-normal text-muted-foreground">
          {project ? "Unique numeric ID assigned by the database." : "A unique number will be assigned automatically when you save."}
        </span>
      </label>
      <label className="space-y-2 text-sm font-medium md:col-span-2">
        Project code
        <input aria-label="Unique project code" readOnly value={project?.code ?? projectCodePreview} className="h-11 w-full rounded-lg border border-border bg-muted px-3 font-mono text-xs text-muted-foreground" />
        <span className="block text-xs font-normal text-muted-foreground">
          {project ? "Stable code used by this project's URL and linked assets." : "Generated from the project name as you type. The final code is reserved when you save."}
        </span>
      </label>
      <label className="space-y-2 text-sm font-medium">
        Project name
        <input name="title" required maxLength={100} defaultValue={project?.title} onChange={(event) => onProjectTitleChange(event.target.value)} placeholder="Project name" className="h-11 w-full rounded-lg border border-border bg-card px-3 text-foreground outline-none focus:border-cyan-400" />
      </label>
      <label className="space-y-2 text-sm font-medium">
        Category
        <select name="category" defaultValue={project?.category ?? PROJECT_CATEGORIES[0]} className="h-11 w-full rounded-lg border border-border bg-card px-3 text-foreground outline-none focus:border-cyan-400">
          {PROJECT_CATEGORIES.map((category) => <option key={category} value={category}>{category === "API" ? "APIs" : category}</option>)}
        </select>
      </label>
      <label className="space-y-2 text-sm font-medium">
        Project image
        {project ? (
          <>
            <span className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <Upload aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                aria-label={`Upload image for ${project.title}`}
                onChange={onUploadImage}
                disabled={uploadingImage}
                className="min-w-0 flex-1 text-xs text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-foreground disabled:opacity-50"
              />
            </span>
            <span className="block text-xs font-normal text-muted-foreground">JPG, PNG, WebP, or GIF · max 5 MB · filename uses the project code</span>
          </>
        ) : <span className="block rounded-lg border border-border bg-card px-3 py-3 text-xs font-normal leading-5 text-muted-foreground">Save the project first to generate its unique code, then upload linked media.</span>}
      </label>
      <label className="space-y-2 text-sm font-medium">
        Demo video
        {project ? (
          <>
            <span className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <Upload aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="file"
                accept="video/mp4,video/x-m4v,video/quicktime,video/webm"
                aria-label={`Upload demo video for ${project.title}`}
                onChange={onUploadVideo}
                disabled={uploadingVideo}
                className="min-w-0 flex-1 text-xs text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-foreground disabled:opacity-50"
              />
            </span>
            <select name="demoVideo" defaultValue={project.demoVideo ?? ""} className="h-11 w-full rounded-lg border border-border bg-card px-3 text-foreground outline-none focus:border-cyan-400">
              <option value="">No demo video</option>
              {project.demoVideo && !demoVideos.includes(project.demoVideo) ? <option value={project.demoVideo}>{/^https?:\/\//i.test(project.demoVideo) ? "Saved remote video" : `${project.demoVideo} (file missing)`}</option> : null}
              {demoVideos.map((video) => <option key={video} value={video}>{video}</option>)}
            </select>
            <span className="block text-xs font-normal text-muted-foreground">MP4, M4V, MOV, or WebM · max 100 MB · saved as {project.code}.extension. Save changes to link the video.</span>
          </>
        ) : <span className="block rounded-lg border border-border bg-card px-3 py-3 text-xs font-normal leading-5 text-muted-foreground">Save the project first to generate its unique code, then upload linked media.</span>}
      </label>
      <label className="space-y-2 text-sm font-medium">
        Paid source code bundle
        {project ? (
          <span className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
            <Upload aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              aria-label={`Upload source code ZIP for ${project.title}`}
              onChange={onUploadSource}
              disabled={uploadingSource}
              className="min-w-0 flex-1 text-xs text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-foreground disabled:opacity-50"
            />
          </span>
        ) : (
          <span className="block rounded-lg border border-border bg-card px-3 py-3 text-xs font-normal leading-5 text-muted-foreground">Save the entry first, then select it from the list to upload its ZIP bundle.</span>
        )}
        <span className="block text-xs font-normal text-muted-foreground">ZIP archive only · max 100 MB · saved under source codes/{project?.code ?? "project-code"}.zip</span>
      </label>
      <label className="space-y-2 text-sm font-medium">
        Technologies
        <input name="technologies" defaultValue={project?.technologies.join(", ")} placeholder="Next.js, TypeScript, ..." className="h-11 w-full rounded-lg border border-border bg-card px-3 text-foreground outline-none focus:border-cyan-400" />
      </label>
      <label className="space-y-2 text-sm font-medium">
        Role / contribution
        <input name="role" maxLength={300} defaultValue={project?.role} placeholder="What did you contribute?" className="h-11 w-full rounded-lg border border-border bg-card px-3 text-foreground outline-none focus:border-cyan-400" />
      </label>
      <label className="space-y-2 text-sm font-medium">
        Live demo URL
        <input name="liveDemoUrl" type="url" defaultValue={project?.liveDemoUrl} placeholder="https://example.com" className="h-11 w-full rounded-lg border border-border bg-card px-3 text-foreground outline-none focus:border-cyan-400" />
      </label>
      <label className="space-y-2 text-sm font-medium">
        GitHub / source URL
        <input name="sourceCodeUrl" type="url" defaultValue={project?.sourceCodeUrl} placeholder="https://github.com/..." className="h-11 w-full rounded-lg border border-border bg-card px-3 text-foreground outline-none focus:border-cyan-400" />
      </label>
      <label className="space-y-2 text-sm font-medium">
        Price (INR)
        <input name="price" type="number" min="1" step="0.01" defaultValue={project?.price.replace(/^₹\s*/, "")} placeholder="1.00 minimum" className="h-11 w-full rounded-lg border border-border bg-card px-3 text-foreground outline-none focus:border-cyan-400" />
      </label>
      <label className="space-y-2 text-sm font-medium md:col-span-2">
        Description
        <textarea name="description" required maxLength={500} rows={3} defaultValue={project?.description} placeholder="What does this project do?" className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-foreground outline-none focus:border-cyan-400" />
      </label>
    </div>
  )
}

export function OwnerProjectsPanel() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadingSource, setUploadingSource] = useState(false)
  const [demoVideos, setDemoVideos] = useState<string[]>([])
  const [filter, setFilter] = useState<OwnerFilter>("all")
  const [section, setSection] = useState<OwnerSection>("projects")
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [newProjectTitle, setNewProjectTitle] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const editingProject = projects.find((project) => project.id === editingProjectId)
  const projectCodePreview = findAvailableProjectCode(newProjectTitle, projects.map((project) => project.code))
  const apiCount = projects.filter((project) => project.category === "API").length
  const projectCount = projects.length - apiCount
  const publishedCount = projects.filter((project) => project.isPublished).length
  const categoryCounts = PROJECT_CATEGORIES.map((category) => ({
    category,
    count: projects.filter((project) => project.category === category).length,
  }))
  const maxCategoryCount = Math.max(1, ...categoryCounts.map(({ count }) => count))
  const visibleProjects = projects.filter((project) => {
    if (filter === "api") return project.category === "API"
    if (filter === "projects") return project.category !== "API"
    return true
  })

  async function loadProjects() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/owner/projects", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not load projects.")
      setProjects(result.projects)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load projects.")
    } finally {
      setLoading(false)
    }
  }

  async function loadDemoVideos() {
    try {
      const response = await fetch("/api/owner/demo-videos", { cache: "no-store" })
      const result = await response.json()
      if (response.ok && Array.isArray(result.videos)) setDemoVideos(result.videos)
    } catch {
      setDemoVideos([])
    }
  }

  useEffect(() => {
    void loadProjects()
    void loadDemoVideos()
  }, [])

  async function uploadProjectImage(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    const form = input.closest("form")
    const imageField = form?.elements.namedItem("imageUrl")
    input.value = ""
    if (!file || !(imageField instanceof HTMLInputElement)) return

    setUploadingImage(true)
    setError("")
    setNotice("")
    try {
      const formData = new FormData()
      formData.set("image", file)
      if (!editingProject) throw new Error("Save the project before uploading its image.")
      formData.set("project_code", editingProject.code)
      const response = await fetch("/api/owner/projects/upload", { method: "POST", body: formData })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not upload image.")
      imageField.value = result.imageUrl
      setNotice("Image uploaded. Save the project to keep its image path.")
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload image.")
    } finally {
      setUploadingImage(false)
    }
  }

  async function uploadProjectVideo(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    const form = input.closest("form")
    const videoField = form?.elements.namedItem("demoVideo")
    input.value = ""
    if (!file || !editingProject || !(videoField instanceof HTMLSelectElement)) return

    setUploadingVideo(true)
    setError("")
    setNotice("")
    try {
      const formData = new FormData()
      formData.set("project_code", editingProject.code)
      formData.set("video", file)
      const response = await fetch("/api/owner/projects/video-upload", { method: "POST", body: formData })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not upload demo video.")
      const filename = typeof result.filename === "string" ? result.filename : ""
      const remoteUrl = typeof result.url === "string" ? result.url : ""
      setDemoVideos((videos) => [...new Set([...videos, filename])].filter(Boolean).sort())
      videoField.value = remoteUrl || filename
      setNotice(remoteUrl ? `Demo video uploaded to Cloudflare R2 as ${filename}. Save changes to link it to this project.` : `Demo video uploaded as ${filename}. Save changes to link it to this project.`)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload demo video.")
    } finally {
      setUploadingVideo(false)
    }
  }

  async function uploadProjectSource(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ""
    if (!file || !editingProject) return

    setUploadingSource(true)
    setError("")
    setNotice("")
    try {
      const formData = new FormData()
      formData.set("project_code", editingProject.code)
      formData.set("source", file)
      const response = await fetch("/api/owner/projects/source-upload", { method: "POST", body: formData })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not upload source bundle.")
      setNotice(`Source bundle uploaded as ${result.filename}. Purchases can now download it after payment.`)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload source bundle.")
    } finally {
      setUploadingSource(false)
    }
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const project = {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      category: String(formData.get("category") ?? "API"),
      imageUrl: String(formData.get("imageUrl") ?? ""),
      demoVideo: String(formData.get("demoVideo") ?? ""),
      technologies: String(formData.get("technologies") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      role: String(formData.get("role") ?? ""),
      liveDemoUrl: String(formData.get("liveDemoUrl") ?? ""),
      sourceCodeUrl: String(formData.get("sourceCodeUrl") ?? ""),
      price: String(formData.get("price") ?? ""),
      isPublished: formData.get("isPublished") === "on",
    }

    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/owner/projects", {
        method: editingProject ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingProject ? { ...project, id: editingProject.id } : project),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not save project.")
      await loadProjects()
      setNotice(editingProject ? "Entry updated." : "Entry added.")
      if (!editingProject) {
        form.reset()
        setNewProjectTitle("")
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save project.")
    } finally {
      setBusy(false)
    }
  }

  async function deleteProject(id: string) {
    if (!window.confirm("Delete this project permanently?")) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/owner/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not delete project.")
      await loadProjects()
      if (id === editingProjectId) setEditingProjectId(null)
      setNotice("Project deleted.")
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete project.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <section className="border-y border-amber-500/30 bg-amber-500/[0.06] py-4" role="note">
        <div className="mx-auto max-w-6xl px-6 text-sm leading-6 text-amber-800 dark:text-amber-200">
          Owner-only tools. Access is restricted to the authorized owner account.
        </div>
      </section>

      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="tablist" aria-label="Owner dashboard sections">
        {([
          { id: "projects", number: "01", label: "Projects & APIs" },
          { id: "endpoints", number: "02", label: "API Endpoints" },
          { id: "stats", number: "03", label: "Stats" },
          { id: "graph", number: "04", label: "Graph" },
          { id: "users", number: "05", label: "Total Users" },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={section === item.id}
            onClick={() => setSection(item.id)}
            className={`flex min-h-12 items-center gap-3 rounded-lg border px-4 text-left text-sm font-semibold transition ${section === item.id ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <span className="font-mono text-xs opacity-60">{item.number}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {error ? <p role="alert" className="border-l-2 border-rose-500 pl-3 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      {notice ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}

      {section === "projects" ? (
        <div className="space-y-8">
      <form key={editingProject?.id ?? "new-entry"} onSubmit={(event) => void saveProject(event)} className="space-y-4 border-y border-border py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">Shared API and project cards</p>
            <h2 className="mt-2 text-xl font-bold">{editingProject ? `Edit ${editingProject.title}` : "Add API card or project"}</h2>
          </div>
          {editingProject ? (
            <button type="button" onClick={() => { setEditingProjectId(null); setNewProjectTitle(""); }} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">
              New entry
            </button>
          ) : null}
        </div>
        <ProjectFields project={editingProject} projectCodePreview={projectCodePreview} onProjectTitleChange={setNewProjectTitle} uploadingImage={uploadingImage} onUploadImage={uploadProjectImage} uploadingVideo={uploadingVideo} onUploadVideo={uploadProjectVideo} uploadingSource={uploadingSource} onUploadSource={uploadProjectSource} demoVideos={demoVideos} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input name="isPublished" type="checkbox" defaultChecked={editingProject?.isPublished ?? false} className="size-4 accent-cyan-500" />
            {editingProject ? "Published on public page" : "Publish immediately"}
          </label>
          <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-50">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : editingProject ? <Save className="size-4" /> : <Plus className="size-4" />}
            {editingProject ? "Save changes" : "Add entry"}
          </button>
        </div>
      </form>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-lg font-bold">Content entries <span className="font-mono text-sm font-normal text-muted-foreground">{projects.length}</span></h2>
          <div className="mt-3 inline-flex rounded-lg border border-border p-1" role="tablist" aria-label="Filter owner entries">
            {([
              { id: "all", label: "All", count: projects.length },
              { id: "api", label: "APIs", count: apiCount },
              { id: "projects", label: "Projects", count: projectCount },
            ] as const).map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={filter === option.id}
                onClick={() => setFilter(option.id)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${filter === option.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              >
                {option.label} <span className="ml-1 font-mono text-xs opacity-70">{option.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <a href="/api-explorer" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-cyan-700 hover:underline dark:text-cyan-200">
            Preview API Explorer <ExternalLink aria-hidden="true" className="size-4" />
          </a>
          <a href="/projects" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-cyan-700 hover:underline dark:text-cyan-200">
            Preview Projects <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading projects…</p> : null}
      {!loading && visibleProjects.length === 0 ? <p className="py-8 text-sm text-muted-foreground">No {filter === "api" ? "API" : filter === "projects" ? "project" : "content"} entries yet.</p> : null}

      <div className="divide-y divide-border border-y border-border">
        {visibleProjects.map((project) => (
          <article key={project.id} className="flex items-center gap-3 py-4">
            <button
              type="button"
              aria-pressed={editingProjectId === project.id}
              onClick={() => setEditingProjectId(project.id)}
              className={`flex min-w-0 flex-1 items-center justify-between gap-4 rounded-lg px-3 py-3 text-left transition ${editingProjectId === project.id ? "bg-muted" : "hover:bg-muted/60"}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{project.title}</span>
                <span className="mt-1 block font-mono text-[10px] text-muted-foreground">ID #{project.projectNumber} · {project.code}</span>
              </span>
              <span className="shrink-0 rounded-md border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {project.category === "API" ? "API" : `Project · ${project.category}`}
              </span>
            </button>
            <span className={`shrink-0 text-xs ${project.isPublished ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>
              {project.isPublished ? "Published" : "Draft"}
            </span>
            <button type="button" disabled={busy} onClick={() => void deleteProject(project.id)} aria-label={`Delete ${project.title}`} title="Delete entry" className="grid size-10 shrink-0 place-items-center rounded-lg border border-border text-rose-600 hover:border-rose-400 disabled:opacity-50 dark:text-rose-300">
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </article>
        ))}
      </div>
        </div>
      ) : null}

      {section === "endpoints" ? <OwnerApiEndpointsPanel /> : null}

      {section === "stats" ? (
        <section aria-labelledby="owner-stats-heading">
          <h2 id="owner-stats-heading" className="text-xl font-bold">Content stats</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total entries", value: projects.length },
              { label: "Published", value: publishedCount },
              { label: "Drafts", value: projects.length - publishedCount },
              { label: "API entries", value: apiCount },
            ].map((stat) => (
              <article key={stat.label} className="rounded-lg border border-border bg-card/70 p-5">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="mt-3 font-mono text-4xl font-bold">{stat.value}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {section === "graph" ? (
        <section aria-labelledby="owner-graph-heading" className="max-w-3xl">
          <h2 id="owner-graph-heading" className="text-xl font-bold">Entries by category</h2>
          <div role="img" aria-label="Horizontal bar chart of entries by category" className="mt-5 space-y-5 rounded-lg border border-border bg-card/70 p-5 sm:p-7">
            {categoryCounts.map(({ category, count }) => (
              <div key={category} className="grid grid-cols-[6rem_1fr_2rem] items-center gap-3 sm:grid-cols-[8rem_1fr_2rem]">
                <span className="text-sm font-medium">{category === "API" ? "APIs" : category}</span>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-cyan-500 transition-[width] duration-500" style={{ width: `${(count / maxCategoryCount) * 100}%` }} />
                </div>
                <span className="text-right font-mono text-sm text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {section === "users" ? (
        <section aria-labelledby="owner-users-heading" className="max-w-2xl rounded-lg border border-border bg-card/70 p-6 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">Account overview</p>
          <h2 id="owner-users-heading" className="mt-3 text-2xl font-bold">Total Users</h2>
          <p className="mt-5 text-3xl font-black text-muted-foreground">Not tracked</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Accounts are stored in Hostinger MySQL. Aggregate user totals are not yet shown on this dashboard.</p>
        </section>
      ) : null}
    </div>
  )
}