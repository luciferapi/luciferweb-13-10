import { createReadStream } from "node:fs"
import { Readable } from "node:stream"
import { NextResponse } from "next/server"
import { getProjectImage } from "@/features/projects/server/project-images"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params
  const match = /^([a-zA-Z0-9_-]{1,100})\.(jpg|jpeg|png|webp|gif)$/i.exec(filename)
  if (!match) return NextResponse.json({ error: "Project image not found." }, { status: 404 })

  const image = await getProjectImage(match[1])
  if (!image || image.filename.toLowerCase() !== filename.toLowerCase()) {
    return NextResponse.json({ error: "Project image not found." }, { status: 404 })
  }

  const stream = Readable.toWeb(createReadStream(image.filePath)) as ReadableStream<Uint8Array>
  return new Response(stream, {
    headers: {
      "Content-Length": String(image.size),
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
