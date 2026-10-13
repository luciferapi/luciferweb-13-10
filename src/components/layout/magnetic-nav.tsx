'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import gsap from 'gsap';
import { BookOpen, ChartNoAxesColumn, ChevronDown, FolderKanban, LayoutDashboard, LayoutGrid, LogIn, LogOut, Menu, Moon, MoonStar, Monitor, PanelLeftClose, PanelLeftOpen, Pencil, Send, ShieldCheck, Sparkles, Sun, Settings2, UserRound, Wallet, X, LifeBuoy } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const NAV_ITEMS = [
  { label: 'Home', href: '/', icon: LayoutGrid },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'API Explorer', href: '/api-explorer', icon: ChartNoAxesColumn },
  { label: 'Pocket Money', href: '/pocket-money', icon: Wallet },
  { label: 'Build Your Startup', href: '/contact', icon: Send },
  { label: 'Support', href: '/support', icon: LifeBuoy },
  { label: 'About', href: '/about', icon: BookOpen },
  { label: 'Privacy', href: '/privacy', icon: ShieldCheck },
  { label: 'Settings', href: '/settings', icon: Settings2 },
];

const WALLET_NAV_ITEM = { label: 'Wallet', href: '/wallet', icon: Wallet };
const OWNER_NAV_ITEM = { label: 'Admin Dashboard', href: '/owner', icon: LayoutDashboard };
const POCKET_MONEY_SUB_ITEMS = [
  { label: 'Overview', href: '/pocket-money' },
  { label: '📺 Watch Ads & Tasks', href: '/pocket-money/watch-ads-tasks' },
  { label: '👥 Referrals', href: '/pocket-money/referrals' },
  { label: '✅ Tasks', href: '/pocket-money/tasks' },
];

const THEME_OPTIONS = [
  { label: 'System', value: 'system', icon: Monitor },
  { label: 'Light', value: 'light', icon: Sun },
  { label: 'Dark', value: 'dark', icon: Moon },
  { label: 'Dark blue', value: 'dark-blue', icon: MoonStar },
];

type SessionUser = {
  publicUid: string
  name: string
  email: string
}

