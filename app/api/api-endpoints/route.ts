import { NextResponse } from "next/server"
import { listApiEndpoints } from "@/lib/api-endpoints"
import { getSignedInUser } from "@/lib/auth-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  if (!await getSignedInUser()) {
    return NextResponse.json({ error: "Sign in required to view API endpoints." }, { status: 401 })
  }

  try {
    const endpoints = await listApiEndpoints()
    return NextResponse.json({ endpoints }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not load the API endpoint catalog.", error)
    return NextResponse.json({ error: "Could not load the API endpoint catalog." }, { status: 500 })
  }
}
