import { NextResponse } from "next/server"
import { listApiEndpoints } from "@/features/api-endpoints/server/api-endpoints"
import { listPaidApiEndpointIds } from "@/features/api-endpoints/server/api-purchases"
import { getSignedInUser } from "@/features/auth/server/auth-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const user = await getSignedInUser()
  if (!user) {
    return NextResponse.json({ error: "Sign in required to view API endpoints." }, { status: 401 })
  }

  try {
    const [endpoints, ownedEndpointIds] = await Promise.all([
      listApiEndpoints(),
      listPaidApiEndpointIds(user.id),
    ])
    const ownedIds = new Set(ownedEndpointIds)
    const visibleEndpoints = endpoints.map((endpoint) =>
      endpoint.pricePaise > 0 && !ownedIds.has(endpoint.id)
        ? { ...endpoint, path: "" }
        : endpoint,
    )
    return NextResponse.json({ endpoints: visibleEndpoints, ownedEndpointIds }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not load the API endpoint catalog.", error)
    return NextResponse.json({ error: "Could not load the API endpoint catalog." }, { status: 500 })
  }
}
