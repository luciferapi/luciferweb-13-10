import "server-only"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { findAvailableProjectCode, type Project, type ProjectCategory } from "@/features/projects/server/projects"
import { getProjectImage } from "@/features/projects/server/project-images"
import { findProjectDemoVideo } from "@/features/projects/server/project-demo-videos"

type ProjectRow = {
  project_number: number
  id: string
  code: string
  title: string
  description: string
  category: ProjectCategory
  image_url: string
  demo_video: string | null
  technologies: string[]
  role: string
  live_demo_url: string
  source_code_url: string
  price: string
  is_published: boolean | number
  updated_at: string
}

function getAdminClient() {
  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase admin access is not configured.")
  return client
}

function toProject(row: ProjectRow): Project {
  return {
    projectNumber: row.project_number,
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    category: row.category,
    imageUrl: row.image_url,
    ...(row.demo_video ? { demoVideo: row.demo_video } : {}),
    technologies: row.technologies,
    role: row.role,
    liveDemoUrl: row.live_demo_url,
    sourceCodeUrl: row.source_code_url,
    price: row.price,
    isPublished: Boolean(row.is_published),
    updatedAt: row.updated_at,
  }
}

const projectColumns =
  "project_number, id, code, title, description, category, image_url, demo_video, technologies, role, live_demo_url, source_code_url, price, is_published, updated_at"

export async function readProjects(): Promise<Project[]> {
  const { data, error } = await getAdminClient()
    .from("projects")
    .select(projectColumns)
    .order("updated_at", { ascending: false })
    .order("id")

  if (error) throw error
  const projects = ((data ?? []) as ProjectRow[]).map(toProject)
  return Promise.all(projects.map(async (project) => {
    const [image, demoVideo] = await Promise.all([
      project.imageUrl ? null : getProjectImage(project.code),
      project.demoVideo ? null : findProjectDemoVideo(project.code),
    ])
    return {
      ...project,
      ...(image ? { imageUrl: image.url } : {}),
      ...(demoVideo ? { demoVideo } : {}),
    }
  }))
}

export async function createProject(project: Omit<Project, "projectNumber">): Promise<Project> {
  const client = getAdminClient()
  const existingProjects = await readProjects()
  const existingCodes = existingProjects.map((entry) => entry.code)
  let code = findAvailableProjectCode(project.title, existingCodes)

  for (;;) {
    const { data, error } = await client
      .from("projects")
      .insert({
        id: project.id,
        code,
        title: project.title,
        description: project.description,
        category: project.category,
        image_url: project.imageUrl,
        demo_video: project.demoVideo ?? null,
        technologies: project.technologies,
        role: project.role,
        live_demo_url: project.liveDemoUrl,
        source_code_url: project.sourceCodeUrl,
        price: project.price,
        is_published: project.isPublished,
        updated_at: project.updatedAt,
      })
      .select(projectColumns)
      .single()

    if (!error && data) return { ...project, projectNumber: (data as ProjectRow).project_number, code }
    if (error?.code !== "23505") {
      if (error) throw error
      throw new Error("The project was not saved.")
    }

    const { data: existingId, error: idError } = await client
      .from("projects")
      .select("id")
      .eq("id", project.id)
      .maybeSingle()
    if (idError) throw idError
    if (existingId) throw error

    const { data: conflictingCode, error: codeError } = await client
      .from("projects")
      .select("code")
      .eq("code", code)
      .maybeSingle()
    if (codeError) throw codeError
    if (!conflictingCode) throw error

    const { data: codes, error: codesError } = await client.from("projects").select("code")
    if (codesError) throw codesError
    code = findAvailableProjectCode(
      project.title,
      [...existingCodes, ...(codes ?? []).map((entry) => entry.code)],
    )
    existingCodes.push(code)
  }
}

export async function updateProject(project: Omit<Project, "projectNumber">): Promise<boolean> {
  const { data, error } = await getAdminClient()
    .from("projects")
    .update({
      title: project.title,
      description: project.description,
      category: project.category,
      image_url: project.imageUrl,
      demo_video: project.demoVideo ?? null,
      technologies: project.technologies,
      role: project.role,
      live_demo_url: project.liveDemoUrl,
      source_code_url: project.sourceCodeUrl,
      price: project.price,
      is_published: project.isPublished,
      updated_at: project.updatedAt,
    })
    .eq("id", project.id)
    .select("id")

  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function deleteProject(id: string): Promise<boolean> {
  const { data, error } = await getAdminClient()
    .from("projects")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) throw error
  return (data?.length ?? 0) > 0
}
