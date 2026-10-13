import { NextResponse } from "next/server"
import { getMysqlPool } from "@/lib/mysql"
import { resolveSmtpConfiguration, verifySmtpConfiguration } from "@/lib/smtp-server"
import { verifyCloudflareR2Configuration } from "@/features/storage/server/r2-storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function checkService(name: string, check: () => Promise<void>) {
  try {
    await check()
    return { name, status: "ok" as const }
  } catch (error) {
    return {
      name,
      status: "error" as const,
      error: error instanceof Error ? error.message : "Service check failed.",
    }
  }
}

export async function GET() {
  const checks = await Promise.all([
    checkService("mysql", async () => {
      await getMysqlPool().query("SELECT 1")
    }),
    checkService("smtp", async () => {
      resolveSmtpConfiguration()
      await verifySmtpConfiguration()
    }),
    checkService("r2", async () => {
      await verifyCloudflareR2Configuration()
    }),
  ])

  const healthy = checks.every((check) => check.status === "ok")
  return NextResponse.json(
    { status: healthy ? "ok" : "error", services: checks },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  )
}

