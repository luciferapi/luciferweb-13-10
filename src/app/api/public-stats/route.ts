import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

export const revalidate = 30

export async function GET() {
  const client = getSupabaseAdminClient()
  if (!client) {
    return NextResponse.json({ totalProjects: 0, totalPurchases: 0 }, { status: 503 })
  }

  const [projects, projectPurchases, apiPurchases] = await Promise.all([
    client.from("projects").select("id", { count: "exact", head: true }).eq("is_published", true),
    client.from("project_purchases").select("id", { count: "exact", head: true }).eq("status", "paid"),
    client.from("api_endpoint_purchases").select("id", { count: "exact", head: true }).eq("status", "paid"),
  ])

  const error = projects.error ?? projectPurchases.error ?? apiPurchases.error
  if (error) {
    return NextResponse.json({ error: "Unable to load public stats." }, { status: 500 })
  }

  return NextResponse.json({
    totalProjects: projects.count ?? 0,
    totalPurchases: (projectPurchases.count ?? 0) + (apiPurchases.count ?? 0),
  })
}
