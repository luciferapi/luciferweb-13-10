'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { BookOpen, ChartNoAxesColumn, ChevronDown, FolderKanban, LayoutDashboard, LayoutGrid, LogIn, LogOut, Menu, Moon, Monitor, PanelLeftClose, PanelLeftOpen, Pencil, Receipt, Send, ShieldCheck, Sparkles, Sun, Settings2, UserRound, Wallet, X } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Home', href: '/', icon: LayoutGrid },
  { label: 'About', href: '/about', icon: BookOpen },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'API Explorer', href: '/api-explorer', icon: ChartNoAxesColumn },
  { label: 'Pocket Money', href: '/pocket-money', icon: Wallet },
  { label: 'Contact', href: '/contact', icon: Send },
  { label: 'Privacy', href: '/privacy', icon: ShieldCheck },
];

const TRANSACTION_NAV_ITEM = { label: 'Transaction History', href: '/transactions', icon: Receipt };
const OWNER_NAV_ITEM = { label: 'Admin Dashboard', href: '/owner', icon: LayoutDashboard };
const POCKET_MONEY_SUB_ITEMS = [
  { label: '📺 Watch Ads & Tasks', href: '/pocket-money/watch-ads-tasks' },
  { label: '👥 Referrals', href: '/pocket-money/referrals' },
  { label: '✅ Tasks', href: '/pocket-money/tasks' },
];

const THEME_OPTIONS = [
  { label: 'System', value: 'system', icon: Monitor },
  { label: 'Light', value: 'light', icon: Sun },
  { label: 'Dark', value: 'dark', icon: Moon },
];

const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'en' },
  { label: 'Hindi', value: 'hi' },
  { label: 'Tamil', value: 'ta' },
  { label: 'Telugu', value: 'te' },
  { label: 'Kannada', value: 'kn' },
  { label: 'Malayalam', value: 'ml' },
  { label: 'Bengali', value: 'bn' },
  { label: 'Marathi', value: 'mr' },
  { label: 'Gujarati', value: 'gu' },
  { label: 'Punjabi', value: 'pa' },
  { label: 'Urdu', value: 'ur' },
  { label: 'Arabic', value: 'ar' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
  { label: 'Italian', value: 'it' },
  { label: 'Portuguese', value: 'pt' },
  { label: 'Russian', value: 'ru' },
  { label: 'Chinese', value: 'zh' },
  { label: 'Japanese', value: 'ja' },
  { label: 'Korean', value: 'ko' },
  { label: 'Thai', value: 'th' },
  { label: 'Vietnamese', value: 'vi' },
  { label: 'Indonesian', value: 'id' },
  { label: 'Turkish', value: 'tr' },
  { label: 'Dutch', value: 'nl' },
];

type SessionUser = {
  name: string
  email: string
}

