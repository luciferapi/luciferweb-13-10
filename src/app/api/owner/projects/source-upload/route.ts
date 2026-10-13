import { NextResponse } from "next/server"
import { readProjects } from "@/features/projects/server/project-store"
import { uploadToCloudflareR2 } from "@/features/storage/server/r2-storage"
import { MAX_SOURCE_BUNDLE_SIZE } from "@/features/projects/server/source-bundles"
import { requireOwnerAccess } from "@/features/auth/server/owner-access"
import { readLimitedFormData } from "@/lib/server/read-limited-form-data"

export const runtime = "nodejs"
const maxRequestBytes = MAX_SOURCE_BUNDLE_SIZE + 64 * 1024

function isZipArchive(bytes: Uint8Array) {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && (
    (bytes[2] === 0x03 && bytes[3] === 0x04) ||
    (bytes[2] === 0x05 && bytes[3] === 0x06) ||
    (bytes[2] === 0x07 && bytes[3] === 0x08)
  )
}

export async function POST(request: Request) {
  const unauthorized = await requireOwnerAccess("projects")
  if (unauthorized) return unauthorized

  const formResult = await readLimitedFormData(request, maxRequestBytes)
  if (!formResult.ok) {
    return NextResponse.json(
      { error: formResult.status === 413 ? "ZIP source bundles must be no larger than 100 MB." : "Send a valid source bundle upload form." },
      { status: formResult.status },
    )
  }
  const projectCode = formResult.value.get("project_code") ?? formResult.value.get("project_id")
  const sourceFile = formResult.value.get("source")
  if (typeof projectCode !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(projectCode) || !(sourceFile instanceof File)) {
    return NextResponse.json({ error: "Select a project and a ZIP source bundle." }, { status: 400 })
  }
  if (!sourceFile.name.toLowerCase().endsWith(".zip") || sourceFile.size === 0) {
    return NextResponse.json({ error: "Upload a non-empty ZIP archive no larger than 100 MB." }, { status: 400 })
  }
  if (sourceFile.size > MAX_SOURCE_BUNDLE_SIZE) {
    return NextResponse.json({ error: "ZIP source bundles must be no larger than 100 MB." }, { status: 413 })
  }

  try {
    const projectExists = (await readProjects()).some((project) => project.code === projectCode)
    if (!projectExists) return NextResponse.json({ error: "Project not found." }, { status: 404 })

    const bytes = Buffer.from(await sourceFile.arrayBuffer())
    if (!isZipArchive(bytes)) return NextResponse.json({ error: "The uploaded file is not a valid ZIP archive." }, { status: 400 })

    const objectKey = `source-bundles/${projectCode}.zip`
    const remoteUpload = await uploadToCloudflareR2(
      objectKey,
      bytes,
      "application/zip",
      { isPublic: false, required: true },
    )
    if (remoteUpload) {
      return NextResponse.json({ success: true, filename: `${projectCode}.zip`, objectKey, size: bytes.length })
    }
    throw new Error("R2 did not store the private source bundle.")
  } catch (error) {
    console.error("Could not save the project source bundle.", error)
    return NextResponse.json({ error: "Could not upload the source bundle to R2. Check the R2 keys and configure a separate private bucket." }, { status: 500 })
  }
}
