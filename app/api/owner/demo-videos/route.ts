import { NextResponse } from "next/server"
import { listProjectDemoVideos } from "@/lib/project-demo-videos"
import { requireOwnerAccess } from "@/lib/owner-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const unauthorized = await requireOwnerAccess()
  if (unauthorized) return unauthorized

  return NextResponse.json({ videos: await listProjectDemoVideos() }, { headers: { "Cache-Control": "no-store" } })
}