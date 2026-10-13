"use client"

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react"
import { ExternalLink, LoaderCircle, Plus, Save, Trash2, Upload } from "lucide-react"
import { findAvailableProjectCode, PROJECT_CATEGORIES, type Project } from "@/features/projects/server/projects"
import { validateUploadFile } from "@/lib/upload-validation"

function isProject(value: unknown): value is Project {
  return typeof value === "object" &&
    value !== null &&
    "projectNumber" in value && typeof value.projectNumber === "number" &&
    "id" in value && typeof value.id === "string" &&
    "code" in value && typeof value.code === "string" &&
    "title" in value && typeof value.title === "string" &&
    "description" in value && typeof value.description === "string" &&
    "category" in value && typeof value.category === "string" && PROJECT_CATEGORIES.some((category) => category === value.category) &&
    "imageUrl" in value && typeof value.imageUrl === "string" &&
    "technologies" in value && Array.isArray(value.technologies) && value.technologies.every((technology) => typeof technology === "string") &&
    (!("demoVideo" in value) || typeof value.demoVideo === "string") &&
    "role" in value && typeof value.role === "string" &&
    "liveDemoUrl" in value && typeof value.liveDemoUrl === "string" &&
    "sourceCodeUrl" in value && typeof value.sourceCodeUrl === "string" &&
    "price" in value && typeof value.price === "string" &&
    "isPublished" in value && typeof value.isPublished === "boolean" &&
    "updatedAt" in value && typeof value.updatedAt === "string"
}

