import "server-only"
import { getMysqlPool, selectMysqlRows } from "@/lib/mysql"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { findProjectDemoVideo } from "@/features/projects/server/project-demo-videos"
import { getProjectImage } from "@/features/projects/server/project-images"

import type { ApiEndpoint } from "@/features/api-endpoints/server/api-endpoint-types"
export type { ApiEndpoint } from "@/features/api-endpoints/server/api-endpoint-types"

type ApiEndpointColumnRow = RowDataPacket & { columnName: string }

let apiEndpointSchemaSetup: Promise<void> | null = null

function isDuplicateColumnError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_FIELDNAME"
}

export async function ensureApiEndpointStorageSchema(): Promise<void> {
  if (!apiEndpointSchemaSetup) {
    apiEndpointSchemaSetup = (async () => {
      const columns = await selectMysqlRows<ApiEndpointColumnRow>(
        `SELECT COLUMN_NAME AS columnName
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'api_endpoints'
           AND COLUMN_NAME IN ('owner_type', 'price_paise')`,
      )
      const existingColumns = new Set(columns.map((column) => column.columnName))

      if (!existingColumns.has("owner_type")) {
        try {
          await getMysqlPool().execute(
            "ALTER TABLE api_endpoints ADD COLUMN owner_type VARCHAR(128) NOT NULL DEFAULT '' AFTER category",
          )
        } catch (error) {
          if (!isDuplicateColumnError(error)) throw error
        }
      }

      if (!existingColumns.has("price_paise")) {
        try {
          await getMysqlPool().execute(
            "ALTER TABLE api_endpoints ADD COLUMN price_paise BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER is_enabled",
          )
        } catch (error) {
          if (!isDuplicateColumnError(error)) throw error
        }
      }
    })()
  }

  try {
    await apiEndpointSchemaSetup
  } catch (error) {
    apiEndpointSchemaSetup = null
    throw error
  }
}

type ApiEndpointRow = RowDataPacket & {
  id: string
  name: string
  endpoint_path: string
  note: string
  category: string
  owner_type: string
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
    ownerType: row.owner_type,
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
    `SELECT id, name, endpoint_path, note, category, owner_type, image_url, demo_video, link_url,
            is_enabled, price_paise
     FROM api_endpoints ${where}
     ORDER BY category, name, id`,
  )
  return Promise.all(rows.map(toApiEndpoint))
}

export async function createApiEndpoint(endpoint: ApiEndpoint): Promise<void> {
  await getMysqlPool().execute<ResultSetHeader>(
    `INSERT INTO api_endpoints
      (id, name, endpoint_path, note, category, owner_type, image_url, demo_video, link_url, is_enabled, price_paise)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      endpoint.id,
      endpoint.name,
      endpoint.path,
      endpoint.note,
      endpoint.category,
      endpoint.ownerType,
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
     SET name = ?, endpoint_path = ?, note = ?, category = ?, owner_type = ?, image_url = ?,
         demo_video = ?, link_url = ?, is_enabled = ?, price_paise = ?,
         updated_at = CURRENT_TIMESTAMP(3)
     WHERE id = ?`,
    [
      endpoint.name,
      endpoint.path,
      endpoint.note,
      endpoint.category,
      endpoint.ownerType,
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
