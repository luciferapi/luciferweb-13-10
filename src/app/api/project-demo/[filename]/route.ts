import { createReadStream } from "node:fs"
import { Readable } from "node:stream"
import { NextResponse } from "next/server"
import { getProjectDemoContentType, getProjectDemoVideo } from "@/features/projects/server/project-demo-videos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function rangeNotSatisfiable(size: number) {
  return new Response(null, {
    status: 416,
    headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" },
  })
}

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params
  const video = await getProjectDemoVideo(filename)
  if (!video) return NextResponse.json({ error: "Demo video not found." }, { status: 404 })

  const contentType = getProjectDemoContentType(video.extension)
  const rangeHeader = request.headers.get("range")
  const commonHeaders = {
    "Accept-Ranges": "bytes",
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  }

  if (!rangeHeader) {
    const stream = Readable.toWeb(createReadStream(video.filePath)) as ReadableStream<Uint8Array>
    return new Response(stream, {
      headers: { ...commonHeaders, "Content-Length": String(video.size) },
    })
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader)
  if (!match || (!match[1] && !match[2])) return rangeNotSatisfiable(video.size)

  let start: number
  let end: number
  if (!match[1]) {
    const suffixLength = Number(match[2])
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return rangeNotSatisfiable(video.size)
    start = Math.max(video.size - suffixLength, 0)
    end = video.size - 1
  } else {
    start = Number(match[1])
    end = match[2] ? Number(match[2]) : video.size - 1
  }

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= video.size || end < start) {
    return rangeNotSatisfiable(video.size)
  }
  end = Math.min(end, video.size - 1)

  const length = end - start + 1
  const stream = Readable.toWeb(createReadStream(video.filePath, { start, end })) as ReadableStream<Uint8Array>
  return new Response(stream, {
    status: 206,
    headers: {
      ...commonHeaders,
      "Content-Length": String(length),
      "Content-Range": `bytes ${start}-${end}/${video.size}`,
    },
  })
}