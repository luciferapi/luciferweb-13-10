import { OwnerProjectRequestsHistoryPage } from "@/features/owner/components/owner-project-requests-history-page"
import { OwnerWorkspaceShell } from "@/features/owner/components/owner-workspace-shell"
import { getOwnerWorkspaceAccess } from "@/features/auth/server/owner-access"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function OwnerProjectRequestsHistoryRoutePage() {
  const access = await getOwnerWorkspaceAccess()
  if (!access) redirect("/login?next=/owner/project-requests/history")

  if (!access.isPrimaryOwner && !access.modules.includes("project-requests")) {
    redirect("/owner")
  }

  return (
    <OwnerWorkspaceShell
      activePath="/owner/project-requests"
      allowedModules={access.isPrimaryOwner ? null : access.modules}
      viewerName={access.user.name}
      viewerRole={access.isPrimaryOwner ? "Primary owner" : access.role.replace("_", " ")}
    >
      <OwnerProjectRequestsHistoryPage />
    </OwnerWorkspaceShell>
  )
}
