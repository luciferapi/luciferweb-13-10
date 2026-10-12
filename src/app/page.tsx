"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowRight, BookOpenText, Cloud, Database, GraduationCap, Globe2, LayoutGrid, Smartphone } from "lucide-react"
import { Footer } from "@/components/layout/footer"
import { LiveBannerTicker } from "@/features/marketing/components/live-banner-ticker"

const MotionLink = motion.create(Link)

const brandTagline =
  "Custom websites, web apps, and AI tools built for businesses and students."

function ScrollReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function LuciferHero() {
  const prefersReducedMotion = useReducedMotion()
  const [loadBackgroundVideo, setLoadBackgroundVideo] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prefersReducedMotion) return
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }).connection
    if (connection?.saveData) return
    const timer = window.setTimeout(() => setLoadBackgroundVideo(true), 1200)
    return () => window.clearTimeout(timer)
  }, [prefersReducedMotion])

  return (
    <section
      id="hero"
      ref={heroRef}
      className="relative flex min-h-[100dvh] items-center overflow-hidden bg-background px-4 pb-20 pt-28 text-foreground sm:px-6 lg:px-8"
    >
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-[0.18] dark:opacity-25"
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
      <div
        className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background dark:from-zinc-950 dark:via-zinc-950/85 dark:to-zinc-950"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_78%_30%,rgba(175,255,0,0.10),transparent_42%),radial-gradient(circle_at_12%_80%,rgba(34,211,238,0.08),transparent_38%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="min-w-0"
        >
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground dark:text-white/70 md:text-lg">
            {brandTagline}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <MotionLink
              href="/contact#project-request"
              whileHover={prefersReducedMotion ? undefined : { y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-lime-400 px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-zinc-900 transition hover:bg-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Start a project
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </MotionLink>
            <MotionLink
              href="/projects"
              whileHover={prefersReducedMotion ? undefined : { y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="inline-flex min-h-12 items-center rounded-full border border-border bg-muted/40 px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Browse projects
            </MotionLink>
          </div>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex min-h-64 items-center justify-center lg:min-h-[26rem]"
        >
          <motion.a
            href="/chat"
            aria-label="Chat with Lucifer AI"
            className="relative block w-64 shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:w-80 lg:w-full lg:max-w-[28rem]"
            initial={prefersReducedMotion ? false : { opacity: 0, rotate: -3 }}
            animate={{
              opacity: 1,
              rotate: 0,
              y: prefersReducedMotion ? 0 : [0, -10, 0],
            }}
            transition={{
              opacity: { duration: 0.7 },
              rotate: { duration: 0.7 },
              y: { duration: 6, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            <Image
              src="/character-replacement.webp"
              alt="LUCIFER AI mascot character"
              width={669}
              height={373}
              sizes="(max-width: 639px) 16rem, (max-width: 1023px) 20rem, 28rem"
              loading="eager"
              fetchPriority="high"
              className="relative w-full max-w-full object-contain drop-shadow-2xl"
            />
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}

const services = [
  {
    title: "Web Apps",
    description: "Custom dashboards, portals, and product experiences with clean frontend and backend logic.",
    icon: Database,
    chips: ["Frontend", "API", "Auth"],
    featured: true,
  },
  {
    title: "Landing Pages",
    description: "Fast, polished marketing pages built to convert visitors and explain your offer.",
    icon: Globe2,
    chips: ["SEO", "UX", "Launch"],
    featured: false,
  },
  {
    title: "Business Websites",
    description: "Modern company sites and service pages designed for clarity and trust.",
    icon: Smartphone,
    chips: ["Brand", "Content", "CMS"],
    featured: false,
  },
]

const academicTracks = [
  {
    title: "School Projects",
    description: "Beginner-friendly builds with structure and clean delivery for students.",
    icon: BookOpenText,
    chips: ["Python", "Web", "Guidance"],
  },
  {
    title: "College Projects",
    description: "Industry-ready work with research depth, strong UI, and real-world thinking.",
    icon: GraduationCap,
    chips: ["Research", "Design", "Coding"],
  },
  {
    title: "Mini Projects",
    description: "Fast prototypes and coding exercises that build skills without overwhelm.",
    icon: Cloud,
    chips: ["Practice", "Demo", "Learning"],
  },
]

export default function Home() {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()

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

  return (
    <main className="min-h-screen bg-background">
      <LuciferHero />

      <LiveBannerTicker placement="hero-flow" />

      <section id="services" className="border-t border-border bg-background px-4 py-20 text-foreground sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <ScrollReveal>
            <h2 className="max-w-2xl text-3xl font-black tracking-[-0.04em] text-foreground dark:text-white sm:text-4xl lg:text-5xl">
              What we build
            </h2>
            <p className="mt-4 max-w-xl text-base text-muted-foreground dark:text-white/65">
              From a single landing page to a full product, we ship clean, reliable digital work.
            </p>
          </ScrollReveal>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {services.map(({ title, description, icon: Icon, chips, featured }, index) => (
              <ScrollReveal
                key={title}
                delay={index * 0.08}
                className={featured ? "lg:col-span-2 lg:row-span-2" : ""}
              >
                <article
                  className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-lime-400/40 sm:p-7 ${
                    featured
                      ? "bg-gradient-to-br from-lime-400/10 via-zinc-950 to-zinc-950 shadow-[0_24px_80px_rgba(175,255,0,0.08)]"
                      : "bg-zinc-950/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                        featured
                          ? "border-lime-400/40 bg-lime-400/10 text-lime-300"
                          : "border-white/10 bg-white/5 text-lime-300"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    {featured && (
                      <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-lime-300">
                        Most popular
                      </span>
                    )}
                  </div>
                  <h3 className="mt-6 text-2xl font-bold tracking-[-0.04em] text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-zinc-300 dark:text-white/70">{description}</p>
                  <div className="mt-auto pt-6">
                    <div className="flex flex-wrap gap-2">
                      {chips.map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-300"
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
        </div>
      </section>

      <section
        id="academic-projects"
        className="border-t border-border bg-black px-4 py-20 text-foreground sm:px-6 lg:px-8 lg:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <ScrollReveal>
            <h2 className="max-w-2xl text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
              Academic project support
            </h2>
            <p className="mt-4 max-w-xl text-base text-white/60">
              Practical help for students at every level, with guidance that builds confidence and real skills.
            </p>
          </ScrollReveal>

          <div className="mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 lg:grid lg:grid-cols-3 lg:overflow-visible">
            {academicTracks.map(({ title, description, icon: Icon, chips }, index) => (
              <ScrollReveal
                key={title}
                delay={index * 0.08}
                className="min-w-[18rem] snap-center lg:min-w-0"
              >
                <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-lime-400/40 sm:p-7">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/30 bg-lime-400/10 text-lime-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-6 text-2xl font-bold tracking-[-0.04em] text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-white/70">{description}</p>
                  <div className="mt-auto pt-6">
                    <div className="flex flex-wrap gap-2">
                      {chips.map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-300"
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
        </div>
      </section>

      <section className="border-t border-border bg-background px-4 py-20 text-foreground sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl">
          <ScrollReveal>
            <div className="relative overflow-hidden rounded-[2rem] border border-lime-400/20 bg-gradient-to-br from-lime-400/10 via-zinc-950 to-zinc-950 p-10 text-center shadow-[0_24px_80px_rgba(175,255,0,0.08)] sm:p-16">
              <LayoutGrid className="mx-auto h-10 w-10 text-lime-300" />
              <h2 className="mt-6 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                Have an idea? Let&apos;s build it.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-base text-white/65">
                Start a project for just a ₹1 fee and we will turn your idea into working software.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <MotionLink
                  href="/contact#project-request"
                  whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-lime-400 px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-zinc-900 transition hover:bg-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Start a project
                  <ArrowRight className="h-4 w-4" />
                </MotionLink>
                <Link
                  href="/chat"
                  className="inline-flex min-h-12 items-center rounded-full border border-border bg-muted/40 px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Talk to AI
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <Footer />
    </main>
  )
}
