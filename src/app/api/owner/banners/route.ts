import { NextResponse } from "next/server"
import { z } from "zod"
import { requireOwnerAccess } from "@/features/auth/server/owner-access"
import {
  createOwnerLiveBanner,
  deleteOwnerLiveBanner,
  listOwnerLiveBanners,
  updateOwnerLiveBanner,
} from "@/features/owner/server/owner-live-banners"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isAllowedBannerLink(value: string) {
  if (!value) return true
  if (/[\u0000-\u001f\u007f\\\s]/.test(value)) return false
  if (value.startsWith("/")) return !value.startsWith("//")

  try {
    const url = new URL(value)
    return (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
  } catch {
    return false
  }
}

const linkUrl = z.string()
  .trim()
  .max(500, "Link must be 500 characters or fewer.")
  .refine(isAllowedBannerLink, "Use a site path or a valid HTTP(S) link.")

function isAllowedBannerImageUrl(value: string) {
  if (!value) return true
  if (value.startsWith("/")) return /^\/api\/banner-image\/[a-f0-9-]+\.(jpg|jpeg|png|webp|gif)$/i.test(value)

  try {
    const url = new URL(value)
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}

const bannerFields = {
  message: z.string()
    .trim()
    .max(240, "Announcement must be 240 characters or fewer."),
  linkUrl: linkUrl.transform((value) => value || null),
  imageUrl: z.string()
    .trim()
    .max(2000, "Banner image URL must be 2,000 characters or fewer.")
    .refine(isAllowedBannerImageUrl, "Upload an image or use a valid HTTPS image URL.")
    .transform((value) => value || null),
  isEnabled: z.boolean({ invalid_type_error: "Choose whether the banner is live." }),
  sortOrder: z.number()
    .int("Display order must be a whole number.")
    .min(0, "Display order cannot be negative.")
    .max(10000, "Display order must be 10,000 or less."),
}

const idInput = z.object({ id: z.string().uuid() })
const hasBannerContent = (value: { message: string; imageUrl: string | null }) =>
  value.message.length > 0 || Boolean(value.imageUrl)
const bannerInput = z.object(bannerFields).refine(hasBannerContent, {
  message: "Add announcement text or upload a banner image.",
})
const bannerUpdateInput = z.object({ ...bannerFields, ...idInput.shape }).refine(hasBannerContent, {
  message: "Add announcement text or upload a banner image.",
})

function getDatabaseError(error: unknown) {
  if (typeof error !== "object" || error === null) return null
  const code = "code" in error && typeof error.code === "string" ? error.code : ""
  const message = "message" in error && typeof error.message === "string" ? error.message : ""
  const details = "details" in error && typeof error.details === "string" ? error.details : ""
  const hint = "hint" in error && typeof error.hint === "string" ? error.hint : ""
  return { code, message, details, hint, combined: `${message} ${details}` }
}

function getBannerSaveError(error: unknown) {
  if (error instanceof Error && error.message.includes("banner image URL in private R2 storage")) {
    return {
      status: 503,
      message: "Could not save the banner image reference in private R2. Check the private bucket name and R2 access permissions, then retry.",
    }
  }
  if (error instanceof Error && (error.message.includes("Cloudflare R2") || error.message.includes("CLOUDFLARE_R2"))) {
    return { status: 503, message: error.message }
  }
  const databaseError = getDatabaseError(error)
  if (
    databaseError?.code === "42P01" ||
    (databaseError?.code === "PGRST205" && databaseError.combined.includes("owner_live_banners"))
  ) {
    return {
      status: 409,
      message: "The live banner table is missing. Apply the project migrations with `npx supabase db push`, then retry.",
    }
  }
  return null
}

function logBannerSaveFailure(operation: string, error: unknown) {
  const databaseError = getDatabaseError(error)
  if (databaseError) {
    console.error(operation, {
      code: databaseError.code || undefined,
      message: databaseError.message || undefined,
      details: databaseError.details || undefined,
      hint: databaseError.hint || undefined,
    })
    return
  }
  console.error(operation, error)
}

export async function GET() {
  const unauthorized = await requireOwnerAccess("banners")
  if (unauthorized) return unauthorized
  try {
    return NextResponse.json({ banners: await listOwnerLiveBanners() }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Could not load live banner management data.", error)
    return NextResponse.json({ error: "Could not load live banners." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireOwnerAccess("banners")
  if (unauthorized) return unauthorized
  const parsed = bannerInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the banner details and try again." }, { status: 400 })
  }

  try {
    return NextResponse.json({ banner: await createOwnerLiveBanner(parsed.data) }, { status: 201 })
  } catch (error) {
    logBannerSaveFailure("Could not create a live banner.", error)
    const failure = getBannerSaveError(error)
    if (failure) return NextResponse.json({ error: failure.message }, { status: failure.status })
    return NextResponse.json({ error: "Could not save the live banner." }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const unauthorized = await requireOwnerAccess("banners")
  if (unauthorized) return unauthorized
  const parsed = bannerUpdateInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the banner details and try again." }, { status: 400 })
  }

  try {
    const { id, ...fields } = parsed.data
    const banner = await updateOwnerLiveBanner(id, fields)
    if (!banner) return NextResponse.json({ error: "Live banner not found." }, { status: 404 })
    return NextResponse.json({ banner })
  } catch (error) {
    logBannerSaveFailure("Could not update a live banner.", error)
    const failure = getBannerSaveError(error)
    if (failure) return NextResponse.json({ error: failure.message }, { status: failure.status })
    return NextResponse.json({ error: "Could not update the live banner." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireOwnerAccess("banners")
  if (unauthorized) return unauthorized
  const parsed = idInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid banner identifier." }, { status: 400 })
  try {
    if (!await deleteOwnerLiveBanner(parsed.data.id)) {
      return NextResponse.json({ error: "Live banner not found." }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Could not delete a live banner.", error)
    return NextResponse.json({ error: "Could not delete the live banner." }, { status: 500 })
  }
}
