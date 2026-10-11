import { NextResponse } from "next/server"
import { getMaintenanceEntryByPath } from "@/features/maintenance/server/maintenance-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function logMaintenanceCheckFailure(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const metadata = "$metadata" in error && typeof error.$metadata === "object" && error.$metadata !== null
      ? error.$metadata
      : null
    const diagnostic = {
      name: "name" in error && typeof error.name === "string" ? error.name : undefined,
      message: "message" in error && typeof error.message === "string" ? error.message : undefined,
      code: "code" in error && typeof error.code === "string" ? error.code : undefined,
      statusCode: metadata && "httpStatusCode" in metadata ? metadata.httpStatusCode : undefined,
    }
    console.error(`Could not check maintenance status. ${JSON.stringify(diagnostic)}`)
    return
  }

  console.error("Could not check maintenance status.", error)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get("path") ?? "/"

  try {
    const maintenance = await getMaintenanceEntryByPath(path)
    return NextResponse.json({ maintenance: maintenance ? {
      path: maintenance.path,
      title: maintenance.title,
      message: maintenance.message,
      imageUrl: maintenance.imageUrl,
    } : null })
  } catch (error) {
    logMaintenanceCheckFailure(error)
    return NextResponse.json({ error: "Could not check maintenance status." }, { status: 500 })
  }
}
