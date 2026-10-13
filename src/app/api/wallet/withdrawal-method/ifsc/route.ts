import { NextResponse } from "next/server"
import { getSignedInUser } from "@/features/auth/server/auth-session"
import { isSupportedWithdrawalIfsc, supportedWithdrawalBanks } from "@/features/wallet/server/withdrawal-method-banks"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function GET(request: Request) {
  try {
    if (!await getSignedInUser()) {
      return NextResponse.json({ error: "Sign in to look up bank branches." }, { status: 401 })
    }

    const ifscCode = new URL(request.url).searchParams.get("ifscCode")?.trim().toUpperCase() ?? ""
    if (!isSupportedWithdrawalIfsc(ifscCode)) {
      return NextResponse.json(
        { error: "Enter a complete IFSC code for one of the supported banks." },
        { status: 400 },
      )
    }

    const bankCode = ifscCode.slice(0, 4)
    if (!supportedWithdrawalBanks.some((bank) => bank.code === bankCode)) {
      return NextResponse.json({ error: "This bank is not supported." }, { status: 400 })
    }

    const response = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(ifscCode)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    })

    if (response.status === 404) {
      return NextResponse.json({ error: "No branch was found for this IFSC code." }, { status: 404 })
    }
    if (!response.ok) {
      throw new Error(`IFSC directory returned HTTP ${response.status}.`)
    }

    const data: unknown = await response.json()
    if (!isRecord(data)) {
      throw new Error("IFSC directory returned an invalid response.")
    }

    const returnedIfsc = stringField(data.IFSC).toUpperCase()
    const returnedBankCode = stringField(data.BANKCODE).toUpperCase()
    const branch = stringField(data.BRANCH)
    const bank = stringField(data.BANK)
    if (
      returnedIfsc !== ifscCode ||
      returnedBankCode !== bankCode ||
      !branch ||
      !bank
    ) {
      return NextResponse.json(
        { error: "The IFSC code does not match the selected bank or a known branch." },
        { status: 404 },
      )
    }

    return NextResponse.json(
      {
        branch: {
          ifsc: returnedIfsc,
          bank,
          branch,
          city: stringField(data.CITY),
          district: stringField(data.DISTRICT),
          state: stringField(data.STATE),
          address: stringField(data.ADDRESS),
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("Could not look up the bank branch for the IFSC code.", error)
    return NextResponse.json(
      { error: "Branch lookup is temporarily unavailable. Try again shortly." },
      { status: 502 },
    )
  }
}
