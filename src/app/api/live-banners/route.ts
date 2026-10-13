import { NextResponse } from "next/server"
import { listOwnerLiveBanners } from "@/features/owner/server/owner-live-banners"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json(
      { banners: await listOwnerLiveBanners(true) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message === "Supabase admin access is not configured.") {
      return NextResponse.json(
        { banners: [] },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      )
    }

    console.error("Could not load homepage live banners.", error)
    return NextResponse.json({ error: "Could not load homepage banners." }, { status: 500 })
  }
}
