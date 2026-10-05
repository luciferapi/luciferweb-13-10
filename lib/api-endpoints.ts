import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"
import { getDatabasePool } from "@/lib/database"
import { findProjectDemoVideo } from "@/lib/project-demo-videos"
import { getProjectImage } from "@/lib/project-images"

import type { ApiEndpoint } from "@/lib/api-endpoint-types"
export type { ApiEndpoint } from "@/lib/api-endpoint-types"

type ApiEndpointRow = RowDataPacket & {
  id: string
  name: string
  endpoint_path: string
  note: string
  category: string
  image_url: string
  demo_video: string | null
  link_url: string
  is_enabled: boolean | number
}

async function toApiEndpoint(row: ApiEndpointRow): Promise<ApiEndpoint> {
  const [image, video] = await Promise.all([
    row.image_url ? null : getProjectImage(row.id),
    row.demo_video ? null : findProjectDemoVideo(row.id),
  ])
  return {
    id: row.id,
    name: row.name,
    path: row.endpoint_path,
    note: row.note,
    category: row.category,
    imageUrl: row.image_url || image?.url || "",
    demoVideo: row.demo_video || video || "",
    linkUrl: row.link_url,
    isEnabled: Boolean(row.is_enabled),
  }
}

export async function listApiEndpoints(includeDisabled = false): Promise<ApiEndpoint[]> {
  const [rows] = await getDatabasePool().query<ApiEndpointRow[]>(
    `SELECT id, name, endpoint_path, note, category, image_url, demo_video, link_url, is_enabled
     FROM api_endpoints
     ${includeDisabled ? "" : "WHERE is_enabled = TRUE"}
     ORDER BY category ASC, name ASC, id ASC`,
  )
  return Promise.all(rows.map(toApiEndpoint))
}

export async function createApiEndpoint(endpoint: ApiEndpoint): Promise<void> {
  const [result] = await getDatabasePool().execute<ResultSetHeader>(
    `INSERT INTO api_endpoints (id, name, endpoint_path, note, category, image_url, demo_video, link_url, is_enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [endpoint.id, endpoint.name, endpoint.path, endpoint.note, endpoint.category, endpoint.imageUrl, endpoint.demoVideo || null, endpoint.linkUrl, endpoint.isEnabled],
  )
  if (result.affectedRows !== 1) throw new Error("The API endpoint was not saved.")
}

export async function updateApiEndpoint(endpoint: ApiEndpoint): Promise<boolean> {
  const [result] = await getDatabasePool().execute<ResultSetHeader>(
    `UPDATE api_endpoints
     SET name = ?, endpoint_path = ?, note = ?, category = ?, image_url = ?, demo_video = ?, link_url = ?, is_enabled = ?
     WHERE id = ?`,
    [endpoint.name, endpoint.path, endpoint.note, endpoint.category, endpoint.imageUrl, endpoint.demoVideo || null, endpoint.linkUrl, endpoint.isEnabled, endpoint.id],
  )
  return result.affectedRows > 0
}

export async function deleteApiEndpoint(id: string): Promise<boolean> {
  const [result] = await getDatabasePool().execute<ResultSetHeader>(
    "DELETE FROM api_endpoints WHERE id = ?",
    [id],
  )
  return result.affectedRows > 0
}

export function getApiEndpointUrl(endpointPath: string): string {
  return `https://luciferapi.com/${endpointPath}`
}
