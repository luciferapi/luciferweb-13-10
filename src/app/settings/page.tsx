import type { Metadata } from "next"
import { SettingsPanel } from "@/features/auth/components/settings-panel"
import { SettingsMotion } from "@/features/auth/components/settings-motion"
import { requireSignedInUser } from "@/features/auth/server/auth-session"

export const metadata: Metadata = {
  title: "Settings | LUCIFER AI",
  description: "Manage your profile and appearance preferences for LUCIFER AI.",
  robots: { index: false, follow: false },
}

export default async function SettingsPage() {
  await requireSignedInUser("/settings")

  return (
    <main className="min-h-dvh bg-background px-4 pb-24 pt-28 text-foreground sm:px-6 sm:pt-32 lg:px-8">
      <SettingsMotion>
        <div className="mx-auto max-w-6xl">
          <div className="grid items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
            <nav
              aria-label="Settings sections"
              className="sticky top-5 z-10 -mx-1 flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-background/95 p-2 backdrop-blur-xl lg:top-8 lg:mx-0 lg:block lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
            >
              <p className="hidden px-3 pb-3 pt-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground lg:block">
                On this page
              </p>
              {[
                ["Profile", "#profile-settings"],
                ["AI Preferences", "#ai-settings"],
                ["Account", "#account-settings"],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-xl px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime active:scale-[0.98] lg:flex lg:min-h-11 lg:w-full lg:border-l-2 lg:border-transparent lg:px-3 lg:hover:border-lime/50 lg:hover:bg-muted/40"
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="min-w-0 space-y-5">
              <SettingsPanel />
            </div>
          </div>
        </div>
      </SettingsMotion>
    </main>
  )
}
