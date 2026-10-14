import { NextResponse } from "next/server"
import { z } from "zod"
import { randomUUID } from "node:crypto"
import {
  createApiEndpoint,
  deleteApiEndpoint,
  listApiEndpoints,
  updateApiEndpoint,
} from "@/features/api-endpoints/server/api-endpoints"
import { findAvailableApiEndpointCode } from "@/features/api-endpoints/server/api-endpoint-codes"
import { isProjectDemoVideoName } from "@/features/projects/server/project-demo-videos"
import { requireOwnerAccess } from "@/features/auth/server/owner-access"
import { getApiEndpointUrl } from "@/features/api-endpoints/server/api-endpoint-url"

export const runtime = "nodejs"

function isAllowedEndpointUrl(value: string): boolean {
  if (/[\u0000-\u001f\u007f\\]/.test(value)) {
    return false
  }
  try {
    const url = getApiEndpointUrl(value)
    if (url.origin === "https://luciferapi.com") {
      const pathname = /^[a-z][a-z\d+.-]*:/i.test(value) ? url.pathname : value.split(/[?#]/, 1)[0]
      const decodedPath = decodeURIComponent(pathname ?? "")
      if (decodedPath.split("/").some((segment) => segment === "." || segment === "..")) return false
    }
    return true
  } catch {
    return false
  }
}

const endpointPath = z.string().trim().min(1).max(2000)
  .refine(isAllowedEndpointUrl, "Use a valid HTTPS URL on a public hostname.")

const endpointFields = {
  name: z.string().trim().min(1).max(100),
  path: endpointPath,
  note: z.string().trim().max(300),
  category: z.string().trim().min(1).max(60),
  ownerType: z.string().trim().max(128),
  imageUrl: z.string().trim().max(500).refine((value) => !value || (value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//i.test(value)),
  demoVideo: z.string().trim().max(500).refine((value) => !value || isProjectDemoVideoName(value) || /^https?:\/\//i.test(value)),
  linkUrl: z.string().trim().max(300).refine((value) => !value || /^https?:\/\//i.test(value)),
  isEnabled: z.boolean(),
  pricePaise: z.number().int().min(0).max(1_000_000_000).refine((value) => value === 0 || value >= 100),
}

const endpointInput = z.object(endpointFields)
const idInput = z.object({ id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,127}$/) })

function apiEndpointSchemaMigrationError(error: unknown): NextResponse | null {
  if (typeof error !== "object" || error === null) return null
  const code = "code" in error && typeof error.code === "string" ? error.code : ""
  const message = "message" in error && typeof error.message === "string" ? error.message : ""
  if (code !== "ER_BAD_FIELD_ERROR" || !/unknown column '(?:price_paise|owner_type)'/i.test(message)) return null
  return NextResponse.json(
    { error: "The API database is missing required columns. Apply database/migrations/008_api_endpoint_storage_columns.sql, then retry." },
    { status: 503 },
  )
}

export async function GET() {
  const unauthorized = await requireOwnerAccess("apis")
  if (unauthorized) return unauthorized

  try {
    return NextResponse.json({ endpoints: await listApiEndpoints(true) }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Could not load API endpoint management data.", error)
    const migrationError = apiEndpointSchemaMigrationError(error)
    if (migrationError) return migrationError
    return NextResponse.json({ error: "Could not load API endpoints." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireOwnerAccess("apis")
  if (unauthorized) return unauthorized

  const parsed = endpointInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Check the API endpoint details and try again." }, { status: 400 })

  try {
    for (;;) {
      const existing = await listApiEndpoints(true)
      const endpoint = {
        id: findAvailableApiEndpointCode(parsed.data.name, existing.map((entry) => entry.id), randomUUID()),
        ...parsed.data,
      }
      try {
        await createApiEndpoint(endpoint)
        return NextResponse.json({ endpoint }, { status: 201 })
      } catch (error) {
        if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "ER_DUP_ENTRY") {
          throw error
        }
      }
    }
  } catch (error) {
    console.error("Could not save API endpoint.", error)
    const migrationError = apiEndpointSchemaMigrationError(error)
    if (migrationError) return migrationError
    return NextResponse.json({ error: "Could not save the API endpoint." }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const unauthorized = await requireOwnerAccess("apis")
  if (unauthorized) return unauthorized

  const parsed = z.object({ ...endpointFields, ...idInput.shape }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Check the API endpoint details and try again." }, { status: 400 })

  try {
    const { id, ...fields } = parsed.data
    const endpoint = { id, ...fields }
    if (!await updateApiEndpoint(endpoint)) return NextResponse.json({ error: "API endpoint not found." }, { status: 404 })
    return NextResponse.json({ endpoint })
  } catch (error) {
    console.error("Could not update API endpoint.", error)
    const migrationError = apiEndpointSchemaMigrationError(error)
    if (migrationError) return migrationError
    return NextResponse.json({ error: "Could not update the API endpoint." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireOwnerAccess("apis")
  if (unauthorized) return unauthorized

  const parsed = idInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid API endpoint identifier." }, { status: 400 })

  try {
    if (!await deleteApiEndpoint(parsed.data.id)) return NextResponse.json({ error: "API endpoint not found." }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Could not delete API endpoint.", error)
    return NextResponse.json({ error: "Could not delete the API endpoint." }, { status: 500 })
  }
}
