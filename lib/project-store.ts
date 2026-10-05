import { type ResultSetHeader, type RowDataPacket } from "mysql2/promise"
import { getDatabasePool } from "@/lib/database"
import { findAvailableProjectCode, type Project, type ProjectCategory } from "@/lib/projects"
import { getProjectImage } from "@/lib/project-images"
import { findProjectDemoVideo } from "@/lib/project-demo-videos"

type ProjectRow = RowDataPacket & {
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

const projectColumns = `
  project_number, id, code, title, description, category, image_url, demo_video, technologies,
  role, live_demo_url, source_code_url, price, is_published, updated_at
`

export async function readProjects(): Promise<Project[]> {
  const [rows] = await getDatabasePool().query<ProjectRow[]>(
    `SELECT ${projectColumns} FROM projects ORDER BY updated_at DESC, id ASC`,
  )
  const projects = rows.map(toProject)
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
  const pool = getDatabasePool()
  const existingProjects = await readProjects()
  let code = findAvailableProjectCode(project.title, existingProjects.map((entry) => entry.code))

  for (;;) {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO projects (
           id, code, title, description, category, image_url, demo_video, technologies,
           role, live_demo_url, source_code_url, price, is_published, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          project.id,
          code,
          project.title,
          project.description,
          project.category,
          project.imageUrl,
          project.demoVideo ?? null,
          JSON.stringify(project.technologies),
          project.role,
          project.liveDemoUrl,
          project.sourceCodeUrl,
          project.price,
          project.isPublished,
          project.updatedAt,
        ],
      )
      return { ...project, projectNumber: result.insertId, code }
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "ER_DUP_ENTRY") {
        throw error
      }

      const [rows] = await pool.execute<(RowDataPacket & { id: string })[]>(
        "SELECT id FROM projects WHERE id = ? LIMIT 1",
        [project.id],
      )
      if (rows.length > 0) throw error

      const [codeRows] = await pool.execute<(RowDataPacket & { code: string })[]>(
        "SELECT code FROM projects WHERE code = ? LIMIT 1",
        [code],
      )
      if (codeRows.length === 0) throw error
      code = findAvailableProjectCode(
        project.title,
        [...existingProjects.map((entry) => entry.code), code],
      )
    }
  }
}

export async function updateProject(project: Omit<Project, "projectNumber">): Promise<boolean> {
  const [result] = await getDatabasePool().execute<ResultSetHeader>(
    `UPDATE projects
     SET title = ?, description = ?, category = ?, image_url = ?, demo_video = ?,
         technologies = ?, role = ?, live_demo_url = ?, source_code_url = ?,
         price = ?, is_published = ?, updated_at = ?
     WHERE id = ?`,
    [
      project.title,
      project.description,
      project.category,
      project.imageUrl,
      project.demoVideo ?? null,
      JSON.stringify(project.technologies),
      project.role,
      project.liveDemoUrl,
      project.sourceCodeUrl,
      project.price,
      project.isPublished,
      project.updatedAt,
      project.id,
    ],
  )
  return result.affectedRows > 0
}

export async function deleteProject(id: string): Promise<boolean> {
  const [result] = await getDatabasePool().execute<ResultSetHeader>("DELETE FROM projects WHERE id = ?", [id])
  return result.affectedRows > 0
}
