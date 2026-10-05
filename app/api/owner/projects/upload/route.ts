import { randomUUID } from "node:crypto"
import { mkdir, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import { readProjects } from "@/lib/project-store"
import { listApiEndpoints } from "@/lib/api-endpoints"
import { requireOwnerAccess } from "@/lib/owner-access"
import { uploadToCloudflareR2 } from "@/lib/r2-storage"

export const runtime = "nodejs"

const maxImageSize = 5 * 1024 * 1024
const hasSignature = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value)

const imageTypes = {
  "image/jpeg": { extension: "jpg", matches: (bytes: Uint8Array) => hasSignature(bytes, [0xff, 0xd8, 0xff]) },
  "image/png": { extension: "png", matches: (bytes: Uint8Array) => hasSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  "image/webp": { extension: "webp", matches: (bytes: Uint8Array) => hasSignature(bytes, [0x52, 0x49, 0x46, 0x46]) && hasSignature(bytes, [0x57, 0x45, 0x42, 0x50], 8) },
  "image/gif": { extension: "gif", matches: (bytes: Uint8Array) => hasSignature(bytes, [0x47, 0x49, 0x46, 0x38]) && [0x37, 0x39].includes(bytes[4]) && bytes[5] === 0x61 },
} as const

export async function POST(request: Request) {
  const unauthorized = await requireOwnerAccess()
  if (unauthorized) return unauthorized

  const formData = await request.formData().catch(() => null)
  const image = formData?.get("image")
  const projectCode = formData?.get("project_code")
  if (typeof projectCode !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(projectCode)) {
    return NextResponse.json({ error: "Select a saved project before uploading its image." }, { status: 400 })
  }
  try {
    const [projects, endpoints] = await Promise.all([readProjects(), listApiEndpoints(true)])
    if (!projects.some((project) => project.code === projectCode) && !endpoints.some((endpoint) => endpoint.id === projectCode)) {
      return NextResponse.json({ error: "Project or API endpoint not found." }, { status: 404 })
    }
  } catch (error) {
    console.error("Could not verify the project for image upload.", error)
    return NextResponse.json({ error: "Could not verify the project." }, { status: 500 })
  }
  if (!(image instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 })
  if (image.size === 0 || image.size > maxImageSize) {
    return NextResponse.json({ error: "Image must be larger than 0 bytes and no larger than 5 MB." }, { status: 400 })
  }

  const imageType = imageTypes[image.type as keyof typeof imageTypes]
  if (!imageType) {
    return NextResponse.json({ error: "Use a JPG, PNG, WebP, or GIF image." }, { status: 400 })
  }

  const buffer = Buffer.from(await image.arrayBuffer())
  if (!imageType.matches(buffer)) {
    return NextResponse.json({ error: "The image contents do not match the selected file type." }, { status: 400 })
  }

  const filename = `${projectCode}.${imageType.extension}`
  try {
    const remoteUpload = await uploadToCloudflareR2(`projects/${filename}`, buffer, image.type)
    if (remoteUpload?.url) {
      return NextResponse.json({ imageUrl: remoteUpload.url }, { status: 201 })
    }
  } catch (error) {
    console.error("Could not upload the project image to Cloudflare R2.", error)
    return NextResponse.json({ error: "Could not upload the project image." }, { status: 500 })
  }

  const uploadDirectory = path.join(process.cwd(), "projects")
  try {
    await mkdir(uploadDirectory, { recursive: true })
    const temporaryPath = path.join(uploadDirectory, `.${projectCode}.${randomUUID()}.tmp`)
    await writeFile(temporaryPath, buffer, { flag: "wx" })
    await rename(temporaryPath, path.join(uploadDirectory, filename))
    return NextResponse.json({ imageUrl: `/api/project-image/${encodeURIComponent(filename)}` }, { status: 201 })
  } catch (error) {
    console.error("Could not save the project image.", error)
    return NextResponse.json({ error: "Could not save the uploaded image." }, { status: 500 })
  }
}