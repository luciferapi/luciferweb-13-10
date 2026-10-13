import { NextResponse } from "next/server"
import { getRazorpayCredentials } from "@/features/payments/server/razorpay-server"

export const runtime = "nodejs"

export async function GET() {
  const credentials = getRazorpayCredentials()
  if (!credentials) {
    return NextResponse.json({ error: "Razorpay is not configured on the server." }, { status: 503 })
  }

  return NextResponse.json({ key_id: credentials.keyId }, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  })
}
