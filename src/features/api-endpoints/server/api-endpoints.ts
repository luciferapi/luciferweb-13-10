import "server-only"
import { getMysqlPool, selectMysqlRows } from "@/lib/mysql"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { findProjectDemoVideo } from "@/features/projects/server/project-demo-videos"
import { getProjectImage } from "@/features/projects/server/project-images"

import type { ApiEndpoint } from "@/features/api-endpoints/server/api-endpoint-types"
export type { ApiEndpoint } from "@/features/api-endpoints/server/api-endpoint-types"

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
  price_paise: number | string
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
    pricePaise: Number(row.price_paise),
  }
}

export async function listApiEndpoints(includeDisabled = false): Promise<ApiEndpoint[]> {
  const where = includeDisabled ? "" : "WHERE is_enabled = TRUE"
  const rows = await selectMysqlRows<ApiEndpointRow>(
    `SELECT id, name, endpoint_path, note, category, image_url, demo_video, link_url,
            is_enabled, price_paise
     FROM api_endpoints ${where}
     ORDER BY category, name, id`,
  )
  return Promise.all(rows.map(toApiEndpoint))
}

export async function createApiEndpoint(endpoint: ApiEndpoint): Promise<void> {
  await getMysqlPool().execute<ResultSetHeader>(
    `INSERT INTO api_endpoints
      (id, name, endpoint_path, note, category, image_url, demo_video, link_url, is_enabled, price_paise)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      endpoint.id,
      endpoint.name,
      endpoint.path,
      endpoint.note,
      endpoint.category,
      endpoint.imageUrl,
      endpoint.demoVideo || null,
      endpoint.linkUrl,
      endpoint.isEnabled,
      endpoint.pricePaise,
    ],
  )
}

export async function updateApiEndpoint(endpoint: ApiEndpoint): Promise<boolean> {
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `UPDATE api_endpoints
     SET name = ?, endpoint_path = ?, note = ?, category = ?, image_url = ?,
         demo_video = ?, link_url = ?, is_enabled = ?, price_paise = ?,
         updated_at = CURRENT_TIMESTAMP(3)
     WHERE id = ?`,
    [
      endpoint.name,
      endpoint.path,
      endpoint.note,
      endpoint.category,
      endpoint.imageUrl,
      endpoint.demoVideo || null,
      endpoint.linkUrl,
      endpoint.isEnabled,
      endpoint.pricePaise,
      endpoint.id,
    ],
  )
  return result.affectedRows > 0
}

export async function deleteApiEndpoint(id: string): Promise<boolean> {
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    "DELETE FROM api_endpoints WHERE id = ?",
    [id],
  )
  return result.affectedRows > 0
}
