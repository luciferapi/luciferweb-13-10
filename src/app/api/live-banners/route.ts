import { NextResponse } from "next/server"
import { listOwnerLiveBanners } from "@/features/owner/server/owner-live-banners"
import { isMysqlSchemaUnavailable } from "@/lib/mysql"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
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
    return NextResponse.json({ error: "Could not load homepage banners." }, { status: 500 })
  }
}
