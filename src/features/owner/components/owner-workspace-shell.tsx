import Link from "next/link"
import { Home, Instagram, LayoutDashboard } from "lucide-react"
import { ownerModules } from "@/features/owner/owner-modules"

const ownerNavGroups = [
  { label: "Operations", slugs: ["projects", "project-requests", "apis"] },
  { label: "People & finance", slugs: ["users", "referrals", "wallet", "payments", "support", "escalations"] },
  { label: "Platform", slugs: ["analytics", "admins", "maintenance", "banners", "broadcasts", "enhancements"] },
]

export function OwnerWorkspaceShell({
  activePath,
  allowedModules,
  viewerName,
  viewerRole,
  children,
}: {
  activePath: string
  allowedModules?: string[] | null
  viewerName?: string
  viewerRole?: string
  children: React.ReactNode
}) {
  const activeModule = ownerModules.find((module) => `/owner/${module.slug}` === activePath)
  const visibleModules = allowedModules === null || allowedModules === undefined
    ? ownerModules
    : ownerModules.filter((module) => allowedModules.includes(module.slug))
  const dashboardActive = activePath === "/owner"

  return (
    <div className="owner-frame">
      <aside className="owner-sidebar" aria-label="Owner dashboard navigation">
        <Link href="/" className="owner-brand">
          <span className="owner-brand-mark">
            <img src="/images/luciferai-brand-logo.jpg" alt="" />
            <span className="owner-brand-orbit" aria-hidden="true" />
          </span>
          <span>
            <strong>LUCIFER AI</strong>
            <small><i className="owner-brand-status-dot" aria-hidden="true" /> Control center</small>
          </span>
        </Link>

        <p className="owner-nav-label">Workspace</p>
        <nav className="owner-side-links" aria-label="Owner workspace">
          <Link
            href="/owner"
            className={`owner-side-link owner-dashboard-link${dashboardActive ? " owner-side-link-active" : ""}`}
            aria-current={dashboardActive ? "page" : undefined}
          >
            <LayoutDashboard aria-hidden="true" className="owner-nav-symbol" />
            Overview
          </Link>
          {ownerNavGroups.map((group) => {
            const modules = visibleModules.filter((module) => group.slugs.includes(module.slug))
            if (modules.length === 0) return null

            return (
              <div className="owner-nav-group" key={group.label} role="group" aria-label={group.label}>
                <p className="owner-nav-group-label">{group.label}</p>
                <div className="owner-nav-group-links">
                  {modules.map(({ slug, title, icon: Icon }) => {
                    const href = `/owner/${slug}`
                    const active = activePath === href
                    return (
                      <Link
                        key={slug}
                        className={`owner-side-link${active ? " owner-side-link-active" : ""}`}
                        href={href}
                        data-owner-module={slug}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon aria-hidden="true" className="owner-nav-symbol" />
                        <span>{title}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="owner-sidebar-footer">
          <span className="owner-avatar">{(viewerName ?? "Owner").slice(0, 2).toUpperCase()}</span>
          <span className="owner-sidebar-identity">
            <strong>{viewerName ?? "Owner"}</strong>
            <small>{viewerRole ?? "Owner access"}</small>
          </span>
        </div>
      </aside>
      <div className="owner-workspace">
        <header className="owner-topbar">
          <div className="owner-breadcrumb">
            <Link href="/owner">Workspace</Link>
            <b aria-hidden="true">/</b>
            <strong>{activeModule?.title ?? "Overview"}</strong>
          </div>
          <div className="owner-topbar-actions">
            <a
              href="https://www.instagram.com/luciferapiweb/"
              className="owner-instagram-link"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram: @luciferapiweb"
            >
              <Instagram aria-hidden="true" size={15} />
              <span>@luciferapiweb</span>
            </a>
            <Link href="/" className="owner-view-site">
              <Home aria-hidden="true" size={15} />
              View live site
            </Link>
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}
