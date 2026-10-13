import { NextResponse } from "next/server"
import { readProjects } from "@/features/projects/server/project-store"
import { listApiEndpoints } from "@/features/api-endpoints/server/api-endpoints"
import { requireOwnerAccess } from "@/features/auth/server/owner-access"
import { uploadToCloudflareR2 } from "@/features/storage/server/r2-storage"
import { readLimitedFormData } from "@/lib/server/read-limited-form-data"

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
  const resourceType = new URL(request.url).searchParams.get("type") === "api" ? "api" : "project"
  const unauthorized = await requireOwnerAccess(resourceType === "api" ? "apis" : "projects")
  if (unauthorized) return unauthorized

  const formResult = await readLimitedFormData(request, maxVideoSize + 64 * 1024)
  if (!formResult.ok) {
    return NextResponse.json(
      { error: formResult.status === 413 ? "Video must be no larger than 100 MB." : "Send a valid video upload form." },
      { status: formResult.status },
    )
  }
  const projectCode = formResult.value.get("project_code")
  const video = formResult.value.get("video")
  if (typeof projectCode !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(projectCode) || !(video instanceof File)) {
    return NextResponse.json({ error: "Select a saved project and a demo video to upload." }, { status: 400 })
  }
  if (video.size === 0) return NextResponse.json({ error: "Choose a non-empty video." }, { status: 400 })
  if (video.size > maxVideoSize) return NextResponse.json({ error: "Video must be no larger than 100 MB." }, { status: 413 })

  const videoType = videoTypes[video.type as keyof typeof videoTypes]
  if (!videoType) return NextResponse.json({ error: "Use an MP4, M4V, MOV, or WebM video." }, { status: 400 })

  try {
    const exists = resourceType === "api"
      ? (await listApiEndpoints(true)).some((endpoint) => endpoint.id === projectCode)
      : (await readProjects()).some((project) => project.code === projectCode)
    if (!exists) return NextResponse.json({ error: `${resourceType === "api" ? "API endpoint" : "Project"} not found.` }, { status: 404 })

    const bytes = Buffer.from(await video.arrayBuffer())
    if (!videoType.matches(bytes)) {
      return NextResponse.json({ error: "The video contents do not match the selected file type." }, { status: 400 })
    }

    const filename = `${projectCode}.${videoType.extension}`
    const objectKey = `${resourceType === "api" ? "api-endpoints" : "projects"}/${filename}`
    const remoteUpload = await uploadToCloudflareR2(objectKey, bytes, video.type, { required: true })
    if (remoteUpload?.url) {
      return NextResponse.json({ filename, url: remoteUpload.url, objectKey }, { status: 201 })
    }
    throw new Error("R2 did not return a public demo video URL.")
  } catch (error) {
    console.error("Could not save the project demo video.", error)
    return NextResponse.json({ error: "Could not upload the demo video to R2. Check the R2 keys, bucket, and public media domain." }, { status: 500 })
  }
}