type PendingProjectUploads = {
  image: File | null
  video: File | null
  source: File | null
}

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
  pendingUploads,
  isSaving,
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
  pendingUploads: PendingProjectUploads
  isSaving: boolean
}) {
  const categories = project?.category === "API"
    ? PROJECT_CATEGORIES
    : PROJECT_CATEGORIES.filter((category) => category !== "API")

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
          {project ? "Permanent code used by this project's URL, purchase history, and linked assets." : "Title preview only; a unique permanent suffix is added and reserved when you save."}
        </span>
      </label>
      <label className="space-y-2 text-sm font-medium">
        Project name
        <input name="title" required maxLength={100} defaultValue={project?.title} onChange={(event) => onProjectTitleChange(event.target.value)} placeholder="Project name" className="h-11 w-full rounded-lg border border-border bg-card px-3 text-foreground outline-none focus:border-cyan-400" />
      </label>
      <label className="space-y-2 text-sm font-medium">
        Category
        <select name="category" defaultValue={project?.category ?? "Web"} className="h-11 w-full rounded-lg border border-border bg-card px-3 text-foreground outline-none focus:border-cyan-400">
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <label className="space-y-2 text-sm font-medium">
        Project image
        <span className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
          <Upload aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            aria-label={`Upload image for ${project?.title ?? "new project"}`}
            onChange={onUploadImage}
            disabled={uploadingImage || isSaving}
            className="min-w-0 flex-1 text-xs text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-foreground disabled:opacity-50"
          />
        </span>
        {pendingUploads.image ? <span className="block text-xs font-normal text-cyan-700 dark:text-cyan-300">Selected: {pendingUploads.image.name}. It will upload when you {project ? "save changes" : "create the project"}.</span> : null}
        <span className="block text-xs font-normal text-muted-foreground">JPG, PNG, WebP, or GIF · max 5 MB · uploaded to R2 at projects/{project?.code ?? "project-code"}.extension</span>
      </label>
      <label className="space-y-2 text-sm font-medium">
        Demo video
        <span className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
          <Upload aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="file"
            accept="video/mp4,video/x-m4v,video/quicktime,video/webm"
            aria-label={`Upload demo video for ${project?.title ?? "new project"}`}
            onChange={onUploadVideo}
            disabled={uploadingVideo || isSaving}
            className="min-w-0 flex-1 text-xs text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-foreground disabled:opacity-50"
          />
        </span>
        {pendingUploads.video ? <span className="block text-xs font-normal text-cyan-700 dark:text-cyan-300">Selected: {pendingUploads.video.name}. It will upload when you {project ? "save changes" : "create the project"}.</span> : null}
        {project ? (
          <>
            <select name="demoVideo" defaultValue={project.demoVideo ?? ""} className="h-11 w-full rounded-lg border border-border bg-card px-3 text-foreground outline-none focus:border-cyan-400">
              <option value="">No demo video</option>
              {project.demoVideo && !demoVideos.includes(project.demoVideo) ? <option value={project.demoVideo}>{/^https?:\/\//i.test(project.demoVideo) ? "Saved remote video" : `${project.demoVideo} (file missing)`}</option> : null}
              {demoVideos.map((video) => <option key={video} value={video}>{video}</option>)}
            </select>
            <span className="block text-xs font-normal text-muted-foreground">MP4, M4V, MOV, or WebM · max 100 MB · uploaded to R2 at projects/{project.code}.extension. Save changes to link the video.</span>
          </>
        ) : <span className="block text-xs font-normal text-muted-foreground">MP4, M4V, MOV, or WebM · max 100 MB · selected video uploads after the project is created.</span>}
      </label>
      <label className="space-y-2 text-sm font-medium">
        Paid source code bundle
        <span className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
          <Upload aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            aria-label={`Upload source code ZIP for ${project?.title ?? "new project"}`}
            onChange={onUploadSource}
            disabled={uploadingSource || isSaving}
            className="min-w-0 flex-1 text-xs text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-foreground disabled:opacity-50"
          />
        </span>
        {pendingUploads.source ? <span className="block text-xs font-normal text-cyan-700 dark:text-cyan-300">Selected: {pendingUploads.source.name}. It will upload when you {project ? "save changes" : "create the project"}.</span> : null}
        <span className="block text-xs font-normal text-muted-foreground">ZIP archive only · max 100 MB · uploaded privately to R2 at source-bundles/{project?.code ?? "project-code"}.zip</span>
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
  const [pendingUploads, setPendingUploads] = useState<PendingProjectUploads>({ image: null, video: null, source: null })
  const [demoVideos, setDemoVideos] = useState<string[]>([])
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [newProjectTitle, setNewProjectTitle] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const editingProject = projects.find((project) => project.id === editingProjectId)
  const projectCodePreview = findAvailableProjectCode(newProjectTitle, projects.map((project) => project.code))

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
    if (!file) return
    const validationError = validateUploadFile(
      file,
      ["image/jpeg", "image/png", "image/webp", "image/gif"],
      5 * 1024 * 1024,
      "project image",
    )
    if (validationError) {
      setError(validationError)
      return
    }
    if (!editingProject) {
      setPendingUploads((pending) => ({ ...pending, image: file }))
      setNotice(`${file.name} selected. It will upload after the project is created.`)
      setError("")
      return
    }
    if (!(imageField instanceof HTMLInputElement)) return

    setUploadingImage(true)
    setError("")
    setNotice("")
    try {
      const formData = new FormData()
      formData.set("image", file)
      formData.set("project_code", editingProject.code)
      const response = await fetch("/api/owner/projects/upload", { method: "POST", body: formData })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not upload image.")
      if (typeof result.imageUrl !== "string" || typeof result.objectKey !== "string") {
        throw new Error("The image upload response was invalid.")
      }
      imageField.value = result.imageUrl
      setNotice(`Image uploaded to R2 at ${result.objectKey}. Save the project to keep its image URL.`)
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
    if (!file) return
    const validationError = validateUploadFile(
      file,
      ["video/mp4", "video/x-m4v", "video/quicktime", "video/webm"],
      100 * 1024 * 1024,
      "demo video",
    )
    if (validationError) {
      setError(validationError)
      return
    }
    if (!editingProject) {
      setPendingUploads((pending) => ({ ...pending, video: file }))
      setNotice(`${file.name} selected. It will upload after the project is created.`)
      setError("")
      return
    }
    if (!(videoField instanceof HTMLSelectElement)) return

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
      if (
        typeof result.filename !== "string" ||
        typeof result.url !== "string" ||
        typeof result.objectKey !== "string"
      ) {
        throw new Error("The demo video upload response was invalid.")
      }
      const filename = result.filename
      const remoteUrl = result.url
      setDemoVideos((videos) => [...new Set([...videos, filename])].sort())
      if (!Array.from(videoField.options).some((option) => option.value === remoteUrl)) {
        videoField.add(new Option(`R2: ${filename}`, remoteUrl))
      }
      videoField.value = remoteUrl
      setNotice(`Demo video uploaded to R2 at ${result.objectKey}. Save changes to link it to this project.`)
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
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Choose a ZIP source bundle.")
      return
    }
    if (file.size === 0 || file.size > 100 * 1024 * 1024) {
      setError("The ZIP source bundle must be larger than 0 bytes and no larger than 100 MB.")
      return
    }
    if (!editingProject) {
      setPendingUploads((pending) => ({ ...pending, source: file }))
      setNotice(`${file.name} selected. It will upload after the project is created.`)
      setError("")
      return
    }

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
      if (typeof result.filename !== "string" || typeof result.objectKey !== "string") {
        throw new Error("The source bundle upload response was invalid.")
      }
      setNotice(`Source ZIP uploaded privately to R2 at ${result.objectKey}. Purchases can download it after payment.`)
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
    let projectWasSaved = false
    try {
      const response = await fetch("/api/owner/projects", {
        method: editingProject ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingProject ? { ...project, id: editingProject.id } : project),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error
          : "Could not save project."
        throw new Error(message)
      }
      if (typeof result !== "object" || result === null || !("project" in result) || !isProject(result.project)) {
        throw new Error("The saved project response was invalid.")
      }
      const savedProject = result.project
      projectWasSaved = true
      setProjects((current) => [savedProject, ...current.filter((entry) => entry.id !== savedProject.id)])
      setEditingProjectId(savedProject.id)
      setNewProjectTitle(savedProject.title)
      let imageUrl = savedProject.imageUrl
      let demoVideo = savedProject.demoVideo ?? ""

      if (pendingUploads.image) {
        setUploadingImage(true)
        setNotice(`Project saved. Uploading ${pendingUploads.image.name}…`)
        const uploadData = new FormData()
        uploadData.set("project_code", savedProject.code)
        uploadData.set("image", pendingUploads.image)
        const uploadResponse = await fetch("/api/owner/projects/upload", { method: "POST", body: uploadData })
        const uploadResult: unknown = await uploadResponse.json()
        if (!uploadResponse.ok) {
          const message = typeof uploadResult === "object" && uploadResult !== null && "error" in uploadResult && typeof uploadResult.error === "string"
            ? uploadResult.error
            : "Could not upload project image."
          throw new Error(message)
        }
        if (typeof uploadResult !== "object" || uploadResult === null ||
          !("imageUrl" in uploadResult) || typeof uploadResult.imageUrl !== "string" ||
          !("objectKey" in uploadResult) || typeof uploadResult.objectKey !== "string") {
          throw new Error("The image upload response was invalid.")
        }
        imageUrl = uploadResult.imageUrl
      }

      if (pendingUploads.video) {
        setUploadingVideo(true)
        setNotice(`Project saved. Uploading ${pendingUploads.video.name}…`)
        const uploadData = new FormData()
        uploadData.set("project_code", savedProject.code)
        uploadData.set("video", pendingUploads.video)
        const uploadResponse = await fetch("/api/owner/projects/video-upload", { method: "POST", body: uploadData })
        const uploadResult: unknown = await uploadResponse.json()
        if (!uploadResponse.ok) {
          const message = typeof uploadResult === "object" && uploadResult !== null && "error" in uploadResult && typeof uploadResult.error === "string"
            ? uploadResult.error
            : "Could not upload demo video."
          throw new Error(message)
        }
        if (typeof uploadResult !== "object" || uploadResult === null ||
          !("url" in uploadResult) || typeof uploadResult.url !== "string" ||
          !("filename" in uploadResult) || typeof uploadResult.filename !== "string" ||
          !("objectKey" in uploadResult) || typeof uploadResult.objectKey !== "string") {
          throw new Error("The demo video upload response was invalid.")
        }
        demoVideo = uploadResult.url
        const filename = uploadResult.filename
        setDemoVideos((videos) => [...new Set([...videos, filename])].sort())
      }

      if (imageUrl !== savedProject.imageUrl || demoVideo !== (savedProject.demoVideo ?? "")) {
        const mediaResponse = await fetch("/api/owner/projects", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...savedProject,
            imageUrl,
            demoVideo,
            id: savedProject.id,
          }),
        })
        const mediaResult: unknown = await mediaResponse.json()
        if (!mediaResponse.ok) {
          const message = typeof mediaResult === "object" && mediaResult !== null && "error" in mediaResult && typeof mediaResult.error === "string"
            ? mediaResult.error
            : "Could not save uploaded media links."
          throw new Error(message)
        }
        if (typeof mediaResult !== "object" || mediaResult === null || !("project" in mediaResult) || !isProject(mediaResult.project)) {
          throw new Error("The saved project response was invalid after media upload.")
        }
        const updatedProject = mediaResult.project
        setProjects((current) => current.map((entry) => entry.id === updatedProject.id ? updatedProject : entry))
      }

      if (pendingUploads.source) {
        setUploadingSource(true)
        setNotice(`Project saved. Uploading ${pendingUploads.source.name}…`)
        const uploadData = new FormData()
        uploadData.set("project_code", savedProject.code)
        uploadData.set("source", pendingUploads.source)
        const uploadResponse = await fetch("/api/owner/projects/source-upload", { method: "POST", body: uploadData })
        const uploadResult: unknown = await uploadResponse.json()
        if (!uploadResponse.ok) {
          const message = typeof uploadResult === "object" && uploadResult !== null && "error" in uploadResult && typeof uploadResult.error === "string"
            ? uploadResult.error
            : "Could not upload source code bundle."
          throw new Error(message)
        }
        if (typeof uploadResult !== "object" || uploadResult === null ||
          !("filename" in uploadResult) || typeof uploadResult.filename !== "string" ||
          !("objectKey" in uploadResult) || typeof uploadResult.objectKey !== "string") {
          throw new Error("The source ZIP upload response was invalid.")
        }
        setPendingUploads((pending) => ({ ...pending, source: null }))
      }

      const hadStagedMedia = Boolean(pendingUploads.image || pendingUploads.video || pendingUploads.source)
      if (hadStagedMedia) {
        setPendingUploads({ image: null, video: null, source: null })
        setNotice("Project saved and selected files uploaded to R2.")
      } else {
        setNotice(editingProject ? "Project updated." : "Project added.")
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save project.")
      if (projectWasSaved) setNotice("Project saved, but one or more selected files did not finish uploading. Save again to retry.")
    } finally {
      setUploadingImage(false)
      setUploadingVideo(false)
      setUploadingSource(false)
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
    <div className="owner-projects space-y-8">
      <section className="owner-access-note border-y border-amber-500/30 bg-amber-500/[0.06] py-4" role="note">
        <div className="mx-auto max-w-6xl px-6 text-sm leading-6 text-amber-800 dark:text-amber-200">
          Owner-only tools. Access is restricted to the authorized owner account.
        </div>
      </section>

      {error ? <p role="alert" className="border-l-2 border-rose-500 pl-3 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      {notice ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}

      <form key={editingProject?.id ?? "new-project"} onSubmit={(event) => void saveProject(event)} className="space-y-4 rounded-xl border border-border bg-card/30 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">Project catalog</p>
            <h2 className="mt-2 text-xl font-bold">{editingProject ? `Edit ${editingProject.title}` : "Create a project"}</h2>
          </div>
          {editingProject ? (
            <button type="button" disabled={busy} onClick={() => { setEditingProjectId(null); setNewProjectTitle(""); setPendingUploads({ image: null, video: null, source: null }); setNotice(""); setError(""); }} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50">
              New project
            </button>
          ) : null}
        </div>
        <ProjectFields project={editingProject} projectCodePreview={projectCodePreview} onProjectTitleChange={setNewProjectTitle} uploadingImage={uploadingImage} onUploadImage={uploadProjectImage} uploadingVideo={uploadingVideo} onUploadVideo={uploadProjectVideo} uploadingSource={uploadingSource} onUploadSource={uploadProjectSource} demoVideos={demoVideos} pendingUploads={pendingUploads} isSaving={busy} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input name="isPublished" type="checkbox" defaultChecked={editingProject?.isPublished ?? false} className="size-4 accent-cyan-500" />
            {editingProject ? "Published on public page" : "Publish immediately"}
          </label>
          <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-50">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : editingProject ? <Save className="size-4" /> : <Plus className="size-4" />}
            {editingProject ? "Save project" : "Create project"}
          </button>
        </div>
      </form>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-lg font-bold">Projects <span className="font-mono text-sm font-normal text-muted-foreground">{projects.length}</span></h2>
          <p className="mt-1 text-sm text-muted-foreground">Create and edit project listings. Manage API Explorer endpoints in API Management.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <a href="/projects" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-cyan-700 hover:underline dark:text-cyan-200">
            Preview Projects <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading projects…</p> : null}
      {!loading && projects.length === 0 ? <p className="py-8 text-sm text-muted-foreground">No projects have been added yet.</p> : null}

      <div className="divide-y divide-border border-y border-border">
        {projects.map((project) => (
          <article key={project.id} className="flex items-center gap-3 py-4">
            <button
              type="button"
              disabled={busy}
              aria-pressed={editingProjectId === project.id}
              onClick={() => {
                setEditingProjectId(project.id)
                setPendingUploads({ image: null, video: null, source: null })
              }}
              className={`flex min-w-0 flex-1 items-center justify-between gap-4 rounded-lg px-3 py-3 text-left transition disabled:opacity-50 ${editingProjectId === project.id ? "bg-muted" : "hover:bg-muted/60"}`}
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
  )
}
