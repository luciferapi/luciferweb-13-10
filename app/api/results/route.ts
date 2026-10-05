import { NextResponse } from "next/server"
import { getApiEndpointUrl, listApiEndpoints } from "@/lib/api-endpoints"
import { getSignedInUser } from "@/lib/auth-session"

export async function GET(request: Request) {
  if (!await getSignedInUser()) {
    return NextResponse.json({ error: "Sign in required to view API results." }, { status: 401 })
  }

  const key = new URL(request.url).searchParams.get("source")
  if (!key || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(key)) {
    return NextResponse.json({ error: "Unknown API source" }, { status: 400 })
  }

  try {
    const endpoint = (await listApiEndpoints()).find((entry) => entry.id === key)
    if (!endpoint) return NextResponse.json({ error: "Unknown API source" }, { status: 404 })

    const response = await fetch(getApiEndpointUrl(endpoint.path), { headers: { Accept: "application/json" }, next: { revalidate: 30 } })
    const text = await response.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    return NextResponse.json({ source: key, data, fetchedAt: new Date().toISOString() }, { status: response.status })
  } catch (error) {
    console.error("The configured upstream API could not be reached.", error)
    return NextResponse.json({ error: "The upstream API could not be reached." }, { status: 502 })
  }
}

export const runtime = "nodejs"
