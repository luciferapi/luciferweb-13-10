import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET() {
  const keyId = process.env.RAZORPAY_KEY_ID
  if (!keyId) {
    return NextResponse.json({ error: "Razorpay is not configured on the server." }, { status: 503 })
  }

  return NextResponse.json({ key_id: keyId }, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  })
}
