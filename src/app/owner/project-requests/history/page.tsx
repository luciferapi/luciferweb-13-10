import { OwnerProjectRequestsHistoryPage } from "@/features/owner/components/owner-project-requests-history-page"
import { getOwnerWorkspaceAccess } from "@/features/auth/server/owner-access"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function OwnerProjectRequestsHistoryRoutePage() {
  const access = await getOwnerWorkspaceAccess()
  if (!access) redirect("/login?next=/owner/project-requests/history")

  if (!access.isPrimaryOwner && !access.modules.includes("project-requests")) {
    redirect("/owner")
  }

  return <OwnerProjectRequestsHistoryPage />
}
