import { randomUUID } from "node:crypto"
import { mkdir, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import { readProjects } from "@/lib/project-store"
import { listApiEndpoints } from "@/lib/api-endpoints"
import { requireOwnerAccess } from "@/lib/owner-access"
import { uploadToCloudflareR2 } from "@/lib/r2-storage"

export const runtime = "nodejs"

const maxVideoSize = 100 * 1024 * 1024
const hasSignature = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value)

const videoTypes = {
  "video/mp4": { extension: "mp4", matches: (bytes: Uint8Array) => hasSignature(bytes, [0x66, 0x74, 0x79, 0x70], 4) },
  "video/x-m4v": { extension: "m4v", matches: (bytes: Uint8Array) => hasSignature(bytes, [0x66, 0x74, 0x79, 0x70], 4) },
  "video/quicktime": { extension: "mov", matches: (bytes: Uint8Array) => hasSignature(bytes, [0x66, 0x74, 0x79, 0x70], 4) },
  "video/webm": { extension: "webm", matches: (bytes: Uint8Array) => hasSignature(bytes, [0x1a, 0x45, 0xdf, 0xa3]) },
} as const

export async function POST(request: Request) {
  const unauthorized = await requireOwnerAccess()
  if (unauthorized) return unauthorized

  const formData = await request.formData().catch(() => null)
  const projectCode = formData?.get("project_code")
  const video = formData?.get("video")
  if (typeof projectCode !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(projectCode) || !(video instanceof File)) {
    return NextResponse.json({ error: "Select a saved project and a demo video to upload." }, { status: 400 })
  }
  if (video.size === 0 || video.size > maxVideoSize) {
    return NextResponse.json({ error: "Video must be larger than 0 bytes and no larger than 100 MB." }, { status: 400 })
  }

  const videoType = videoTypes[video.type as keyof typeof videoTypes]
  if (!videoType) return NextResponse.json({ error: "Use an MP4, M4V, MOV, or WebM video." }, { status: 400 })

  try {
    const [projects, endpoints] = await Promise.all([readProjects(), listApiEndpoints(true)])
    if (!projects.some((project) => project.code === projectCode) && !endpoints.some((endpoint) => endpoint.id === projectCode)) {
      return NextResponse.json({ error: "Project or API endpoint not found." }, { status: 404 })
    }

    const bytes = Buffer.from(await video.arrayBuffer())
    if (!videoType.matches(bytes)) {
      return NextResponse.json({ error: "The video contents do not match the selected file type." }, { status: 400 })
    }

    const filename = `${projectCode}.${videoType.extension}`
    const remoteUpload = await uploadToCloudflareR2(`projects/${filename}`, bytes, video.type)
    if (remoteUpload?.url) {
      return NextResponse.json({ filename, url: remoteUpload.url }, { status: 201 })
    }

    const directory = path.join(process.cwd(), "projects")
    const temporaryPath = path.join(directory, `.${projectCode}.${randomUUID()}.tmp`)
    await mkdir(directory, { recursive: true })
    await writeFile(temporaryPath, bytes, { flag: "wx" })
    await rename(temporaryPath, path.join(directory, filename))
    return NextResponse.json({ filename }, { status: 201 })
  } catch (error) {
    console.error("Could not save the project demo video.", error)
    return NextResponse.json({ error: "Could not save the demo video." }, { status: 500 })
  }
}