export default function MagneticNav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pocketMoneyOpen, setPocketMoneyOpen] = useState(pathname.startsWith('/pocket-money'));
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<SessionUser | null>(null);
  const [walletBalancePaise, setWalletBalancePaise] = useState<number | null>(null);
  const [walletBalanceError, setWalletBalanceError] = useState(false);
  const [walletBalanceLoading, setWalletBalanceLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const mobileHeaderRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const mobileBackdropRef = useRef<HTMLButtonElement>(null);
  const navItems = signedIn
    ? [...NAV_ITEMS, WALLET_NAV_ITEM, ...(profile?.email.trim().toLowerCase() === 'kspgpraveen157@gmail.com' ? [OWNER_NAV_ITEM] : [])]
    : NAV_ITEMS;
  const profileBalanceLabel = walletBalanceLoading && walletBalancePaise === null
    ? '...'
    : walletBalanceError && walletBalancePaise === null
      ? 'Unavailable'
      : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
      }).format((walletBalancePaise ?? 0) / 100);

  useEffect(() => {
    document.documentElement.style.setProperty("--navigation-width", sidebarExpanded ? "17rem" : "5.75rem");
  }, [sidebarExpanded]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const header = mobileHeaderRef.current;
    if (!header) return;

    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const context = gsap.context(() => {
        gsap.fromTo(
          header,
          { y: -14, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.48, ease: 'power3.out', clearProps: 'transform,opacity,visibility' },
        );
      }, header);
      return () => context.revert();
    });

    return () => media.revert();
  }, []);

  useEffect(() => {
    const drawer = mobileDrawerRef.current;
    const backdrop = mobileBackdropRef.current;
    if (!drawer || !backdrop) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(drawer, {
        xPercent: menuOpen ? 0 : 100,
        autoAlpha: menuOpen ? 1 : 0,
        pointerEvents: menuOpen ? 'auto' : 'none',
      });
      gsap.set(backdrop, {
        autoAlpha: menuOpen ? 1 : 0,
        pointerEvents: menuOpen ? 'auto' : 'none',
      });
      return;
    }

    gsap.killTweensOf([drawer, backdrop]);
    const timeline = gsap.timeline();
    timeline.to(backdrop, {
      autoAlpha: menuOpen ? 1 : 0,
      pointerEvents: menuOpen ? 'auto' : 'none',
      duration: menuOpen ? 0.24 : 0.18,
      ease: 'power2.out',
    }, 0);
    timeline.to(drawer, {
      xPercent: menuOpen ? 0 : 100,
      autoAlpha: menuOpen ? 1 : 0,
      pointerEvents: menuOpen ? 'auto' : 'none',
      duration: menuOpen ? 0.2 : 0.14,
      ease: menuOpen ? 'power3.out' : 'power2.in',
    }, 0);

    if (menuOpen) {
      const items = drawer.querySelectorAll<HTMLElement>('[data-mobile-nav-item]');
      timeline.fromTo(
        items,
        { autoAlpha: 0, x: -8 },
        { autoAlpha: 1, x: 0, duration: 0.22, stagger: 0.035, ease: 'power2.out' },
        0.12,
      );
    }

    return () => {
      timeline.kill();
    };
  }, [menuOpen]);

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
          'publicUid' in result.user &&
          typeof result.user.publicUid === 'string' &&
          'name' in result.user &&
          typeof result.user.name === 'string' &&
          'email' in result.user &&
          (typeof result.user.email === 'string' || result.user.email === null)
        ) {
          setProfile({
            publicUid: result.user.publicUid,
            name: result.user.name,
            email: result.user.email ?? '',
          });
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
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setWalletBalancePaise(null);
      setWalletBalanceError(false);
      setWalletBalanceLoading(false);
      return;
    }

    const controller = new AbortController();
    async function loadWalletBalance() {
      setWalletBalanceLoading(true);
      setWalletBalanceError(false);
      try {
        const response = await fetch('/api/wallet/balance', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const result: unknown = await response.json();
        if (!response.ok) throw new Error('Could not load your wallet balance.');
        if (
          typeof result !== 'object' ||
          result === null ||
          !('balancePaise' in result) ||
          typeof result.balancePaise !== 'number' ||
          !Number.isSafeInteger(result.balancePaise) ||
          result.balancePaise < 0
        ) {
          throw new Error('The wallet balance response was invalid.');
        }
        setWalletBalancePaise(result.balancePaise);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Could not load the profile wallet balance.', error);
        setWalletBalanceError(true);
      } finally {
        if (!controller.signal.aborted) setWalletBalanceLoading(false);
      }
    }

    const refreshBalance = () => void loadWalletBalance();
    void loadWalletBalance();
    window.addEventListener('wallet-deposit-updated', refreshBalance);
    window.addEventListener('wallet-withdrawal-updated', refreshBalance);
    return () => {
      controller.abort();
      window.removeEventListener('wallet-deposit-updated', refreshBalance);
      window.removeEventListener('wallet-withdrawal-updated', refreshBalance);
    };
  }, [signedIn]);

  useEffect(() => {
    function updateProfile(event: Event) {
      if (!(event instanceof CustomEvent)) return
      const detail: unknown = event.detail
      if (
        typeof detail !== "object" ||
        detail === null ||
        !("name" in detail) ||
        typeof detail.name !== "string"
      ) {
        return
      }
      const name = detail.name
      setProfile((current) => current ? { ...current, name } : current)
    }

    window.addEventListener("lucifer:profile-updated", updateProfile)
    return () => window.removeEventListener("lucifer:profile-updated", updateProfile)
  }, [])

  async function handleSignOut() {
    if (!window.confirm('Are you sure you want to log out?')) return;

    setSigningOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Could not sign out right now.');
      setSignedIn(false);
      setProfile(null);
      setWalletBalancePaise(null);
      setMenuOpen(false);
      setProfileOpen(false);
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
    setProfileOpen(false);
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

  if (pathname.startsWith('/owner')) return null;

  return (
    <>
    <aside aria-label="Primary navigation" className={`pointer-events-none fixed inset-y-0 right-0 z-50 hidden p-3 transition-[width] duration-300 ease-in-out xl:block ${sidebarExpanded ? "w-[17rem]" : "w-[5.75rem]"}`}>
      <div className="pointer-events-auto flex h-full overflow-hidden rounded-2xl border border-border/70 bg-background/95 shadow-[0_16px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
        <div className={`flex shrink-0 flex-col items-center bg-background py-4 text-foreground transition-[width] duration-300 ${sidebarExpanded ? "w-[4.25rem]" : "w-full"}`}>
          <Link prefetch href="/" aria-label="Lucifer AI home" className="mb-6 grid size-10 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
            <img src="/images/luciferai-brand-logo.jpg" alt="" className="size-full object-cover" />
          </Link>
          <button
            type="button"
            aria-label={sidebarExpanded ? "Collapse navigation" : "Expand navigation"}
            aria-expanded={sidebarExpanded}
            onClick={() => setSidebarExpanded((expanded) => !expanded)}
            className="mb-3 grid size-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
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
                    className={`grid size-10 place-items-center rounded-xl transition ${active ? "bg-muted text-lime ring-1 ring-border" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
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
                  className={`grid size-10 place-items-center rounded-xl transition ${active ? "bg-muted text-lime ring-1 ring-border" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                >
                  <Icon aria-hidden="true" size={18} />
                </Link>
              );
            })}
            </nav>
            {!sidebarExpanded && signedIn && profile ? (
            <div aria-label={`Signed in as ${profile.name}`} title={`${profile.name} · ${profile.email}`} className="mb-2 grid size-10 place-items-center rounded-xl border border-lime/20 bg-lime/10 text-xs font-bold text-lime">
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
                className="mb-2 grid size-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <LogOut aria-hidden="true" size={18} />
              </button>
            ) : (
              <Link prefetch href="/login" aria-label="Login" title="Login" className="mb-2 grid size-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground">
                <LogIn aria-hidden="true" size={18} />
              </Link>
            )
          ) : null}
          <button
            type="button"
            aria-label="Appearance settings"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
            className="grid size-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Settings2 aria-hidden="true" size={18} />
          </button>
        </div>

        {sidebarExpanded ? <div className="flex min-w-0 flex-1 flex-col px-3 py-5">
          <div className="mb-6 flex items-center justify-between gap-2 px-2">
            <div className="min-w-0">
              <p className="truncate font-heading text-base font-bold tracking-tight text-foreground">LUCIFER <span className="text-lime">AI</span></p>
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
                    <div className={`flex min-h-10 w-full items-center rounded-xl text-sm font-medium transition ${active ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}>
                      <Link
                        href={href}
                        aria-current={pathname === href ? "page" : undefined}
                        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2"
                      >
                        <Icon aria-hidden="true" size={16} className={active ? "text-lime" : ""} />
                        <span>{label}</span>
                      </Link>
                      <button
                        type="button"
                        aria-label={`${pocketMoneyOpen ? "Collapse" : "Expand"} Pocket Money submenu`}
                        aria-expanded={pocketMoneyOpen}
                        onClick={() => setPocketMoneyOpen((open) => !open)}
                        className="grid min-h-10 min-w-10 place-items-center rounded-r-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
                      >
                        <ChevronDown aria-hidden="true" size={15} className={`transition-transform ${pocketMoneyOpen ? "rotate-180" : ""}`} />
                      </button>
                    </div>
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
                  <Icon aria-hidden="true" size={16} className={active ? "text-lime" : ""} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-2 border-t border-border pt-3">
            {signedIn && profile ? (
              <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border/70 bg-muted/40 p-2.5">
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-lime/15 text-xs font-bold text-lime">
                  {profile.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-foreground">{profile.name}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{profile.email}</span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">UID {profile.publicUid}</span>
                </span>
              </div>
            ) : null}
            {pathname !== "/chat" ? (
              <Link prefetch href="/chat" className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-lime px-3 text-sm font-bold text-charcoal shadow-[0_6px_24px_rgba(175,255,0,0.14)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                <Sparkles aria-hidden="true" size={16} /> Start chatting
              </Link>
            ) : null}
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
              <Link prefetch href="/login" className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
                <LogIn aria-hidden="true" size={16} />Login
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
              <p className="px-2.5 pb-2 text-xs text-muted-foreground">
                Public UID
                <span className="mt-0.5 block select-all font-mono font-semibold tracking-wide text-foreground">
                  {profile.publicUid}
                </span>
              </p>
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
              className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition ${mounted && (theme === value || (value === "system" && !theme)) ? "bg-lime/10 text-lime" : "text-foreground/70 hover:bg-muted hover:text-foreground"}`}
            >
              <Icon aria-hidden="true" size={15} />{label}
            </button>
          ))}
        </div>
      ) : null}
    </aside>

    <header ref={mobileHeaderRef} className="pointer-events-none fixed inset-x-0 top-0 z-[80] px-3 pt-3 sm:px-6 sm:pt-5 xl:hidden">
      <div className="pointer-events-auto mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-3 rounded-2xl bg-background/95 px-3 shadow-[0_14px_45px_rgba(0,0,0,0.14)] backdrop-blur-2xl sm:min-h-16 sm:px-4">
        <Link prefetch href="/" aria-label="Lucifer AI home" className="group flex min-w-0 flex-1 items-center gap-2.5">
          <span className="relative size-9 overflow-hidden rounded-xl border border-lime/25 bg-muted shadow-[0_8px_20px_rgba(131,255,81,0.12)] sm:size-10">
            <img src="/images/luciferai-brand-logo.jpg" alt="" className="size-full object-cover transition duration-300 group-hover:scale-110" />
          </span>
          <span className="truncate font-heading text-sm font-bold tracking-[0.04em] text-foreground sm:text-base">LUCIFER <span className="text-lime">AI</span></span>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="flex shrink-0 items-center gap-2">
            {authChecked && !signedIn && !menuOpen ? (
              <Link
                href="/login"
                aria-current={pathname === '/login' ? 'page' : undefined}
                className={`hidden min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition sm:inline-flex ${pathname === '/login' ? 'border-lime/40 bg-lime/10 text-lime' : 'border-border bg-muted/30 text-foreground/75 hover:border-lime/40 hover:bg-lime/10 hover:text-lime dark:hover:text-lime'}`}
              >
                <LogIn aria-hidden="true" size={16} /> Login
              </Link>
            ) : null}
            {pathname !== '/chat' && !menuOpen ? (
              <Link prefetch href="/chat" className="hidden min-h-10 items-center gap-2 rounded-xl bg-lime px-3.5 text-sm font-bold text-charcoal shadow-[0_6px_24px_rgba(175,255,0,0.18)] transition hover:-translate-y-0.5 hover:bg-lime active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline-flex">
                <Sparkles aria-hidden="true" size={15} /> Start chatting
              </Link>
            ) : null}
            {authChecked && signedIn && profile ? (
              <DropdownMenu
                open={profileOpen}
                onOpenChange={(open) => {
                  setProfileOpen(open);
                  if (open) setMenuOpen(false);
                }}
              >
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label={`Open profile menu for ${profile.name}`}
                      title={profile.name}
                      className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-1.5 text-sm font-semibold text-foreground transition hover:border-lime/40 hover:bg-lime/10 hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
                    >
                    <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-lime text-xs font-bold text-charcoal">
                      {profile.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}
                    </span>
                    <span className="hidden max-w-28 truncate font-mono text-xs tabular-nums sm:inline">
                      {profileBalanceLabel}
                    </span>
                    </button>
                  }
                />
                <DropdownMenuContent align="end" sideOffset={10} className="w-72 rounded-xl border-border bg-card p-2">
                  <DropdownMenuLabel className="flex min-w-0 items-center gap-3 px-2 py-2">
                    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-lime/15 text-sm font-bold text-lime">
                      {profile.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{profile.name}</span>
                      <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{profile.email}</span>
                    </span>
                    <UserRound aria-hidden="true" size={16} className="shrink-0 text-muted-foreground" />
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <p className="px-2 py-2 text-xs text-muted-foreground">
                    Public UID
                    <span className="mt-1 block select-all font-mono text-sm font-semibold tracking-wide text-foreground">
                      {profile.publicUid}
                    </span>
                  </p>
                  <DropdownMenuSeparator />
                  <div className="mx-1 my-1 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground">Wallet balance</p>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <p aria-live="polite" className="font-mono text-base font-bold tabular-nums text-foreground">
                        {walletBalanceLoading && walletBalancePaise === null
                          ? 'Loading...'
                          : walletBalanceError && walletBalancePaise === null
                            ? 'Unavailable'
                            : new Intl.NumberFormat('en-IN', {
                              style: 'currency',
                              currency: 'INR',
                              minimumFractionDigits: 2,
                            }).format((walletBalancePaise ?? 0) / 100)}
                      </p>
                      <DropdownMenuItem
                        render={<Link prefetch href="/wallet">View wallet</Link>}
                        className="min-h-8 cursor-pointer rounded-md px-2 text-xs"
                      />
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      setNameDraft(profile.name);
                      setNameError('');
                      setEditingName(true);
                    }}
                    className="min-h-10 cursor-pointer rounded-lg"
                  >
                    <Pencil aria-hidden="true" />Change name
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={<Link prefetch href="/settings">Account settings</Link>}
                    className="min-h-10 cursor-pointer rounded-lg"
                  />
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground">
                    Theme
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={mounted ? theme ?? 'system' : 'system'}
                    onValueChange={setTheme}
                  >
                    {THEME_OPTIONS.map(({ label, value, icon: Icon }) => (
                      <DropdownMenuRadioItem
                        key={value}
                        value={value}
                        onSelect={(event) => event.preventDefault()}
                        className="min-h-9 cursor-pointer rounded-lg"
                      >
                        <Icon aria-hidden="true" />
                        {label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => void handleSignOut()}
                    disabled={signingOut}
                    className="min-h-10 cursor-pointer rounded-lg text-destructive focus:text-destructive"
                  >
                    <LogOut aria-hidden="true" />{signingOut ? 'Logging out...' : 'Log out'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <button
              ref={menuButtonRef}
              type="button"
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen((open) => !open)}
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime/10 text-lime transition hover:bg-lime/15 hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] xl:hidden"
            >
              {menuOpen ? <X aria-hidden="true" size={19} /> : <Menu aria-hidden="true" size={19} />}
            </button>
          </div>
        </div>
      </div>
    </header>

      <button
        ref={mobileBackdropRef}
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => setMenuOpen(false)}
        className="pointer-events-none fixed inset-0 z-[60] bg-black/45 opacity-0 backdrop-blur-[2px] xl:hidden"
        style={{ opacity: 0, visibility: 'hidden', pointerEvents: 'none' }}
      />

      <div
        ref={mobileDrawerRef}
        id="mobile-navigation"
        role={menuOpen ? 'dialog' : undefined}
        aria-label={menuOpen ? 'Mobile navigation' : undefined}
        aria-modal={menuOpen || undefined}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
        className="pointer-events-none fixed inset-y-0 right-0 z-[70] flex w-[min(17rem,calc(100vw-1.5rem))] flex-col overflow-y-auto overscroll-contain border-l border-lime/15 bg-background/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-2xl xl:hidden sm:p-5"
        style={{ opacity: 0, visibility: 'hidden', pointerEvents: 'none' }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-20 size-48 rounded-full bg-lime/10 blur-3xl" />
        <div className="relative mb-5 flex items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="font-heading text-sm font-bold tracking-wide text-foreground">LUCIFER <span className="text-lime">AI</span></p>
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

        <nav aria-label="Mobile page links" className="relative flex flex-col gap-1">
          {navItems.map(({ icon: Icon, ...item }) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
            if (item.href === "/pocket-money") {
              return (
                <div key={item.href} data-mobile-nav-item>
                  <div className={`flex min-h-11 w-full items-center gap-2 rounded-xl text-sm font-medium transition-all duration-200 ${active ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`}>
                    <Link
                      href={item.href}
                      aria-current={pathname === item.href ? 'page' : undefined}
                      onClick={() => setMenuOpen(false)}
                      className="group flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5"
                    >
                      <Icon aria-hidden="true" size={17} className={active ? 'shrink-0 text-lime' : 'shrink-0 text-muted-foreground transition-colors group-hover:text-lime dark:group-hover:text-lime'} />
                      <span>{item.label}</span>
                    </Link>
                    <button
                      type="button"
                      aria-label={`${pocketMoneyOpen ? 'Collapse' : 'Expand'} Pocket Money submenu`}
                      aria-expanded={pocketMoneyOpen}
                      onClick={() => setPocketMoneyOpen((open) => !open)}
                      className="grid min-h-11 min-w-11 place-items-center rounded-r-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
                    >
                      <ChevronDown aria-hidden="true" size={15} className={`transition-transform ${pocketMoneyOpen ? "rotate-180" : ""}`} />
                    </button>
                  </div>
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
                data-mobile-nav-item
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
                className={`group flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${active ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon aria-hidden="true" size={17} className={active ? 'shrink-0 text-lime' : 'shrink-0 text-muted-foreground transition-colors group-hover:text-lime dark:group-hover:text-lime'} />
                  <span>{item.label}</span>
                </span>
                <span aria-hidden="true" className={`text-xs ${active ? 'text-lime' : 'text-muted-foreground'}`}>↗</span>
              </Link>
            );
          })}
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
                className={`flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2 text-left text-sm transition ${mounted && (theme === value || (value === "system" && !theme)) ? "bg-lime/10 text-lime" : "text-foreground/70 hover:bg-muted hover:text-foreground"}`}
              >
                <Icon aria-hidden="true" size={15} />{label}
              </button>
            ))}
          </section>
        ) : null}

        {authChecked && !signedIn && (
          <Link
            href="/login"
            aria-current={pathname === '/login' ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
            className={`relative mt-2 flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${pathname === '/login' ? 'border-lime/25 bg-lime/10 text-lime' : 'border-border/70 text-foreground/75 hover:border-lime/25 hover:bg-muted hover:text-foreground'}`}
          >
            Login <LogIn aria-hidden="true" size={16} className="text-muted-foreground" />
          </Link>
        )}

        {pathname !== '/chat' ? (
          <Link prefetch href="/chat" onClick={() => setMenuOpen(false)} className="relative mt-auto flex items-center justify-center gap-2 rounded-xl bg-lime px-4 py-3 text-sm font-bold text-charcoal transition hover:bg-lime"><Sparkles aria-hidden="true" size={16} />Start chatting <span aria-hidden="true">↗</span></Link>
        ) : null}
      </div>
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
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-lime focus:ring-2 focus:ring-lime/20"
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
                className="rounded-xl bg-lime px-4 py-2.5 text-sm font-bold text-charcoal transition hover:bg-lime disabled:cursor-not-allowed disabled:opacity-50"
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
