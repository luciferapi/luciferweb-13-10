import "server-only"
import { getMysqlPool, selectMysqlRows } from "@/lib/mysql"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { findAvailableProjectCode, type Project, type ProjectCategory } from "@/features/projects/server/projects"
import { getProjectImage } from "@/features/projects/server/project-images"
import { findProjectDemoVideo } from "@/features/projects/server/project-demo-videos"

type ProjectRow = RowDataPacket & {
  project_number: number | string
  id: string
  code: string
  title: string
  description: string
  category: ProjectCategory
  image_url: string
  demo_video: string | null
  technologies: string[] | string
  role: string
  live_demo_url: string
  source_code_url: string
  price: string
  is_published: boolean | number
  updated_at: string | Date
}

function toProject(row: ProjectRow): Project {
  const technologies: unknown = typeof row.technologies === "string"
    ? JSON.parse(row.technologies)
    : row.technologies
  if (!Array.isArray(technologies) || !technologies.every((technology) => typeof technology === "string")) {
    throw new Error(`Project ${row.id} has invalid technologies data.`)
  }
  const projectNumber = Number(row.project_number)
  if (!Number.isSafeInteger(projectNumber)) {
    throw new Error(`Project ${row.id} has an invalid project number.`)
  }
  return {
    projectNumber,
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    category: row.category,
    imageUrl: row.image_url,
    ...(row.demo_video ? { demoVideo: row.demo_video } : {}),
    technologies,
    role: row.role,
    liveDemoUrl: row.live_demo_url,
    sourceCodeUrl: row.source_code_url,
    price: row.price,
    isPublished: Boolean(row.is_published),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  }
}

export async function readProjects(): Promise<Project[]> {
  const rows = await selectMysqlRows<ProjectRow>(
    `SELECT project_number, id, code, title, description, category, image_url, demo_video,
            technologies, role, live_demo_url, source_code_url, price, is_published, updated_at
     FROM projects ORDER BY updated_at DESC, id`,
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
  const pool = getMysqlPool()
  const existingRows = await selectMysqlRows<RowDataPacket & { code: string }>(
    "SELECT code FROM projects",
  )
  const existingCodes = existingRows.map((entry) => entry.code)
  let code = findAvailableProjectCode(project.title, existingCodes, project.id)

  for (;;) {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO projects
          (id, code, title, description, category, image_url, demo_video, technologies, role,
           live_demo_url, source_code_url, price, is_published, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      const projectNumber = Number(result.insertId)
      if (!Number.isSafeInteger(projectNumber)) {
        throw new Error("The project database returned an invalid project number.")
      }
      return { ...project, projectNumber, code }
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY")) {
        throw error
      }
    }

    const duplicateId = await selectMysqlRows<RowDataPacket & { id: string }>(
      "SELECT id FROM projects WHERE id = ? LIMIT 1",
      [project.id],
    )
    if (duplicateId.length > 0) {
      throw new Error(`Project ${project.id} already exists.`)
    }
    const duplicateCode = await selectMysqlRows<RowDataPacket & { code: string }>(
      "SELECT code FROM projects WHERE code = ? LIMIT 1",
      [code],
    )
    if (duplicateCode.length === 0) throw new Error("The project could not be saved because of a database conflict.")
    const codes = await selectMysqlRows<RowDataPacket & { code: string }>(
      "SELECT code FROM projects",
    )
    code = findAvailableProjectCode(
      project.title,
      [...existingCodes, ...codes.map((entry) => entry.code)],
      project.id,
    )
    existingCodes.push(code)
  }
}

export async function updateProject(project: Omit<Project, "projectNumber">): Promise<boolean> {
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `UPDATE projects
     SET title = ?, description = ?, category = ?, image_url = ?, demo_video = ?, technologies = ?,
         role = ?, live_demo_url = ?, source_code_url = ?, price = ?, is_published = ?, updated_at = ?
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
  if (result.affectedRows > 0) return true
  const rows = await selectMysqlRows<RowDataPacket & { id: string }>(
    "SELECT id FROM projects WHERE id = ? LIMIT 1",
    [project.id],
  )
  return rows.length > 0
}

export async function deleteProject(id: string): Promise<boolean> {
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    "DELETE FROM projects WHERE id = ?",
    [id],
  )
  return result.affectedRows > 0
}
