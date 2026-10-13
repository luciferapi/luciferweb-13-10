import "server-only"
import { randomUUID } from "node:crypto"
import { downloadFromCloudflareR2, getCloudflareR2Config, uploadToCloudflareR2 } from "@/features/storage/server/r2-storage"
import { getMysqlPool, selectMysqlRows } from "@/lib/mysql"
import type { ResultSetHeader, RowDataPacket } from "mysql2"

export type OwnerLiveBanner = {
  id: string
  message: string
  linkUrl: string | null
  imageUrl: string | null
  isEnabled: boolean
  sortOrder: number
}

type BannerRow = RowDataPacket & {
  id: string
  message: string
  link_url: string | null
  is_enabled: boolean
  sort_order: number
}

type BannerImageMetadata = {
  version: 1
  imageUrl: string | null
}

const bannerImageMetadataKey = (id: string) => `banner-metadata/${id}.json`
const imageOnlyBannerMessage = "[image-only-banner]"

function ensureBannerImageStorage() {
  const config = getCloudflareR2Config()
  if (!config) throw new Error("Configure Cloudflare R2 before using live banners.")
  if (!config.privateBucket) {
    throw new Error("Set CLOUDFLARE_R2_PRIVATE_BUCKET for banner image metadata.")
  }
}

function mapBanner(row: BannerRow, imageUrl: string | null): OwnerLiveBanner {
  return {
    id: row.id,
    message: imageUrl && row.message === imageOnlyBannerMessage ? "" : row.message,
    linkUrl: row.link_url,
    imageUrl,
    isEnabled: Boolean(row.is_enabled),
    sortOrder: row.sort_order,
  }
}

async function getBannerImageUrl(id: string, legacyImageUrl: string | null = null): Promise<string | null> {
  ensureBannerImageStorage()
  let body: Buffer | null
  try {
    body = await downloadFromCloudflareR2(bannerImageMetadataKey(id))
  } catch (error) {
    throw new Error("Could not read the banner image URL from private R2 storage.", { cause: error })
  }
  if (!body) {
    if (legacyImageUrl) await saveBannerImageUrl(id, legacyImageUrl)
    return legacyImageUrl
  }

  let metadata: unknown
  try {
    metadata = JSON.parse(body.toString("utf8"))
  } catch (error) {
    throw new Error(`Banner image metadata in R2 is invalid for banner ${id}.`, { cause: error })
  }
  if (
    typeof metadata !== "object" || metadata === null ||
    !("version" in metadata) || metadata.version !== 1 ||
    !("imageUrl" in metadata) ||
    !(typeof metadata.imageUrl === "string" || metadata.imageUrl === null)
  ) {
    throw new Error(`Banner image metadata in R2 has an unsupported format for banner ${id}.`)
  }
  return metadata.imageUrl
}

async function saveBannerImageUrl(id: string, imageUrl: string | null) {
  ensureBannerImageStorage()
  const metadata: BannerImageMetadata = { version: 1, imageUrl }
  try {
    await uploadToCloudflareR2(
      bannerImageMetadataKey(id),
      Buffer.from(JSON.stringify(metadata), "utf8"),
      "application/json",
      { isPublic: false, required: true },
    )
  } catch (error) {
    throw new Error("Could not save the banner image URL in private R2 storage.", { cause: error })
  }
}

export async function listOwnerLiveBanners(enabledOnly = false) {
  const where = enabledOnly ? "WHERE is_enabled = TRUE" : ""
  const rows = await selectMysqlRows<BannerRow>(
    `SELECT id, message, link_url, image_url, is_enabled, sort_order
     FROM owner_live_banners ${where}
     ORDER BY sort_order, created_at`,
  )
  return Promise.all(rows.map(async (banner) => {
    return mapBanner(banner, await getBannerImageUrl(banner.id, banner.image_url))
  }))
}

export async function createOwnerLiveBanner(input: Omit<OwnerLiveBanner, "id">) {
  const client = getMysqlPool()
  const id = randomUUID()
  await saveBannerImageUrl(id, input.imageUrl)
  let row: BannerRow | undefined
  try {
    await client.execute<ResultSetHeader>(
      `INSERT INTO owner_live_banners (id, message, link_url, image_url, is_enabled, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.message || imageOnlyBannerMessage, input.linkUrl, input.imageUrl, input.isEnabled, input.sortOrder],
    )
    const rows = await selectMysqlRows<BannerRow>(
      `SELECT id, message, link_url, image_url, is_enabled, sort_order
       FROM owner_live_banners WHERE id = ? LIMIT 1`,
      [id],
    )
    row = rows[0]
  } catch (error) {
    try {
      await saveBannerImageUrl(id, null)
    } catch (cleanupError) {
      console.error("Could not clear orphaned banner image metadata from R2.", cleanupError)
    }
    throw error
  }
  if (!row) throw new Error("The live banner was not saved.")
  return mapBanner(row, input.imageUrl)
}

export async function updateOwnerLiveBanner(id: string, input: Omit<OwnerLiveBanner, "id">) {
  const client = getMysqlPool()
  const previousImageUrl = await getBannerImageUrl(id)
  await saveBannerImageUrl(id, input.imageUrl)
  let row: BannerRow | undefined
  try {
    await client.execute<ResultSetHeader>(
      `UPDATE owner_live_banners
       SET message = ?, link_url = ?, image_url = ?, is_enabled = ?, sort_order = ?,
           updated_at = CURRENT_TIMESTAMP(3)
       WHERE id = ?`,
      [input.message || imageOnlyBannerMessage, input.linkUrl, input.imageUrl, input.isEnabled, input.sortOrder, id],
    )
    const rows = await selectMysqlRows<BannerRow>(
      `SELECT id, message, link_url, image_url, is_enabled, sort_order
       FROM owner_live_banners WHERE id = ? LIMIT 1`,
      [id],
    )
    row = rows[0]
  } catch (error) {
    try {
      await saveBannerImageUrl(id, previousImageUrl)
    } catch (rollbackError) {
      console.error("Could not restore banner image metadata in R2 after a failed database update.", rollbackError)
    }
    throw error
  }
  if (!row) {
    try {
      await saveBannerImageUrl(id, previousImageUrl)
    } catch (rollbackError) {
      console.error("Could not restore banner image metadata in R2 after a missing banner update.", rollbackError)
    }
    return null
  }
  return mapBanner(row, input.imageUrl)
}

export async function deleteOwnerLiveBanner(id: string) {
  const previousImageUrl = await getBannerImageUrl(id)
  await saveBannerImageUrl(id, null)
  let affectedRows: number
  try {
    const [result] = await getMysqlPool().execute<ResultSetHeader>(
      "DELETE FROM owner_live_banners WHERE id = ?",
      [id],
    )
    affectedRows = result.affectedRows
  } catch (error) {
    try {
      await saveBannerImageUrl(id, previousImageUrl)
    } catch (rollbackError) {
      console.error("Could not restore banner image metadata in R2 after a failed database delete.", rollbackError)
    }
    throw error
  }
  if (affectedRows === 0 && previousImageUrl) await saveBannerImageUrl(id, previousImageUrl)
  return affectedRows > 0
}
