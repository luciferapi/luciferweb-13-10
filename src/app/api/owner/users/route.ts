import { NextResponse } from "next/server"
import { z } from "zod"
import { getOwnerWorkspaceAccess, requireOwnerAccess } from "@/features/auth/server/owner-access"
import { adjustOwnerUserWallet, deleteOwnerUser, listOwnerUsers, setOwnerUserBlocked, updateOwnerUser } from "@/features/owner/server/owner-users"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const userId = z.string().uuid()
const profileSchema = z.object({
  id: userId,
  name: z.string().trim().min(1).max(100),
  email: z.union([z.string().trim().email().max(320), z.literal("")]).transform((value) => value.toLowerCase() || null),
  dateOfBirth: z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`)
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    }),
    z.literal(""),
  ]).transform((value) => value || null),
  telegramUsername: z.string().trim().max(64).transform((value) => value || null),
  xUsername: z.string().trim().max(64).transform((value) => value || null),
})
const patchSchema = z.object({
  action: z.literal("set-blocked"),
  id: userId,
  isBlocked: z.boolean(),
})
const deleteSchema = z.object({ id: userId })
const walletAdjustmentSchema = z.object({
  id: userId,
  direction: z.enum(["credit", "debit"]),
  amountPaise: z.number().int().min(1).max(1_000_000_000),
  reason: z.string().trim().min(3).max(500),
})
const statusFilter = z.enum(["all", "active", "blocked"]).catch("all")

export async function GET(request: Request) {
  const unauthorized = await requireOwnerAccess("users")
  if (unauthorized) return unauthorized

  const params = new URL(request.url).searchParams
  const pageValue = Number(params.get("page") ?? "1")
  if (!Number.isInteger(pageValue) || pageValue < 1 || pageValue > 100_000) {
    return NextResponse.json({ error: "Invalid user page." }, { status: 400 })
  }

  try {
    const result = await listOwnerUsers(
      pageValue,
      params.get("search") ?? "",
      statusFilter.parse(params.get("status")),
    )
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not load owner user management data.", error)
    return NextResponse.json({ error: "Could not load user records." }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const unauthorized = await requireOwnerAccess("users")
  if (unauthorized) return unauthorized

  const parsed = profileSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Check the user details and try again." }, { status: 400 })
  const actor = await getOwnerWorkspaceAccess()
  if (!actor) return NextResponse.json({ error: "Sign in to edit user details." }, { status: 401 })

  try {
    const { id, ...fields } = parsed.data
    const result = await updateOwnerUser(actor.user.id, id, fields)
    if (result === "not_found") return NextResponse.json({ error: "User not found." }, { status: 404 })
    if (result === "primary_owner") return NextResponse.json({ error: "The primary owner email cannot be changed here." }, { status: 409 })
    if (result === "email_required") return NextResponse.json({ error: "Users with a linked email sign-in must keep an email address." }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Could not update owner-managed user details.", error)
    if (error instanceof Error && error.message === "That email address is already assigned to another user.") {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not update the user.",
    }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireOwnerAccess("users")
  if (unauthorized) return unauthorized

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid user status update." }, { status: 400 })

  const actor = await getOwnerWorkspaceAccess()
  if (!actor) return NextResponse.json({ error: "Sign in to change user status." }, { status: 401 })

  try {
    const result = await setOwnerUserBlocked(actor.user.id, parsed.data.id, parsed.data.isBlocked)
    if (result === "updated" || result === "unchanged") return NextResponse.json({ success: true })
    if (result === "user_not_found") return NextResponse.json({ error: "User not found." }, { status: 404 })
    if (result === "primary_admin") return NextResponse.json({ error: "The primary owner cannot be blocked." }, { status: 409 })
    if (result === "admin_must_be_revoked_first") return NextResponse.json({ error: "Remove owner-admin access before blocking this user." }, { status: 409 })
    if (result === "unauthorized") return NextResponse.json({ error: "You are not authorized to change user status." }, { status: 403 })
    throw new Error(`Unexpected user status result: ${result}`)
  } catch (error) {
    console.error("Could not update owner-managed user status.", error)
    return NextResponse.json({ error: "Could not update the user status." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireOwnerAccess("wallet")
  if (unauthorized) return unauthorized

  const parsed = walletAdjustmentSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Check the wallet adjustment details and try again." }, { status: 400 })

  const actor = await getOwnerWorkspaceAccess()
  if (!actor) return NextResponse.json({ error: "Sign in to adjust user wallets." }, { status: 401 })

  try {
    const result = await adjustOwnerUserWallet({
      actorUserId: actor.user.id,
      targetUserId: parsed.data.id,
      direction: parsed.data.direction,
      amountPaise: parsed.data.amountPaise,
      reason: parsed.data.reason,
    })
    if (result.status === "adjusted" && result.balancePaise !== undefined) {
      return NextResponse.json({ success: true, balancePaise: result.balancePaise })
    }
    if (result.status === "user_not_found") return NextResponse.json({ error: "User not found." }, { status: 404 })
    if (result.status === "insufficient_balance") return NextResponse.json({ error: "Debit amount exceeds the user's available wallet balance." }, { status: 409 })
    if (result.status === "unauthorized") return NextResponse.json({ error: "You are not authorized to adjust user wallets." }, { status: 403 })
    if (result.status === "invalid_adjustment") return NextResponse.json({ error: "The wallet adjustment is invalid." }, { status: 400 })
    throw new Error(`Unexpected wallet adjustment result: ${result.status}`)
  } catch (error) {
    console.error("Could not adjust owner-managed user wallet.", error)
    return NextResponse.json({ error: "Could not adjust the user's wallet." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireOwnerAccess("users")
  if (unauthorized) return unauthorized

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid user identifier." }, { status: 400 })

  const actor = await getOwnerWorkspaceAccess()
  if (!actor) return NextResponse.json({ error: "Sign in to delete users." }, { status: 401 })

  try {
    const result = await deleteOwnerUser(actor.user.id, parsed.data.id)
    if (result === "deleted") return NextResponse.json({ success: true })
    if (result === "not_found") return NextResponse.json({ error: "User not found." }, { status: 404 })
    if (result === "cannot_delete_self") return NextResponse.json({ error: "You cannot delete your own owner account." }, { status: 409 })
    if (result === "protected_admin") return NextResponse.json({ error: "Remove owner-admin access before deleting this user." }, { status: 409 })
    throw new Error(`Unexpected user deletion result: ${result}`)
  } catch (error) {
    console.error("Could not delete owner-managed user.", error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not delete the user.",
    }, { status: 500 })
  }
}
