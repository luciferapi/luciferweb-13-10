import { getOwnerWorkspaceAccess } from "@/features/auth/server/owner-access"
import { OwnerModuleWorkspace } from "@/features/owner/components/owner-module-workspace"
import { ownerModules } from "@/features/owner/owner-modules"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function OwnerProjectRequestsRoutePage() {
  const access = await getOwnerWorkspaceAccess()
  if (!access) redirect("/login?next=/owner/project-requests")

  if (!access.isPrimaryOwner && !access.modules.includes("project-requests")) {
    redirect("/owner")
  }

  const module = ownerModules.find((entry) => entry.slug === "project-requests")
  if (!module) redirect("/owner")

  return (
    <OwnerModuleWorkspace
      module={module}
      allowedModules={access.isPrimaryOwner ? null : access.modules}
      viewerName={access.user.name}
      viewerRole={access.isPrimaryOwner ? "Primary owner" : access.role.replace("_", " ")}
    />
  )
}
