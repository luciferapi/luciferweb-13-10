import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { createProject, deleteProject, readProjects, updateProject } from "@/lib/project-store"
import { PROJECT_CATEGORIES, type Project } from "@/lib/projects"
import { isProjectDemoVideoName } from "@/lib/project-demo-videos"
import { requireOwnerAccess } from "@/lib/owner-access"

export const runtime = "nodejs"

const projectInput = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  category: z.enum(PROJECT_CATEGORIES),
  imageUrl: z.string().trim().max(500).refine((value) => !value || (value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//i.test(value)),
  demoVideo: z.string().trim().max(500).refine((value) => !value || isProjectDemoVideoName(value) || /^https?:\/\//i.test(value)),
  technologies: z.array(z.string().trim().min(1).max(40)).max(12),
  role: z.string().trim().max(300),
  liveDemoUrl: z.string().trim().max(300).refine((value) => !value || /^https?:\/\//i.test(value)),
  sourceCodeUrl: z.string().trim().max(300).refine((value) => !value || /^https?:\/\//i.test(value)),
  price: z.string().trim().max(100),
  isPublished: z.boolean(),
})

const idInput = z.object({ id: z.string().min(1).max(100) })

export async function GET() {
  const unauthorized = await requireOwnerAccess()
  if (unauthorized) return unauthorized

  try {
    return NextResponse.json({ projects: await readProjects() })
  } catch (error) {
    console.error("Could not read project data from the database.", error)
    return NextResponse.json({ error: "Could not read the project data." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireOwnerAccess()
  if (unauthorized) return unauthorized

  const parsed = projectInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Check the project details and try again." }, { status: 400 })

  const project: Omit<Project, "projectNumber"> = { id: randomUUID(), code: "", ...parsed.data, updatedAt: new Date().toISOString() }

  try {
    const savedProject = await createProject(project)
    return NextResponse.json({ project: savedProject }, { status: 201 })
  } catch (error) {
    console.error("Could not save project data to the database.", error)
    return NextResponse.json({ error: "Could not save the project data." }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const unauthorized = await requireOwnerAccess()
  if (unauthorized) return unauthorized

  const parsed = z.object({ ...projectInput.shape, ...idInput.shape }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Check the project details and try again." }, { status: 400 })

  try {
    const projectToUpdate: Omit<Project, "projectNumber"> = { ...parsed.data, code: "", updatedAt: new Date().toISOString() }
    if (!await updateProject(projectToUpdate)) return NextResponse.json({ error: "Project not found." }, { status: 404 })
    const updatedProject = (await readProjects()).find((project) => project.id === parsed.data.id)
    if (!updatedProject) return NextResponse.json({ error: "Updated project could not be reloaded." }, { status: 500 })
    return NextResponse.json({ project: updatedProject })
  } catch (error) {
    console.error("Could not update project data in the database.", error)
    return NextResponse.json({ error: "Could not update the project data." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireOwnerAccess()
  if (unauthorized) return unauthorized

  const parsed = idInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid project identifier." }, { status: 400 })

  try {
    if (!await deleteProject(parsed.data.id)) return NextResponse.json({ error: "Project not found." }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Could not delete project data from the database.", error)
    return NextResponse.json({ error: "Could not delete the project." }, { status: 500 })
  }
}