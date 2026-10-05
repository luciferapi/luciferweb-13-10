import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { findUserBySession } from "@/lib/auth-store"
import { markProjectRequestCancelled } from "@/lib/project-request-store"

export const runtime = "nodejs"

const cancellationSchema = z.object({
  order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  status: z.enum(["cancelled", "failed"]),
})

export async function POST(request: Request) {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Sign in to update your project request payment." }, { status: 401 })

  const parsed = cancellationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request payment status." }, { status: 400 })

  try {
    const user = await findUserBySession(token)
    if (!user) return NextResponse.json({ error: "Sign in to update your project request payment." }, { status: 401 })
    const updated = await markProjectRequestCancelled(parsed.data.order_id, user.id, parsed.data.status)
    return NextResponse.json({ success: true, updated })
  } catch (error) {
    console.error("Could not update the project request payment status.", error)
    return NextResponse.json({ error: "Could not update your project request payment." }, { status: 500 })
  }
}