export default function MagneticNav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pocketMoneyOpen, setPocketMoneyOpen] = useState(pathname.startsWith('/pocket-money'));
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const navItems = signedIn
    ? [...NAV_ITEMS, TRANSACTION_NAV_ITEM, ...(profile?.email.trim().toLowerCase() === 'kspgpraveen157@gmail.com' ? [OWNER_NAV_ITEM] : [])]
    : NAV_ITEMS;

  useEffect(() => {
    document.documentElement.style.setProperty("--navigation-width", sidebarExpanded ? "17rem" : "5.75rem");
  }, [sidebarExpanded]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/session', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        setSignedIn(response.ok);
        if (!response.ok) {
          setProfile(null);
          setAuthChecked(true);
          return;
        }
        const result: unknown = await response.json();
        if (
          typeof result === 'object' &&
          result !== null &&
          'user' in result &&
          typeof result.user === 'object' &&
          result.user !== null &&
          'name' in result.user &&
          typeof result.user.name === 'string' &&
          'email' in result.user &&
          typeof result.user.email === 'string'
        ) {
          setProfile({ name: result.user.name, email: result.user.email });
        } else {
          throw new Error('The session response did not contain a valid profile.');
        }
        setAuthChecked(true);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Could not check the sign-in state.', error);
        setSignedIn(false);
        setProfile(null);
        setAuthChecked(true);
      });
    return () => controller.abort();
  }, [pathname]);

  async function handleSignOut() {
    if (!window.confirm('Are you sure you want to log out?')) return;

    setSigningOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Could not sign out right now.');
      setSignedIn(false);
      setProfile(null);
      setMenuOpen(false);
      setSettingsOpen(false);
    } catch (error) {
      console.error('Sign out failed.', error);
    } finally {
      setSigningOut(false);
    }
  }

  async function handleNameUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setSavingName(true);
    setNameError('');
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameDraft }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'Could not update your name right now.';
        throw new Error(message);
      }
      if (
        typeof result !== 'object' ||
        result === null ||
        !('user' in result) ||
        typeof result.user !== 'object' ||
        result.user === null ||
        !('name' in result.user) ||
        typeof result.user.name !== 'string'
      ) {
        throw new Error('The updated profile response was invalid.');
      }

      setProfile({ ...profile, name: result.user.name });
      setEditingName(false);
    } catch (error) {
      console.error('Could not update the account name.', error);
      setNameError(error instanceof Error ? error.message : 'Could not update your name right now.');
    } finally {
      setSavingName(false);
    }
  }

  useEffect(() => {
    setMenuOpen(false);
    setSettingsOpen(false);
    if (pathname.startsWith('/pocket-money')) setPocketMoneyOpen(true);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <>
    <aside aria-label="Primary navigation" className={`pointer-events-none fixed inset-y-0 left-0 z-50 hidden p-3 transition-[width] duration-300 ease-in-out xl:block ${sidebarExpanded ? "w-[17rem]" : "w-[5.75rem]"}`}>
      <div className="pointer-events-auto flex h-full overflow-hidden rounded-2xl border border-border/70 bg-background/95 shadow-[0_16px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
        <div className={`flex shrink-0 flex-col items-center bg-[#08080b] py-4 text-white transition-[width] duration-300 ${sidebarExpanded ? "w-[4.25rem]" : "w-full"}`}>
          <Link href="/" aria-label="Lucifer AI home" className="mb-6 grid size-10 place-items-center overflow-hidden rounded-xl border border-white/15 bg-white/5">
            <img src="/images/luciferai-brand-logo.jpg" alt="" className="size-full object-cover" />
          </Link>
          <button
            type="button"
            aria-label={sidebarExpanded ? "Collapse navigation" : "Expand navigation"}
            aria-expanded={sidebarExpanded}
            onClick={() => setSidebarExpanded((expanded) => !expanded)}
            className="mb-3 grid size-10 place-items-center rounded-xl text-white/65 transition hover:bg-white/10 hover:text-white"
          >
            {sidebarExpanded ? <PanelLeftClose aria-hidden="true" size={18} /> : <PanelLeftOpen aria-hidden="true" size={18} />}
          </button>
          <nav aria-label="Quick navigation" className="flex flex-1 flex-col items-center gap-2">
            {navItems.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
              if (href === "/pocket-money") {
                return (
                  <button
                    key={href}
                    type="button"
                    aria-label="Open Pocket Money navigation"
                    aria-expanded={pocketMoneyOpen}
                    title="Pocket Money"
                    onClick={() => {
                      setSidebarExpanded(true);
                      setPocketMoneyOpen(true);
                    }}
                    className={`grid size-10 place-items-center rounded-xl transition ${active ? "bg-white/15 text-cyan-200 ring-1 ring-white/10" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
                  >
                    <Icon aria-hidden="true" size={18} />
                  </button>
                );
              }
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={`grid size-10 place-items-center rounded-xl transition ${active ? "bg-white/15 text-cyan-200 ring-1 ring-white/10" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
                >
                  <Icon aria-hidden="true" size={18} />
                </Link>
              );
            })}
          </nav>
          {!sidebarExpanded && signedIn && profile ? (
            <div aria-label={`Signed in as ${profile.name}`} title={`${profile.name} · ${profile.email}`} className="mb-2 grid size-10 place-items-center rounded-xl border border-cyan-200/20 bg-cyan-300/10 text-xs font-bold text-cyan-100">
              {profile.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}
            </div>
          ) : null}
          {!sidebarExpanded && authChecked ? (
            signedIn ? (
              <button
                type="button"
                aria-label={signingOut ? "Logging out" : "Log out"}
                title={signingOut ? "Logging out" : "Log out"}
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="mb-2 grid size-10 place-items-center rounded-xl text-white/65 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <LogOut aria-hidden="true" size={18} />
              </button>
            ) : (
              <Link href="/sign-in" aria-label="Sign in" title="Sign in" className="mb-2 grid size-10 place-items-center rounded-xl text-white/65 transition hover:bg-white/10 hover:text-white">
                <LogIn aria-hidden="true" size={18} />
              </Link>
            )
          ) : null}
          <button
            type="button"
            aria-label="Appearance settings"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
            className="grid size-10 place-items-center rounded-xl text-white/65 transition hover:bg-white/10 hover:text-white"
          >
            <Settings2 aria-hidden="true" size={18} />
          </button>
        </div>

        {sidebarExpanded ? <div className="flex min-w-0 flex-1 flex-col px-3 py-5">
          <div className="mb-6 flex items-center justify-between gap-2 px-2">
            <div className="min-w-0">
              <p className="truncate text-base font-black tracking-tight text-foreground">LUCIFER <span className="text-cyan-600 dark:text-cyan-300">AI</span></p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Explore</p>
            </div>
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
          </div>

          <nav aria-label="Main navigation" className="flex flex-col gap-1">
            {navItems.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
              if (href === "/pocket-money") {
                return (
                  <div key={href}>
                    <button
                      type="button"
                      aria-expanded={pocketMoneyOpen}
                      onClick={() => setPocketMoneyOpen((open) => !open)}
                      className={`flex min-h-10 w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition ${active ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Icon aria-hidden="true" size={16} className={active ? "text-cyan-700 dark:text-cyan-200" : ""} />
                        <span>{label}</span>
                      </span>
                      <ChevronDown aria-hidden="true" size={15} className={`transition-transform ${pocketMoneyOpen ? "rotate-180" : ""}`} />
                    </button>
                    {pocketMoneyOpen ? (
                      <div className="ml-8 mt-1 flex flex-col gap-1 border-l border-border pl-2">
                        {POCKET_MONEY_SUB_ITEMS.map((item) => (
                          <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={`rounded-lg px-2 py-2 text-xs transition hover:bg-muted/70 hover:text-foreground ${pathname === item.href ? "bg-muted font-semibold text-foreground" : "text-muted-foreground"}`}>
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              }
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${active ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}
                >
                  <Icon aria-hidden="true" size={16} className={active ? "text-cyan-700 dark:text-cyan-200" : ""} />
                  <span>{label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              aria-label="Open settings"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
              className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
            >
              <Settings2 aria-hidden="true" size={16} className="text-cyan-700 dark:text-cyan-200" />
              <span>Settings</span>
            </button>
          </nav>

          <div className="mt-auto space-y-2 border-t border-border pt-3">
            {signedIn && profile ? (
              <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border/70 bg-muted/40 p-2.5">
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-cyan-300/15 text-xs font-bold text-cyan-800 dark:text-cyan-200">
                  {profile.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-foreground">{profile.name}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{profile.email}</span>
                </span>
              </div>
            ) : null}
            <Link href="/chat" className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-300 px-3 text-sm font-bold text-slate-950 shadow-[0_6px_24px_rgba(34,211,238,0.14)] transition hover:brightness-105">
              <Sparkles aria-hidden="true" size={16} /> Start chatting
            </Link>
            {authChecked && signedIn ? (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <LogOut aria-hidden="true" size={16} />{signingOut ? "Logging out..." : "Log out"}
              </button>
            ) : authChecked ? (
              <Link href="/sign-in" className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
                <LogIn aria-hidden="true" size={16} />Sign in
              </Link>
            ) : null}
          </div>
        </div> : null}
      </div>

      {settingsOpen ? (
        <div className="pointer-events-auto absolute bottom-16 left-[4.75rem] z-20 w-48 rounded-2xl border border-border/80 bg-card/95 p-2 shadow-2xl backdrop-blur-2xl">
          {signedIn && profile ? (
            <>
              <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Account</p>
              <button
                type="button"
                onClick={() => { setNameDraft(profile.name); setNameError(''); setEditingName(true); setSettingsOpen(false); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-foreground/70 transition hover:bg-muted hover:text-foreground"
              >
                <Pencil aria-hidden="true" size={15} />Change name
              </button>
              <div className="my-1.5 border-t border-border" />
            </>
          ) : null}
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Appearance</p>
          {THEME_OPTIONS.map(({ label, value, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setTheme(value); setSettingsOpen(false); }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition ${mounted && (theme === value || (value === "system" && !theme)) ? "bg-cyan-300/10 text-cyan-700 dark:text-cyan-200" : "text-foreground/70 hover:bg-muted hover:text-foreground"}`}
            >
              <Icon aria-hidden="true" size={15} />{label}
            </button>
          ))}
        </div>
      ) : null}
    </aside>

    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-5 xl:hidden">
      <div className="pointer-events-auto mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-3 rounded-2xl border border-white/10 bg-background/75 px-3 shadow-[0_14px_50px_rgba(0,0,0,0.22)] backdrop-blur-2xl transition-colors sm:min-h-16 sm:px-5">
        <Link href="/" aria-label="Lucifer AI home" className="group flex shrink-0 items-center gap-2.5">
          <span className="relative size-9 overflow-hidden rounded-xl border border-cyan-200/30 bg-white/5 shadow-[0_0_22px_rgba(103,232,249,0.12)] sm:size-10">
            <img src="/images/luciferai-brand-logo.jpg" alt="" className="size-full object-cover transition duration-300 group-hover:scale-110" />
          </span>
          <span className="text-sm font-black tracking-[0.04em] text-foreground sm:text-base">LUCIFER <span className="text-cyan-300">AI</span></span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 rounded-2xl border border-border/70 bg-muted/40 p-1 xl:flex">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${active ? 'bg-cyan-300/10 text-cyan-700 shadow-sm dark:text-cyan-200' : 'text-foreground/65 hover:bg-background/70 hover:text-foreground'}`}
              >
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            aria-label="Open settings"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
            className={`relative rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${settingsOpen ? 'bg-cyan-300/10 text-cyan-700 shadow-sm dark:text-cyan-200' : 'text-foreground/65 hover:bg-background/70 hover:text-foreground'}`}
          >
            Settings
          </button>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {authChecked && !signedIn && (
            <Link
              href="/sign-in"
              aria-current={pathname === '/sign-in' ? 'page' : undefined}
              className={`hidden items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:inline-flex ${pathname === '/sign-in' ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-600 dark:text-cyan-200' : 'border-border text-foreground/75 hover:border-cyan-300/40 hover:text-cyan-600 dark:hover:text-cyan-200'}`}
            >
              <LogIn aria-hidden="true" size={16} /> Sign in
            </Link>
          )}
          <Link href="/chat" className="hidden items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-300 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-[0_6px_24px_rgba(34,211,238,0.18)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(34,211,238,0.28)] sm:inline-flex">
            <Sparkles aria-hidden="true" size={15} /> Start chatting <span aria-hidden="true">↗</span>
          </Link>
          <button
            type="button"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
            className="grid size-10 place-items-center rounded-xl border border-border text-foreground/80 transition hover:border-cyan-300/40 hover:bg-muted hover:text-cyan-600 dark:hover:text-cyan-200 xl:hidden"
          >
            {menuOpen ? <X aria-hidden="true" size={19} /> : <Menu aria-hidden="true" size={19} />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
          className="pointer-events-auto fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px] xl:hidden"
        />
      ) : null}
      <div
        id="mobile-navigation"
        role={menuOpen ? 'dialog' : undefined}
        aria-label={menuOpen ? 'Mobile navigation' : undefined}
        aria-modal={menuOpen || undefined}
        aria-hidden={!menuOpen}
        className={`pointer-events-auto invisible fixed inset-y-0 left-0 z-[70] flex w-[min(20rem,calc(100vw-3rem))] flex-col overflow-y-auto overscroll-contain border-r border-border/80 bg-card/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-2xl transition-transform duration-300 ease-out xl:hidden sm:p-5 ${menuOpen ? 'visible translate-x-0' : '-translate-x-full'}`}
      >
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 size-48 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative mb-5 flex items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-sm font-black tracking-wide text-foreground">LUCIFER <span className="text-cyan-600 dark:text-cyan-300">AI</span></p>
              <p className="mt-1 text-xs text-muted-foreground">Explore</p>
            </div>
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMenuOpen(false)}
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          {signedIn && profile ? (
            <div className="relative mb-4 flex min-w-0 items-center gap-3 rounded-xl border border-border/70 bg-background/50 p-3">
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-cyan-300/15 text-sm font-bold text-cyan-800 dark:text-cyan-200">
                {profile.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">{profile.name}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{profile.email}</span>
              </span>
              <UserRound aria-hidden="true" size={16} className="ml-auto shrink-0 text-muted-foreground" />
            </div>
          ) : null}
          <nav aria-label="Mobile page links" className="relative flex flex-col gap-1">
          {navItems.map(({ icon: Icon, ...item }) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
            if (item.href === "/pocket-money") {
              return (
                <div key={item.href}>
                  <button
                    type="button"
                    aria-expanded={pocketMoneyOpen}
                    onClick={() => setPocketMoneyOpen((open) => !open)}
                    className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ${active ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`}
                  >
                    <span className="group flex min-w-0 items-center gap-2.5">
                      <Icon aria-hidden="true" size={17} className={active ? 'shrink-0 text-cyan-700 dark:text-cyan-200' : 'shrink-0 text-muted-foreground transition-colors group-hover:text-cyan-700 dark:group-hover:text-cyan-200'} />
                      <span>{item.label}</span>
                    </span>
                    <ChevronDown aria-hidden="true" size={15} className={`transition-transform ${pocketMoneyOpen ? "rotate-180" : ""}`} />
                  </button>
                  {pocketMoneyOpen ? (
                    <div className="ml-8 mt-1 flex flex-col gap-1 border-l border-border pl-2">
                      {POCKET_MONEY_SUB_ITEMS.map((subItem) => (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          onClick={() => setMenuOpen(false)}
                          aria-current={pathname === subItem.href ? "page" : undefined}
                          className={`rounded-lg px-2 py-2 text-xs transition hover:bg-muted/70 hover:text-foreground ${pathname === subItem.href ? "bg-muted font-semibold text-foreground" : "text-muted-foreground"}`}
                        >
                          {subItem.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
                className={`group flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${active ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon aria-hidden="true" size={17} className={active ? 'shrink-0 text-cyan-700 dark:text-cyan-200' : 'shrink-0 text-muted-foreground transition-colors group-hover:text-cyan-700 dark:group-hover:text-cyan-200'} />
                  <span>{item.label}</span>
                </span>
                <span aria-hidden="true" className={`text-xs ${active ? 'text-cyan-700 dark:text-cyan-200' : 'text-muted-foreground'}`}>↗</span>
              </Link>
            );
          })}
          <button
            type="button"
            aria-label="Open settings"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
            className={`group flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ${settingsOpen ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Settings2 aria-hidden="true" size={17} className={settingsOpen ? 'shrink-0 text-cyan-700 dark:text-cyan-200' : 'shrink-0 text-muted-foreground transition-colors group-hover:text-cyan-700 dark:group-hover:text-cyan-200'} />
              <span>Settings</span>
            </span>
            <span aria-hidden="true" className={`text-xs ${settingsOpen ? 'text-cyan-700 dark:text-cyan-200' : 'text-muted-foreground'}`}>⚙</span>
          </button>
          </nav>
          {settingsOpen ? (
            <section aria-label="Settings options" className="relative mt-2 rounded-xl border border-border/70 bg-background/60 p-2">
              {signedIn && profile ? (
                <>
                  <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Account</p>
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(profile.name);
                      setNameError('');
                      setEditingName(true);
                      setSettingsOpen(false);
                      setMenuOpen(false);
                    }}
                    className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2 text-left text-sm text-foreground/70 transition hover:bg-muted hover:text-foreground"
                  >
                    <Pencil aria-hidden="true" size={15} />Change name
                  </button>
                  <div className="my-1.5 border-t border-border" />
                </>
              ) : null}
              <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Appearance</p>
              {THEME_OPTIONS.map(({ label, value, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setTheme(value);
                    setSettingsOpen(false);
                    setMenuOpen(false);
                  }}
                  className={`flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2 text-left text-sm transition ${mounted && (theme === value || (value === "system" && !theme)) ? "bg-cyan-300/10 text-cyan-700 dark:text-cyan-200" : "text-foreground/70 hover:bg-muted hover:text-foreground"}`}
                >
                  <Icon aria-hidden="true" size={15} />{label}
                </button>
              ))}
            </section>
          ) : null}
          {authChecked && !signedIn && (
            <Link
              href="/sign-in"
              aria-current={pathname === '/sign-in' ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
              className={`relative mt-2 flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${pathname === '/sign-in' ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-700 dark:text-cyan-200' : 'border-border/70 text-foreground/75 hover:border-cyan-300/25 hover:bg-muted hover:text-foreground'}`}
            >
              Sign in <LogIn aria-hidden="true" size={16} className="text-muted-foreground" />
            </Link>
          )}
          {authChecked && signedIn ? (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="relative mt-2 flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <LogOut aria-hidden="true" size={17} />
              {signingOut ? 'Logging out...' : 'Log out'}
            </button>
          ) : null}
          <Link href="/chat" onClick={() => setMenuOpen(false)} className="relative mt-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-300 px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_6px_24px_rgba(34,211,238,0.16)]"><Sparkles aria-hidden="true" size={16} />Start chatting <span aria-hidden="true">↗</span></Link>
      </div>
    </header>
    {editingName ? (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-name-title"
          className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6"
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 id="change-name-title" className="text-lg font-bold text-foreground">Change your name</h2>
              <p className="mt-1 text-sm text-muted-foreground">This is the name shown on your profile and in chat.</p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setEditingName(false)}
              disabled={savingName}
              className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          <form onSubmit={(event) => void handleNameUpdate(event)} className="space-y-4">
            <label htmlFor="profile-name" className="block text-sm font-medium text-foreground">Display name</label>
            <input
              id="profile-name"
              name="name"
              type="text"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              maxLength={100}
              required
              autoFocus
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            />
            {nameError ? <p role="alert" className="text-sm text-red-500">{nameError}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingName(false)}
                disabled={savingName}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingName || !nameDraft.trim()}
                className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingName ? 'Saving...' : 'Save name'}
              </button>
            </div>
          </form>
        </section>
      </div>
    ) : null}
    </>
  );
}
