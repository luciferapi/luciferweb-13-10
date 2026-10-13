import "server-only"
import { randomUUID } from "node:crypto"
import { downloadFromCloudflareR2, getCloudflareR2Config, uploadToCloudflareR2 } from "@/features/storage/server/r2-storage"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

export type OwnerLiveBanner = {
  id: string
  message: string
  linkUrl: string | null
  imageUrl: string | null
  isEnabled: boolean
  sortOrder: number
}

type BannerRow = {
  id: string
  message: string
  link_url: string | null
  is_enabled: boolean
  sort_order: number
}

type BannerRowWithLegacyImage = BannerRow & {
  image_url?: string | null
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

function isMissingImageUrlColumn(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const code = "code" in error && typeof error.code === "string" ? error.code : ""
  const message = "message" in error && typeof error.message === "string" ? error.message : ""
  return message.includes("image_url") &&
    ((code === "42703") || (code === "PGRST204" && /column|schema cache/i.test(message)))
}

function getAdminClient() {
  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase admin access is not configured.")
  return client
}

function mapBanner(row: BannerRow, imageUrl: string | null): OwnerLiveBanner {
  return {
    id: row.id,
    message: imageUrl && row.message === imageOnlyBannerMessage ? "" : row.message,
    linkUrl: row.link_url,
    imageUrl,
    isEnabled: row.is_enabled,
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
  const client = getAdminClient()
  let query = client
    .from("owner_live_banners")
    .select("id, message, link_url, image_url, is_enabled, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (enabledOnly) query = query.eq("is_enabled", true)
  const result = await query
  let rows: BannerRowWithLegacyImage[] | null = result.data
  let error = result.error
  if (error && isMissingImageUrlColumn(error)) {
    let fallbackQuery = client
      .from("owner_live_banners")
      .select("id, message, link_url, is_enabled, sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
    if (enabledOnly) fallbackQuery = fallbackQuery.eq("is_enabled", true)
    const fallbackResult = await fallbackQuery
    rows = fallbackResult.data?.map((row) => ({ ...row, image_url: null })) ?? null
    error = fallbackResult.error
  }
  if (error) throw error
  return Promise.all((rows ?? []).map(async (banner) => {
    return mapBanner(banner, await getBannerImageUrl(banner.id, banner.image_url ?? null))
  }))
}

export async function createOwnerLiveBanner(input: Omit<OwnerLiveBanner, "id">) {
  const client = getAdminClient()
  const id = randomUUID()
  await saveBannerImageUrl(id, input.imageUrl)
  const { data, error } = await client
    .from("owner_live_banners")
    .insert({
      id,
      message: input.message || imageOnlyBannerMessage,
      link_url: input.linkUrl,
      is_enabled: input.isEnabled,
      sort_order: input.sortOrder,
    })
    .select("id, message, link_url, is_enabled, sort_order")
    .single()
  if (error) {
    try {
      await saveBannerImageUrl(id, null)
    } catch (cleanupError) {
      console.error("Could not clear orphaned banner image metadata from R2.", cleanupError)
    }
    throw error
  }
  return mapBanner(data as BannerRow, input.imageUrl)
}

export async function updateOwnerLiveBanner(id: string, input: Omit<OwnerLiveBanner, "id">) {
  const client = getAdminClient()
  const previousImageUrl = await getBannerImageUrl(id)
  await saveBannerImageUrl(id, input.imageUrl)
  const { data, error } = await client
    .from("owner_live_banners")
    .update({
      message: input.message || imageOnlyBannerMessage,
      link_url: input.linkUrl,
      is_enabled: input.isEnabled,
      sort_order: input.sortOrder,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, message, link_url, is_enabled, sort_order")
    .maybeSingle()
  if (error || !data) {
    try {
      await saveBannerImageUrl(id, previousImageUrl)
    } catch (rollbackError) {
      console.error("Could not restore banner image metadata in R2 after a failed database update.", rollbackError)
    }
    if (error) throw error
    return null
  }
  return mapBanner(data as BannerRow, input.imageUrl)
}

export async function deleteOwnerLiveBanner(id: string) {
  const previousImageUrl = await getBannerImageUrl(id)
  await saveBannerImageUrl(id, null)
  const { data, error } = await getAdminClient()
    .from("owner_live_banners")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle()
  if (error || !data) {
    try {
      await saveBannerImageUrl(id, previousImageUrl)
    } catch (rollbackError) {
      console.error("Could not restore banner image metadata in R2 after a failed database delete.", rollbackError)
    }
    if (error) throw error
    return false
  }
  return Boolean(data)
}
