import { NextResponse } from "next/server"
import { listApiEndpoints } from "@/features/api-endpoints/server/api-endpoints"
import { requestApiEndpoint } from "@/features/api-endpoints/server/api-endpoint-url"
import { hasPaidApiEndpointAccess } from "@/features/api-endpoints/server/api-purchases"
import { getSignedInUser } from "@/features/auth/server/auth-session"

export async function GET(request: Request) {
  const user = await getSignedInUser()
  if (!user) {
    return NextResponse.json({ error: "Sign in required to view API results." }, { status: 401 })
  }

  const key = new URL(request.url).searchParams.get("source")
  if (!key || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(key)) {
    return NextResponse.json({ error: "Unknown API source" }, { status: 400 })
  }

  try {
    const endpoint = (await listApiEndpoints()).find((entry) => entry.id === key)
    if (!endpoint) return NextResponse.json({ error: "Unknown API source" }, { status: 404 })
    if (endpoint.pricePaise > 0 && !await hasPaidApiEndpointAccess(user.id, endpoint.id)) {
      return NextResponse.json({
        error: "Purchase this API's one-time Explorer access before testing it.",
        paymentRequired: true,
      }, { status: 402, headers: { "Cache-Control": "private, no-store" } })
    }

    const response = await requestApiEndpoint(endpoint.path)
    const text = response.text
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    return NextResponse.json(
      { source: key, data, fetchedAt: new Date().toISOString() },
      { status: response.status, headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("The configured upstream API could not be reached.", error)
    return NextResponse.json({ error: "The upstream API could not be reached." }, { status: 502 })
  }
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
