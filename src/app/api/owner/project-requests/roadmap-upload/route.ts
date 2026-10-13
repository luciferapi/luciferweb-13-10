import { NextResponse } from "next/server"
import { requireOwnerAccess } from "@/features/auth/server/owner-access"
import { uploadToCloudflareR2 } from "@/features/storage/server/r2-storage"
import { readLimitedFormData } from "@/lib/server/read-limited-form-data"

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
  const unauthorized = await requireOwnerAccess("project-requests")
  if (unauthorized) return unauthorized

  const formResult = await readLimitedFormData(request, maxImageSize + 64 * 1024)
  if (!formResult.ok) {
    return NextResponse.json(
      { error: formResult.status === 413 ? "Image must be no larger than 5 MB." : "Send a valid roadmap upload form." },
      { status: formResult.status },
    )
  }
  const image = formResult.value.get("image")
  const requestId = formResult.value.get("request_id")

  if (typeof requestId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(requestId)) {
    return NextResponse.json({ error: "Select a valid project request." }, { status: 400 })
  }
  if (!(image instanceof File)) return NextResponse.json({ error: "Choose a roadmap image to upload." }, { status: 400 })
  if (image.size === 0) return NextResponse.json({ error: "Choose a non-empty image." }, { status: 400 })
  if (image.size > maxImageSize) return NextResponse.json({ error: "Image must be no larger than 5 MB." }, { status: 413 })

  const imageType = imageTypes[image.type as keyof typeof imageTypes]
  if (!imageType) {
    return NextResponse.json({ error: "Use a JPG, PNG, WebP, or GIF image." }, { status: 400 })
  }

  const buffer = Buffer.from(await image.arrayBuffer())
  if (!imageType.matches(buffer)) {
    return NextResponse.json({ error: "The image contents do not match the selected file type." }, { status: 400 })
  }

  try {
    const objectKey = `project-request-roadmaps/${requestId}-${crypto.randomUUID()}.${imageType.extension}`
    const remoteUpload = await uploadToCloudflareR2(objectKey, buffer, image.type, { required: true })
    if (!remoteUpload?.url) throw new Error("R2 did not return a public image URL.")
    return NextResponse.json({ imageUrl: remoteUpload.url }, { status: 201 })
  } catch (error) {
    console.error("Could not upload project request roadmap image to Cloudflare R2.", error)
    return NextResponse.json({ error: "Could not upload the roadmap image. Check the R2 configuration and try again." }, { status: 500 })
  }
}
