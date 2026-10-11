import { NextResponse } from "next/server"
import { z } from "zod"
import { requireOwnerAccess } from "@/features/auth/server/owner-access"
import { maintenanceDefaultMessage, maintenanceDefaultTitle } from "@/features/maintenance/maintenance-content"
import {
  createMaintenanceEntry,
  deleteMaintenanceEntry,
  listMaintenanceEntries,
  updateMaintenanceEntry,
} from "@/features/maintenance/server/maintenance-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const isAllowedImageUrl = (value: string) => {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === "https:" && Boolean(url.hostname)
  } catch {
    return false
  }
}

const maintenanceFields = {
  path: z.string().trim().min(1, "Add a page path for maintenance.").max(255, "Path must be 255 characters or fewer.").refine(
    (value) => value.startsWith("/") && !value.includes(" "),
    "Use a route like /projects, /wallet, or /owner/*.",
  ),
  title: z.string().trim().max(120, "Heading must be 120 characters or fewer.").transform((value) => value || maintenanceDefaultTitle),
  message: z.string().trim().max(500, "Message must be 500 characters or fewer.").transform((value) => value || maintenanceDefaultMessage),
  imageUrl: z.string().trim().max(2000, "Image URL must be 2,000 characters or fewer.").refine(isAllowedImageUrl, "Use a valid HTTPS image URL.").transform((value) => value || null),
  isEnabled: z.boolean({ invalid_type_error: "Choose whether maintenance is active." }),
  sortOrder: z.number().int("Order must be a whole number.").min(0).max(10000),
}

const maintenanceInput = z.object(maintenanceFields)
const idInput = z.object({ id: z.string().uuid() })

function getMaintenanceFailure(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "A maintenance entry already exists for this path.") {
      return { message: error.message, status: 409 }
    }
    if (error.message.includes("Cloudflare R2") || error.message.includes("CLOUDFLARE_R2")) {
      return { message: error.message, status: 503 }
    }
  }
  return { message: "Could not complete the maintenance request. Check the server logs for the R2 error.", status: 500 }
}

function logMaintenanceFailure(operation: string, error: unknown) {
  if (error instanceof Error) {
    console.error(operation, { message: error.message, cause: error.cause })
    return
  }
  if (typeof error === "object" && error !== null) {
    console.error(operation, {
      code: "code" in error && typeof error.code === "string" ? error.code : undefined,
      message: "message" in error && typeof error.message === "string" ? error.message : undefined,
      details: "details" in error && typeof error.details === "string" ? error.details : undefined,
      hint: "hint" in error && typeof error.hint === "string" ? error.hint : undefined,
    })
    return
  }

  console.error("Could not load maintenance entries.", error)
}

export async function GET() {
  const unauthorized = await requireOwnerAccess("maintenance")
  if (unauthorized) return unauthorized

  try {
    return NextResponse.json({ maintenance: await listMaintenanceEntries() }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    logMaintenanceFailure("Could not load maintenance entries.", error)
    const failure = getMaintenanceFailure(error)
    return NextResponse.json({ error: failure.message }, { status: failure.status })
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireOwnerAccess("maintenance")
  if (unauthorized) return unauthorized

  const parsed = maintenanceInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the maintenance details and try again." }, { status: 400 })
  }

  try {
    return NextResponse.json({ maintenance: await createMaintenanceEntry(parsed.data) }, { status: 201 })
  } catch (error) {
    logMaintenanceFailure("Could not create maintenance entry.", error)
    const failure = getMaintenanceFailure(error)
    return NextResponse.json({ error: failure.message }, { status: failure.status })
  }
}

export async function PUT(request: Request) {
  const unauthorized = await requireOwnerAccess("maintenance")
  if (unauthorized) return unauthorized

  const parsed = z.object({ ...maintenanceFields, ...idInput.shape }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the maintenance details and try again." }, { status: 400 })
  }

  try {
    const { id, ...fields } = parsed.data
    const entry = await updateMaintenanceEntry(id, fields)
    if (!entry) return NextResponse.json({ error: "Maintenance entry not found." }, { status: 404 })
    return NextResponse.json({ maintenance: entry })
  } catch (error) {
    logMaintenanceFailure("Could not update maintenance entry.", error)
    const failure = getMaintenanceFailure(error)
    return NextResponse.json({ error: failure.message }, { status: failure.status })
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireOwnerAccess("maintenance")
  if (unauthorized) return unauthorized

  const parsed = idInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid maintenance identifier." }, { status: 400 })

  try {
    if (!await deleteMaintenanceEntry(parsed.data.id)) {
      return NextResponse.json({ error: "Maintenance entry not found." }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    logMaintenanceFailure("Could not delete maintenance entry.", error)
    const failure = getMaintenanceFailure(error)
    return NextResponse.json({ error: failure.message }, { status: failure.status })
  }
}
