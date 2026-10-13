import Link from "next/link"
import { Home } from "lucide-react"
import { ownerModules } from "@/features/owner/owner-modules"

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

  return (
    <div className="owner-frame">
      <aside className="owner-sidebar" aria-label="Owner dashboard navigation">
        <Link href="/" className="owner-brand">
          <img src="/images/luciferai-brand-logo.jpg" alt="" />
          <span><strong>LUCIFER AI</strong><small>Control center</small></span>
        </Link>
        <p className="owner-nav-label">Workspace</p>
        <nav className="owner-side-links">
          {visibleModules.map(({ slug, title, icon: Icon }) => {
            const href = `/owner/${slug}`
            const active = activePath === href
            return (
              <Link
                key={slug}
                className={`owner-side-link${active ? " owner-side-link-active" : ""}`}
                href={href}
                aria-current={active ? "page" : undefined}
              >
                <Icon aria-hidden="true" className="owner-nav-symbol" />
                {title}
              </Link>
            )
          })}
        </nav>
        <div className="owner-sidebar-footer">
          <span className="owner-avatar">{(viewerName ?? "Owner").slice(0, 2).toUpperCase()}</span>
          <span><strong>{viewerName ?? "Owner"}</strong><small>{viewerRole ?? "Owner access"}</small></span>
        </div>
      </aside>
      <div className="owner-workspace">
        <header className="owner-topbar">
          <div className="owner-breadcrumb">
            <Link href="/owner">Workspace</Link>
            {activeModule ? <><b>/</b><strong>{activeModule.title}</strong></> : <><b>/</b><strong>Overview</strong></>}
          </div>
          <Link href="/" className="owner-view-site">
            <Home aria-hidden="true" size={15} />
            Home
          </Link>
        </header>
        {children}
      </div>
    </div>
  )
}
