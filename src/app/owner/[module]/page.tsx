import { notFound } from "next/navigation"
import { OwnerModuleWorkspace } from "@/features/owner/components/owner-module-workspace"
import { ownerModules } from "@/features/owner/owner-modules"
import { getOwnerWorkspaceAccess } from "@/features/auth/server/owner-access"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function OwnerModulePage({
  params,
}: {
  params: Promise<{ module: string }>
}) {
  const { module: slug } = await params
  const module = ownerModules.find((item) => item.slug === slug)
  if (!module) notFound()
  const access = await getOwnerWorkspaceAccess()
  if (!access) redirect("/sign-in?next=/owner")
  if (!access.isPrimaryOwner && (!access.modules.includes(module.slug) || module.slug === "admins")) {
    redirect("/owner")
  }

  return (
    <OwnerModuleWorkspace
      module={module}
      allowedModules={access.isPrimaryOwner ? null : access.modules}
      viewerName={access.user.name}
      viewerRole={access.isPrimaryOwner ? "Primary owner" : access.role.replace("_", " ")}
    />
  )
}
