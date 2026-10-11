import { OwnerProjectsPanel } from "@/features/owner/components/owner-projects-panel"
import { OwnerReferralsPanel } from "@/features/owner/components/owner-referrals-panel"
import Link from "next/link"
import { BadgeCheck } from "lucide-react"
import { OwnerWorkspaceShell } from "@/features/owner/components/owner-workspace-shell"
import { ownerModules } from "@/features/owner/owner-modules"
import { getOwnerWorkspaceAccess } from "@/features/auth/server/owner-access"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function OwnerPage() {
  const access = await getOwnerWorkspaceAccess()
  if (!access) redirect("/sign-in?next=/owner")
  const visibleModules = ownerModules.filter((module) => access.isPrimaryOwner || access.modules.includes(module.slug))

  return (
    <OwnerWorkspaceShell
      activePath="/owner"
      allowedModules={access.isPrimaryOwner ? null : access.modules}
      viewerName={access.user.name}
      viewerRole={access.isPrimaryOwner ? "Primary owner" : access.role.replace("_", " ")}
    >
      <main className="owner-overview">
        <section className="owner-heading" id="owner-overview">
          <div>
            <p className="owner-kicker">OWNER WORKSPACE</p>
            <h1>Dashboard &amp; Analytics</h1>
            <p>Manage operations, user activity, billing, campaigns, and platform health from one control center.</p>
          </div>
          <div className="owner-access-pill"><span aria-hidden="true" /> {access.isPrimaryOwner ? "Secure owner session" : `${access.role.replace("_", " ")} session`}</div>
        </section>

        <section className="owner-overview-stats" aria-label="Module availability">
          {[
            { label: "Your modules", value: visibleModules.length, detail: "Workspaces you can access" },
            { label: "Connected tools", value: visibleModules.filter((module) => module.live).length, detail: "Operational modules" },
            { label: "Not connected", value: visibleModules.filter((module) => !module.live).length, detail: "Available module pages" },
          ].map((stat) => (
            <article key={stat.label} className="owner-stat-card">
              <span className="owner-stat-label">{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.detail}</small>
            </article>
          ))}
        </section>

        <section className="owner-module-section" aria-label="Management modules">
          <div className="owner-module-header">
            <div>
              <p className="owner-section-kicker">CORE OPERATIONS</p>
              <h2>Management modules</h2>
            </div>
            <div className="owner-module-status">
              <BadgeCheck aria-hidden="true" size={14} /> {visibleModules.length} workspaces
            </div>
          </div>

          <div className="owner-module-grid">
            {visibleModules.map(({ slug, title, description, icon: Icon, live }, index) => (
              <Link key={slug} href={`/owner/${slug}`} className="owner-module-card">
                <div className="owner-module-topline">
                  <span className="owner-module-icon"><Icon aria-hidden="true" size={18} /></span>
                  <span className="owner-module-index">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3>{title}</h3>
                <ul>
                  {description.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <span className={`owner-module-link-status${live ? " is-live" : ""}`}>
                  {live ? "Tools available" : "Open module"}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {access.isPrimaryOwner ? (
          <section className="owner-content" id="owner-content" aria-label="Dashboard tools">
            <OwnerProjectsPanel />
            <OwnerReferralsPanel />
          </section>
        ) : null}
      </main>
    </OwnerWorkspaceShell>
  )
}