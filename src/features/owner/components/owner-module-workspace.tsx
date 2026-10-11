import { AlertCircle, CheckCircle2, CircleDashed } from "lucide-react"
import { OwnerProjectsPanel } from "@/features/owner/components/owner-projects-panel"
import { OwnerProjectRequestsPanel } from "@/features/owner/components/owner-project-requests-panel"
import { OwnerApiEndpointsPanel } from "@/features/owner/components/owner-api-endpoints-panel"
import { OwnerReferralsPanel } from "@/features/owner/components/owner-referrals-panel"
import { OwnerUsersPanel } from "@/features/owner/components/owner-users-panel"
import { OwnerWalletPanel } from "@/features/owner/components/owner-wallet-panel"
import { OwnerPaymentsPanel } from "@/features/owner/components/owner-payments-panel"
import { OwnerAdminsPanel } from "@/features/owner/components/owner-admins-panel"
import { OwnerSupportPanel } from "@/features/owner/components/owner-support-panel"
import { OwnerBannersPanel } from "@/features/owner/components/owner-banners-panel"
import { OwnerAnalyticsPanel } from "@/features/owner/components/owner-analytics-panel"
import { OwnerBroadcastsPanel } from "@/features/owner/components/owner-broadcasts-panel"
import { OwnerMaintenancePanel } from "@/features/owner/components/owner-maintenance-panel"
import { OwnerWorkspaceShell } from "@/features/owner/components/owner-workspace-shell"
import type { OwnerModule } from "@/features/owner/owner-modules"

export function OwnerModuleWorkspace({
  module,
  allowedModules,
  viewerName,
  viewerRole,
}: {
  module: OwnerModule
  allowedModules?: string[] | null
  viewerName?: string
  viewerRole?: string
}) {
  return (
    <OwnerWorkspaceShell
      activePath={`/owner/${module.slug}`}
      allowedModules={allowedModules}
      viewerName={viewerName}
      viewerRole={viewerRole}
    >
      <main className="owner-module-workspace">
        <section className="owner-heading">
          <div>
            <p className="owner-kicker">{module.slug === "apis" ? "OWNER WORKSPACE" : `OWNER WORKSPACE / MODULE ${String(moduleIndex(module.slug)).padStart(2, "0")}`}</p>
            <h1>{module.title}</h1>
            <p>{module.slug === "apis" ? "Manage endpoint listings, access pricing, and public API details." : module.description.join(" · ")}</p>
          </div>
          <div className={module.live ? "owner-access-pill" : "owner-module-status"}>
            {module.live ? <CheckCircle2 aria-hidden="true" size={15} /> : <CircleDashed aria-hidden="true" size={15} />}
            {module.live ? "Operational tools available" : "Module workspace ready"}
          </div>
        </section>

        {module.slug === "projects" ? <OwnerProjectsPanel /> : null}
        {module.slug === "project-requests" ? <OwnerProjectRequestsPanel /> : null}
        {module.slug === "apis" ? <OwnerApiEndpointsPanel /> : null}
        {module.slug === "referrals" ? <OwnerReferralsPanel /> : null}
        {module.slug === "users" ? <OwnerUsersPanel /> : null}
        {module.slug === "wallet" ? <OwnerWalletPanel /> : null}
        {module.slug === "payments" ? <OwnerPaymentsPanel /> : null}
        {module.slug === "admins" ? <OwnerAdminsPanel /> : null}
        {module.slug === "support" ? <OwnerSupportPanel mode="support" /> : null}
        {module.slug === "escalations" ? <OwnerSupportPanel mode="escalations" /> : null}
        {module.slug === "banners" ? <OwnerBannersPanel /> : null}
        {module.slug === "analytics" ? <OwnerAnalyticsPanel /> : null}
        {module.slug === "broadcasts" ? <OwnerBroadcastsPanel /> : null}
        {module.slug === "maintenance" ? <OwnerMaintenancePanel /> : null}

        {!module.live ? (
          <section className="owner-module-notice" aria-labelledby="module-status-heading">
            <div className="owner-module-notice-icon"><AlertCircle aria-hidden="true" size={20} /></div>
            <div>
              <h2 id="module-status-heading">This module is not connected yet</h2>
              <p>
                This dedicated page and its navigation are ready, but its data and actions have not been
                connected to the application yet. No sample records or placeholder totals are shown.
              </p>
            </div>
          </section>
        ) : null}

      </main>
    </OwnerWorkspaceShell>
  )
}

function moduleIndex(slug: string) {
  const order = [
    "projects", "project-requests", "apis", "users", "referrals", "wallet", "payments", "admins", "support",
    "escalations", "analytics", "enhancements", "banners", "broadcasts", "maintenance",
  ]
  return order.indexOf(slug) + 1
}
