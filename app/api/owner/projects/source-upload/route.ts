import { randomUUID } from "node:crypto"
import { mkdir, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import { readProjects } from "@/lib/project-store"
import { uploadToCloudflareR2 } from "@/lib/r2-storage"
import { MAX_SOURCE_BUNDLE_SIZE } from "@/lib/source-bundles"
import { requireOwnerAccess } from "@/lib/owner-access"

export const runtime = "nodejs"

function isZipArchive(bytes: Uint8Array) {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && (
    (bytes[2] === 0x03 && bytes[3] === 0x04) ||
    (bytes[2] === 0x05 && bytes[3] === 0x06) ||
    (bytes[2] === 0x07 && bytes[3] === 0x08)
  )
}

export async function POST(request: Request) {
  const unauthorized = await requireOwnerAccess()
  if (unauthorized) return unauthorized

  const formData = await request.formData().catch(() => null)
  const projectCode = formData?.get("project_code") ?? formData?.get("project_id")
  const sourceFile = formData?.get("source")
  if (typeof projectCode !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(projectCode) || !(sourceFile instanceof File)) {
    return NextResponse.json({ error: "Select a project and a ZIP source bundle." }, { status: 400 })
  }
  if (!sourceFile.name.toLowerCase().endsWith(".zip") || sourceFile.size === 0 || sourceFile.size > MAX_SOURCE_BUNDLE_SIZE) {
    return NextResponse.json({ error: "Upload a non-empty ZIP archive no larger than 100 MB." }, { status: 400 })
  }

  try {
    const projectExists = (await readProjects()).some((project) => project.code === projectCode)
    if (!projectExists) return NextResponse.json({ error: "Project not found." }, { status: 404 })

    const bytes = Buffer.from(await sourceFile.arrayBuffer())
    if (!isZipArchive(bytes)) return NextResponse.json({ error: "The uploaded file is not a valid ZIP archive." }, { status: 400 })

    const remoteUpload = await uploadToCloudflareR2(
      `source-bundles/${projectCode}.zip`,
      bytes,
      "application/zip",
      { isPublic: false },
    )
    if (remoteUpload) {
      return NextResponse.json({ success: true, filename: `${projectCode}.zip`, size: bytes.length })
    }

    const directory = path.join(process.cwd(), "projects")
    const targetPath = path.join(directory, `${projectCode}.zip`)
    const temporaryPath = path.join(directory, `.${projectCode}.${randomUUID()}.tmp`)
    await mkdir(directory, { recursive: true })
    await writeFile(temporaryPath, bytes, { flag: "wx" })
    await rename(temporaryPath, targetPath)

    return NextResponse.json({ success: true, filename: `${projectCode}.zip`, size: bytes.length })
  } catch (error) {
    console.error("Could not save the project source bundle.", error)
    return NextResponse.json({ error: "Could not save the source bundle." }, { status: 500 })
  }
}