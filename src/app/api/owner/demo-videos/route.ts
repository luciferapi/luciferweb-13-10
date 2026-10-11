import { NextResponse } from "next/server"
import { listProjectDemoVideos } from "@/features/projects/server/project-demo-videos"
import { requireOwnerAccess } from "@/features/auth/server/owner-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const unauthorized = await requireOwnerAccess("projects")
  if (unauthorized) return unauthorized

  return NextResponse.json({ videos: await listProjectDemoVideos() }, { headers: { "Cache-Control": "no-store" } })
}