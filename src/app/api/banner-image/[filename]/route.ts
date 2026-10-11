import { createReadStream } from "node:fs"
import { Readable } from "node:stream"
import { NextResponse } from "next/server"
import { getOwnerBannerImage } from "@/features/owner/server/owner-banner-images"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params
  const image = await getOwnerBannerImage(filename)
  if (!image) return NextResponse.json({ error: "Banner image not found." }, { status: 404 })

  const stream = Readable.toWeb(createReadStream(image.filePath)) as ReadableStream<Uint8Array>
  return new Response(stream, {
    headers: {
      "Content-Length": String(image.size),
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
