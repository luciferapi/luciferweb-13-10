import "server-only"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { findProjectDemoVideo } from "@/features/projects/server/project-demo-videos"
import { getProjectImage } from "@/features/projects/server/project-images"

import type { ApiEndpoint } from "@/features/api-endpoints/server/api-endpoint-types"
export type { ApiEndpoint } from "@/features/api-endpoints/server/api-endpoint-types"

type ApiEndpointRow = {
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

function getAdminClient() {
  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase admin access is not configured.")
  return client
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
  let query = getAdminClient()
    .from("api_endpoints")
    .select("id, name, endpoint_path, note, category, image_url, demo_video, link_url, is_enabled, price_paise")

  if (!includeDisabled) query = query.eq("is_enabled", true)

  const { data, error } = await query.order("category").order("name").order("id")
  if (error) throw error
  return Promise.all(((data ?? []) as ApiEndpointRow[]).map(toApiEndpoint))
}

export async function createApiEndpoint(endpoint: ApiEndpoint): Promise<void> {
  const { data, error } = await getAdminClient()
    .from("api_endpoints")
    .insert({
      id: endpoint.id,
      name: endpoint.name,
      endpoint_path: endpoint.path,
      note: endpoint.note,
      category: endpoint.category,
      image_url: endpoint.imageUrl,
      demo_video: endpoint.demoVideo || null,
      link_url: endpoint.linkUrl,
      is_enabled: endpoint.isEnabled,
      price_paise: endpoint.pricePaise,
    })
    .select("id")
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error("The API endpoint was not saved.")
}

export async function updateApiEndpoint(endpoint: ApiEndpoint): Promise<boolean> {
  const { data, error } = await getAdminClient()
    .from("api_endpoints")
    .update({
      name: endpoint.name,
      endpoint_path: endpoint.path,
      note: endpoint.note,
      category: endpoint.category,
      image_url: endpoint.imageUrl,
      demo_video: endpoint.demoVideo || null,
      link_url: endpoint.linkUrl,
      is_enabled: endpoint.isEnabled,
      price_paise: endpoint.pricePaise,
    })
    .eq("id", endpoint.id)
    .select("id")

  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function deleteApiEndpoint(id: string): Promise<boolean> {
  const { data, error } = await getAdminClient()
    .from("api_endpoints")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) throw error
  return (data?.length ?? 0) > 0
}
