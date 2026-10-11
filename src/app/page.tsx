"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { BookOpenText, Cloud, Database, Globe2, GraduationCap, Smartphone } from "lucide-react"
import { Footer } from "@/components/layout/footer"
import { LiveBannerTicker } from "@/features/marketing/components/live-banner-ticker"

const MotionLink = motion.create(Link)
const brandDescription =
  "At LUCIFER AI, we turn ideas into reality through web development, AI, and automation. We love exploring new technologies and building useful digital solutions that make everyday tasks easier. Our goal is simple: create smart, modern, and reliable solutions for everyone."

function ScrollReveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function LuciferHero() {
  const prefersReducedMotion = useReducedMotion()
  const [loadBackgroundVideo, setLoadBackgroundVideo] = useState(false)
  const typedTextRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }).connection
    const slowConnection = connection?.saveData ||
      (connection?.effectiveType && connection.effectiveType !== "4g")

    if (prefersReducedMotion || slowConnection) return

    const timer = window.setTimeout(() => setLoadBackgroundVideo(true), 1500)
    return () => window.clearTimeout(timer)
  }, [prefersReducedMotion])

  useEffect(() => {
    const typedText = typedTextRef.current
    if (!typedText) return

    if (prefersReducedMotion) {
      typedText.textContent = brandDescription
      return
    }

    let characterIndex = 0
    typedText.textContent = ""
    const typingTimer = window.setInterval(() => {
      characterIndex += 1
      typedText.textContent = brandDescription.slice(0, characterIndex)
      if (characterIndex >= brandDescription.length) {
        window.clearInterval(typingTimer)
      }
    }, 24)

    return () => window.clearInterval(typingTimer)
  }, [prefersReducedMotion])

  return (
    <section id="hero" className="relative flex min-h-[92vh] items-center overflow-hidden bg-background px-4 pb-24 pt-28 text-foreground sm:px-6 lg:px-8">
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-0 brightness-110 contrast-110 dark:opacity-100"
        autoPlay={loadBackgroundVideo}
        muted
        loop
        playsInline
        poster="/video/background-poster.webp"
        preload="none"
        aria-hidden="true"
      >
        {loadBackgroundVideo && (
          <source src="/video/background%20video.mp4" type="video/mp4" media="(min-width: 768px)" />
        )}
      </video>
      <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(8,8,11,0.42)_0%,rgba(8,8,11,0.36)_42%,rgba(8,8,11,0.16)_100%),linear-gradient(180deg,rgba(8,8,11,0.1),rgba(8,8,11,0.48))] dark:block" aria-hidden="true" />
      <div className="absolute inset-0 hidden bg-[radial-gradient(circle_at_72%_35%,rgba(168,85,247,0.18),transparent_32%),radial-gradient(circle_at_15%_75%,rgba(34,211,238,0.12),transparent_28%)] dark:block" aria-hidden="true" />
      <div className="relative mx-auto grid min-w-0 w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="min-w-0 rounded-2xl dark:bg-[#08080B]/90 dark:p-6 dark:shadow-2xl">
          <h1 className="mt-6 text-[clamp(2.5rem,5.5vw,4.8rem)] font-black uppercase leading-[0.9] tracking-[-0.08em] text-foreground xl:text-[5.2rem] dark:text-white dark:drop-shadow-[0_0_24px_rgba(255,255,255,0.22)]">DEvelopment services</h1>
          <p aria-label={brandDescription} className="mt-8 min-h-32 max-w-xl border-l-2 border-cyan-300/50 pl-5 text-sm leading-7 text-muted-foreground md:mt-10 md:min-h-28 md:text-base dark:text-white/75">
            <span ref={typedTextRef} aria-hidden="true" />
          </p>
        </div>
        <div className="relative flex min-h-64 items-center justify-center lg:min-h-[26rem]">
          <motion.a
            href="/chat"
            aria-label="Click to chat with Lucifer"
            className="relative z-0 block w-64 shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:w-80 lg:w-full lg:max-w-[28rem]"
            initial={{ opacity: 0, y: 16, rotate: -3 }}
            animate={{ opacity: 1, y: [0, -4, 0], rotate: [-3, 2, -3] }}
            transition={{ opacity: { duration: 0.7 }, y: { duration: 4, repeat: Infinity, ease: "easeInOut" }, rotate: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}
          >
            <Image
              src="/character-replacement.webp"
              alt="LUCIFER AI character"
              width={669}
              height={373}
              sizes="(max-width: 639px) 16rem, (max-width: 1023px) 20rem, 28rem"
              loading="eager"
              fetchPriority="high"
              className="relative w-full max-w-full object-contain drop-shadow-2xl"
            />
          </motion.a>
        </div>
        <motion.nav
          aria-label="Quick links"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: prefersReducedMotion ? 0 : 0.2, ease: "easeOut" }}
          className="mt-8 flex w-full flex-wrap items-center justify-center gap-4 lg:col-span-2"
        >
          <MotionLink href="/contact#project-request" whileHover={prefersReducedMotion ? undefined : { y: -2 }} whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-[#AFFF00] px-5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#121212] transition hover:bg-[#D9FF70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#AFFF00] focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            Start a project · ₹1 fee
          </MotionLink>
          <MotionLink href="/projects" whileHover={prefersReducedMotion ? undefined : { y: -2 }} whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-border bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            Browse projects
          </MotionLink>
          <MotionLink href="/chat" whileHover={prefersReducedMotion ? undefined : { y: -2 }} whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            Talk with AI
          </MotionLink>
        </motion.nav>
        <LiveBannerTicker placement="hero-flow" />
      </div>
    </section>
  )
}

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mode = params.get("mode")?.toLowerCase()
    if (!mode || !["signup", "sign-up", "singupt", "create-account"].includes(mode)) return

    const query = new URLSearchParams({ mode: "create-account" })
    const referralCode = params.get("ref")
    if (referralCode && /^[A-Za-z0-9_-]{1,32}$/.test(referralCode)) {
      query.set("ref", referralCode)
    }
    router.replace(`/sign-in?${query.toString()}`)
  }, [router])

  const decisionBranches = [
    {
      title: "Landing Pages",
      description: "Fast, polished marketing pages built to convert visitors and explain your offer clearly.",
      icon: Globe2,
      accent: "from-cyan-500/15 via-cyan-500/0 to-transparent",
      chips: ["SEO", "UX", "Launch"],
    },
    {
      title: "Business Websites",
      description: "Modern company sites, portfolio pages, and service pages designed for clarity and trust.",
      icon: Smartphone,
      accent: "from-violet-500/15 via-violet-500/0 to-transparent",
      chips: ["Brand", "Content", "CMS"],
    },
    {
      title: "Web Apps",
      description: "Custom dashboards, portals, and product experiences backed by clean frontend and backend logic.",
      icon: Database,
      accent: "from-emerald-500/15 via-emerald-500/0 to-transparent",
      chips: ["Frontend", "API", "Auth"],
    },
  ]

  const academicBranches = [
    {
      title: "School Projects",
      description: "Practical, beginner-friendly builds for students who need confidence, structure, and clean project delivery.",
      icon: BookOpenText,
      accent: "from-cyan-500/15 via-cyan-500/0 to-transparent",
      chips: ["Python", "Web", "Guidance"],
    },
    {
      title: "College Projects",
      description: "Industry-ready academic work with stronger research depth, better UI, and real-world technical thinking.",
      icon: GraduationCap,
      accent: "from-violet-500/15 via-violet-500/0 to-transparent",
      chips: ["Research", "Design", "Coding"],
    },
    {
      title: "Mini Projects",
      description: "Fast prototypes, small builds, and coding exercises that sharpen skills without overwhelming the student.",
      icon: Cloud,
      accent: "from-emerald-500/15 via-emerald-500/0 to-transparent",
      chips: ["Practice", "Demo", "Learning"],
    },
  ]

  return (
    <main className="min-h-screen bg-background">
      <LuciferHero />

      <section id="services" className="bg-background px-4 py-20 text-foreground sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="relative mt-10">
            <ScrollReveal className="mx-auto max-w-md rounded-[30px] border border-cyan-400/25 bg-gradient-to-br from-cyan-500/10 via-zinc-950 to-violet-500/10 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.25)] sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Start</p>
                  <h3 className="mt-3 text-2xl font-bold tracking-[-0.05em] text-white">REAL WORLD WEBSITES</h3>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-300">
                  <Cloud className="h-5 w-5" />
                </span>
              </div>
            </ScrollReveal>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {decisionBranches.map(({ title, description, icon: Icon, accent, chips }, index) => (
                <ScrollReveal key={title} delay={index * 0.08} className="h-full">
                  <article className="group relative h-full overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950/60 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.28)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-[0_28px_90px_rgba(34,211,238,0.12)] sm:p-7">
                    <div className={`absolute inset-0 bg-gradient-to-br ${accent}`} aria-hidden="true" />
                    <div className="absolute inset-[1px] rounded-[27px] bg-zinc-950/80" aria-hidden="true" />
                    <div className="relative z-10 flex h-full flex-col">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-300">
                          Path
                        </span>
                      </div>
                      <h3 className="mt-6 text-2xl font-bold tracking-[-0.05em] text-white">{title}</h3>
                      <p className="mt-3 text-sm leading-7 text-zinc-300">{description}</p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {chips.map((chip) => (
                          <span
                            key={chip}
                            className="rounded-full border border-border bg-white/[0.02] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-300"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {[{ label: "Landing", color: "text-cyan-300", body: "Custom one-page and marketing websites built to convert" }, { label: "Business", color: "text-violet-300", body: "Modern business sites with structure, trust, and polished UX" }, { label: "Product", color: "text-emerald-300", body: "Custom web apps, dashboards, and tools for real workflows" }].map(({ label, color, body }, index) => (
                <ScrollReveal key={label} delay={index * 0.08}>
                  <div className="rounded-[24px] border border-white/10 bg-zinc-950/70 p-5">
                    <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${color}`}>{label}</p>
                    <p className="mt-3 text-lg font-semibold text-white">{body}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="academic-projects" className="border-t border-border bg-black px-4 py-20 text-foreground sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="relative mt-10">
            <ScrollReveal className="mx-auto max-w-md rounded-[30px] border border-cyan-400/25 bg-gradient-to-br from-cyan-500/10 via-zinc-950 to-violet-500/10 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.25)] sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Academic</p>
                  <h3 className="mt-3 text-2xl font-bold tracking-[-0.05em] text-white">Project support</h3>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-300">
                  <GraduationCap className="h-5 w-5" />
                </span>
              </div>
            </ScrollReveal>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {academicBranches.map(({ title, description, icon: Icon, accent, chips }, index) => (
                <ScrollReveal key={title} delay={index * 0.08} className="h-full">
                  <article className="group relative h-full overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950/60 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.28)] transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/40 hover:shadow-[0_28px_90px_rgba(168,85,247,0.12)] sm:p-7">
                    <div className={`absolute inset-0 bg-gradient-to-br ${accent}`} aria-hidden="true" />
                    <div className="absolute inset-[1px] rounded-[27px] bg-zinc-950/80" aria-hidden="true" />
                    <div className="relative z-10 flex h-full flex-col">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/10 text-violet-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-300">
                          Track
                        </span>
                      </div>
                      <h3 className="mt-6 text-2xl font-bold tracking-[-0.05em] text-white">{title}</h3>
                      <p className="mt-3 text-sm leading-7 text-zinc-300">{description}</p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {chips.map((chip) => (
                          <span
                            key={chip}
                            className="rounded-full border border-border bg-white/[0.02] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-300"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {[{ label: "School", color: "text-cyan-300", body: "Simple guidance for student projects and learning milestones." }, { label: "College", color: "text-violet-300", body: "Stronger research, cleaner coding, and a more professional final result." }, { label: "Mini", color: "text-emerald-300", body: "Quick wins and practice projects to build momentum naturally." }].map(({ label, color, body }, index) => (
                <ScrollReveal key={label} delay={index * 0.08}>
                  <div className="rounded-[24px] border border-white/10 bg-zinc-950/70 p-5">
                    <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${color}`}>{label}</p>
                    <p className="mt-3 text-lg font-semibold text-white">{body}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
