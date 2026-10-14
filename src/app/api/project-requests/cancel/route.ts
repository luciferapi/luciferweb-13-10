import { NextResponse } from "next/server"
import { getSignedInUser } from "@/features/auth/server/auth-session"
import { z } from "zod"
import { markProjectRequestCancelled } from "@/features/projects/server/project-request-store"

export const runtime = "nodejs"

const cancellationSchema = z.object({
  order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  status: z.enum(["cancelled", "failed"]),
})

export async function POST(request: Request) {

  const parsed = cancellationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request payment status." }, { status: 400 })

  try {
    const user = await getSignedInUser()
    if (!user) return NextResponse.json({ error: "Sign in to update your project request payment." }, { status: 401 })
    const updated = await markProjectRequestCancelled(parsed.data.order_id, user.id, parsed.data.status)
    return NextResponse.json({ success: true, updated })
  } catch (error) {
    console.error("Could not update the project request payment status.", error)
    return NextResponse.json({ error: "Could not update your project request payment." }, { status: 500 })
  }
}
