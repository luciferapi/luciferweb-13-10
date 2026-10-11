import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { getOwnerWorkspaceAccess } from "@/features/auth/server/owner-access"
import "./owner.css"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Owner Workspace | LUCIFER AI",
  description: "Private LUCIFER AI owner and administration workspace.",
  robots: { index: false, follow: false },
}

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const access = await getOwnerWorkspaceAccess()
  if (!access) redirect("/sign-in?next=/owner")

  return <div className="owner-dashboard">{children}</div>
}