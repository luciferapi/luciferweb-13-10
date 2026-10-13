import { NextResponse } from "next/server"
import { listOwnerLiveBanners } from "@/features/owner/server/owner-live-banners"
import { getCloudflareR2Config } from "@/features/storage/server/r2-storage"
import { isMysqlConfigured, isMysqlSchemaUnavailable } from "@/lib/mysql"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  // Live banners are optional during preview and before the backing services are configured.
  // Return an empty collection so the homepage remains usable without a noisy client error.
  try {
    const storageConfig = getCloudflareR2Config()
    if (!isMysqlConfigured() || !storageConfig?.privateBucket) {
      return NextResponse.json(
        { banners: [] },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      )
    }

    return NextResponse.json(
      { banners: await listOwnerLiveBanners(true) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    )
  } catch (error) {
    if (isMysqlSchemaUnavailable(error)) {
      return NextResponse.json(
        { error: "Homepage banners are unavailable because the MySQL schema is outdated. Apply database/migrations/001_initial_schema.sql." },
        { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
      )
    }

    console.error("Could not load homepage live banners.", error)
    return NextResponse.json(
      { banners: [], error: "Could not load homepage banners." },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
    )
  }
}
