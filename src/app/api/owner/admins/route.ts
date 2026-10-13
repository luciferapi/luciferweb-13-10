import { NextResponse } from "next/server"
import { z } from "zod"
import { getOwnerWorkspaceAccess, requirePrimaryOwnerAccess } from "@/features/auth/server/owner-access"
import { saveOwnerStaffAccess, removeOwnerStaffAccess, listOwnerStaff, staffRoles } from "@/features/owner/server/owner-staff"
import { ownerModules } from "@/features/owner/owner-modules"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const staffEmail = z.string().trim().email().max(320).transform((email) => email.toLowerCase())
const moduleSlugs = ownerModules.map((module) => module.slug).filter((slug) => slug !== "admins")
const saveSchema = z.object({
  email: staffEmail,
  role: z.enum(staffRoles),
  modules: z.array(z.enum(moduleSlugs as [string, ...string[]])).max(moduleSlugs.length).refine((modules) => new Set(modules).size === modules.length),
})
const removeSchema = z.object({ userId: z.string().uuid() })

export async function GET(request: Request) {
  const unauthorized = await requirePrimaryOwnerAccess()
  if (unauthorized) return unauthorized

  const rawEmail = new URL(request.url).searchParams.get("email")?.trim() ?? ""
  const parsedEmail = rawEmail ? staffEmail.safeParse(rawEmail) : null
  if (parsedEmail && !parsedEmail.success) {
    return NextResponse.json({ error: "Enter a valid email address to find a registered user." }, { status: 400 })
  }

  try {
    const result = await listOwnerStaff(parsedEmail?.success ? parsedEmail.data : "")
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not load owner staff and permissions.", error)
    return NextResponse.json({ error: "Could not load staff access." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const unauthorized = await requirePrimaryOwnerAccess()
  if (unauthorized) return unauthorized

  const parsed = saveSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Check the staff email, role, and selected modules." }, { status: 400 })
  const actor = await getOwnerWorkspaceAccess()
  if (!actor?.isPrimaryOwner) return NextResponse.json({ error: "Sign in as the primary owner to manage staff." }, { status: 401 })

  try {
    const status = await saveOwnerStaffAccess({
      actorUserId: actor.user.id,
      email: parsed.data.email,
      role: parsed.data.role,
      modules: parsed.data.modules,
    })
    if (status === "saved") return NextResponse.json({ success: true })
    if (status === "user_not_found") return NextResponse.json({ error: "No registered user exists for that email." }, { status: 404 })
    if (status === "user_blocked") return NextResponse.json({ error: "Unblock the user before granting staff access." }, { status: 409 })
    if (status === "protected_owner") return NextResponse.json({ error: "The primary owner account cannot be reassigned." }, { status: 409 })
    if (status === "invalid_role" || status === "invalid_modules" || status === "invalid_email") {
      return NextResponse.json({ error: "The staff role or module selection is invalid." }, { status: 400 })
    }
    if (status === "unauthorized") return NextResponse.json({ error: "Only the primary owner can manage staff access." }, { status: 403 })
    throw new Error(`Unexpected staff access result: ${status}`)
  } catch (error) {
    console.error("Could not save staff access.", error)
    return NextResponse.json({ error: "Could not save staff access." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requirePrimaryOwnerAccess()
  if (unauthorized) return unauthorized

  const parsed = removeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid staff account." }, { status: 400 })
  const actor = await getOwnerWorkspaceAccess()
  if (!actor?.isPrimaryOwner) return NextResponse.json({ error: "Sign in as the primary owner to manage staff." }, { status: 401 })

  try {
    const status = await removeOwnerStaffAccess(actor.user.id, parsed.data.userId)
    if (status === "removed") return NextResponse.json({ success: true })
    if (status === "not_staff") return NextResponse.json({ error: "That user does not have staff access." }, { status: 404 })
    if (status === "user_not_found") return NextResponse.json({ error: "The staff account was not found." }, { status: 404 })
    if (status === "cannot_remove_self" || status === "protected_owner") {
      return NextResponse.json({ error: "The primary owner account cannot be removed." }, { status: 409 })
    }
    if (status === "unauthorized") return NextResponse.json({ error: "Only the primary owner can manage staff access." }, { status: 403 })
    throw new Error(`Unexpected staff removal result: ${status}`)
  } catch (error) {
    console.error("Could not remove staff access.", error)
    return NextResponse.json({ error: "Could not remove staff access." }, { status: 500 })
  }
}
