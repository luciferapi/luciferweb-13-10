import Link from "next/link"
import { Activity, ArrowUpRight, BadgeCheck, CircleDashed, Layers3 } from "lucide-react"
import { OwnerProjectsPanel } from "@/features/owner/components/owner-projects-panel"
import { OwnerReferralsPanel } from "@/features/owner/components/owner-referrals-panel"
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
  if (!access) redirect("/login?next=/owner")
  const visibleModules = ownerModules.filter((module) => access.isPrimaryOwner || access.modules.includes(module.slug))
  const stats = [
    { label: "Your modules", value: visibleModules.length, detail: "Workspaces you can access", icon: Layers3, accent: "modules" },
    { label: "Connected tools", value: visibleModules.filter((module) => module.live).length, detail: "Operational modules", icon: Activity, accent: "live" },
    { label: "Not connected", value: visibleModules.filter((module) => !module.live).length, detail: "Available module pages", icon: CircleDashed, accent: "pending" },
  ]

  return (
    <OwnerWorkspaceShell
      activePath="/owner"
      allowedModules={access.isPrimaryOwner ? null : access.modules}
      viewerName={access.user.name}
      viewerRole={access.isPrimaryOwner ? "Primary owner" : access.role.replace("_", " ")}
    >
      <main className="owner-overview">
        <section className="owner-heading owner-overview-hero" id="owner-overview">
          <div>
            <p className="owner-kicker">OWNER WORKSPACE / OVERVIEW</p>
            <h1>Command center</h1>
            <p>Manage platform operations, customers, payments, and system health from one secure workspace.</p>
          </div>
          <div className="owner-access-pill"><span aria-hidden="true" /> {access.isPrimaryOwner ? "Secure owner session" : `${access.role.replace("_", " ")} session`}</div>
        </section>

        <section className="owner-overview-stats" aria-label="Module availability">
          {stats.map(({ label, value, detail, icon: Icon, accent }) => (
            <article key={label} className="owner-stat-card" data-stat={accent}>
              <div className="owner-stat-card-copy">
                <span className="owner-stat-label">{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </div>
              <span className="owner-stat-icon"><Icon aria-hidden="true" size={19} /></span>
            </article>
          ))}
        </section>

        <section className="owner-module-section" aria-label="Management modules">
          <div className="owner-module-header">
            <div>
              <p className="owner-section-kicker">YOUR CONTROL ROOM</p>
              <h2>Management modules</h2>
              <p className="owner-module-intro">Jump straight into the tools you use to run LUCIFER AI.</p>
            </div>
            <div className="owner-module-status">
              <BadgeCheck aria-hidden="true" size={14} /> {visibleModules.length} workspaces
            </div>
          </div>

          <div className="owner-module-grid">
            {visibleModules.map(({ slug, title, description, icon: Icon, live }, index) => (
              <Link key={slug} href={`/owner/${slug}`} className="owner-module-card" data-owner-module={slug}>
                <div className="owner-module-topline">
                  <span className="owner-module-icon"><Icon aria-hidden="true" size={19} /></span>
                  <span className="owner-module-index">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <span className="owner-module-card-eyebrow">{live ? "LIVE WORKSPACE" : "PLANNED WORKSPACE"}</span>
                <h3>{title}</h3>
                <ul>
                  {description.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <span className={`owner-module-link-status${live ? " is-live" : ""}`}>
                  <span>{live ? "Operational tools" : "Not connected"}</span>
                  <strong>Open workspace</strong>
                  <ArrowUpRight aria-hidden="true" size={17} />
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
