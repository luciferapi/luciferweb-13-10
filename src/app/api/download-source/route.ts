import { NextResponse } from "next/server"
import { z } from "zod"
import { readProjectSourceBundle } from "@/features/projects/server/source-bundles"
import { verifySourceDownloadToken } from "@/features/projects/server/source-download-token"

export const runtime = "nodejs"

const requestSchema = z.object({ token: z.string().min(1).max(2048) })

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "A valid download token is required." }, { status: 400 })

  const claims = verifySourceDownloadToken(parsed.data.token)
  if (!claims) return NextResponse.json({ error: "This download link is invalid or expired. Complete checkout again." }, { status: 403 })

  try {
    const bundle = await readProjectSourceBundle(claims.projectId)
    if (!bundle) return NextResponse.json({ error: "The source bundle is not available." }, { status: 404 })

    return new Response(bundle, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(bundle.byteLength),
        "Content-Disposition": `attachment; filename="${claims.projectId}-source.zip"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("Could not read the project source bundle.", error)
    return NextResponse.json({ error: "Could not read the source bundle." }, { status: 500 })
  }
}