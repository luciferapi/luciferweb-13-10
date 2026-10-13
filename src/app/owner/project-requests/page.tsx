import { OwnerProjectRequestsPanel } from "@/features/owner/components/owner-project-requests-panel"
import { getOwnerWorkspaceAccess } from "@/features/auth/server/owner-access"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function OwnerProjectRequestsRoutePage() {
  const access = await getOwnerWorkspaceAccess()
  if (!access) redirect("/login?next=/owner/project-requests")

  if (!access.isPrimaryOwner && !access.modules.includes("project-requests")) {
    redirect("/owner")
  }

  return <OwnerProjectRequestsPanel />
}
