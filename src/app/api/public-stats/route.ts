import { NextResponse } from "next/server"
import { getMysqlPool, isMysqlConfigured } from "@/lib/mysql"
import type { RowDataPacket } from "mysql2"

export const revalidate = 30

export async function GET() {
  if (!isMysqlConfigured()) {
    // Keep the public homepage/API usable in local previews before MySQL is configured.
    // Once configured, the query below remains the source of truth for live counts.
    return NextResponse.json(
      { totalProjects: 0, totalPurchases: 0 },
      { headers: { "Cache-Control": "no-store" } },
    )
  }

  try {
    const [rows] = await getMysqlPool().execute<(RowDataPacket & {
      total_projects: number | string
      project_purchases: number | string
      api_purchases: number | string
    })[]>(
      `SELECT
         (SELECT COUNT(*) FROM projects WHERE is_published = TRUE) AS total_projects,
         (SELECT COUNT(*) FROM project_purchases WHERE status = 'paid') AS project_purchases,
         (SELECT COUNT(*) FROM api_endpoint_purchases WHERE status = 'paid') AS api_purchases`,
    )
    const stats = rows[0]
    if (!stats) throw new Error("The public statistics query returned no result.")
    const totalProjects = Number(stats.total_projects)
    const totalPurchases = Number(stats.project_purchases) + Number(stats.api_purchases)
    if (!Number.isSafeInteger(totalProjects) || !Number.isSafeInteger(totalPurchases)) {
      throw new Error("The public statistics are outside the supported integer range.")
    }
    return NextResponse.json({ totalProjects, totalPurchases })
  } catch (error) {
    console.error("Unable to load public stats from MySQL.", error)
    return NextResponse.json({ error: "Unable to load public stats." }, { status: 500 })
  }
}
