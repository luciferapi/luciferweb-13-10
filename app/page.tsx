"use client"

import { useEffect } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { Footer } from "@/components/footer"

function LuciferHero() {
  return (
    <section id="hero" className="relative flex min-h-[92vh] items-center overflow-hidden bg-background px-4 pb-8 pt-28 text-foreground sm:px-6 lg:px-8">
      <video className="absolute inset-0 h-full w-full object-cover opacity-0 brightness-110 contrast-110 dark:opacity-100" autoPlay muted loop playsInline aria-hidden="true">
        <source src="/video/background%20video.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(8,8,11,0.42)_0%,rgba(8,8,11,0.36)_42%,rgba(8,8,11,0.16)_100%),linear-gradient(180deg,rgba(8,8,11,0.1),rgba(8,8,11,0.48))] dark:block" aria-hidden="true" />
      <div className="absolute inset-0 hidden bg-[radial-gradient(circle_at_72%_35%,rgba(168,85,247,0.18),transparent_32%),radial-gradient(circle_at_15%_75%,rgba(34,211,238,0.12),transparent_28%)] dark:block" aria-hidden="true" />
      <div className="relative mx-auto grid min-w-0 w-full max-w-6xl items-center gap-10 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="min-w-0">
          <h1 className="mt-6 text-[clamp(2.5rem,5.5vw,4.8rem)] font-black uppercase leading-[0.9] tracking-[-0.08em] text-foreground xl:text-[5.2rem] dark:text-white dark:drop-shadow-[0_0_24px_rgba(255,255,255,0.22)]">BUILDING DIGITAL EXPERIENCES</h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8 dark:text-white/80 dark:drop-shadow-[0_0_18px_rgba(0,0,0,0.45)]">Hi, I&apos;m K Praveenkumar. I build with code, AI, APIs, and modern web technologies.</p>
          <div className="mt-9 flex flex-wrap gap-3"><a href="#api" className="rounded-full bg-foreground px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-background transition hover:opacity-80">Explore the APIs</a><a href="#about" className="rounded-full border border-border px-6 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-foreground/80 transition hover:border-cyan-500/60 hover:text-foreground dark:border-white/15 dark:text-white/80 dark:hover:text-white">About LUCIFER AI</a><a href="/contact" className="rounded-full border border-cyan-500/50 bg-cyan-500/10 px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-cyan-800 transition hover:bg-cyan-500/20 dark:text-cyan-200">Request New Project</a></div>
        </div>
        <motion.a href="/chat" aria-label="Open LUCIFER AI chat" className="relative mx-auto block min-w-0 w-full max-w-sm cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-8 focus-visible:ring-offset-background" initial={{ opacity: 0, y: 28, rotate: -3 }} animate={{ opacity: 1, y: [0, -10, 0], rotate: [-3, 2, -3] }} transition={{ opacity: { duration: 0.7 }, y: { duration: 4, repeat: Infinity, ease: "easeInOut" }, rotate: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}>
          <motion.div className="absolute -inset-8 rounded-full bg-fuchsia-500/20 blur-3xl" animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.75, 0.45] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} />
          <motion.div className="absolute right-0 top-8 z-10 rounded-2xl border border-cyan-300/30 bg-[#10131c]/90 px-4 py-2 font-mono text-xs text-cyan-200 shadow-xl sm:-right-5" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: [0, 1, 1, 0], y: [8, 0, -4, -10] }} transition={{ duration: 5, repeat: Infinity, times: [0, 0.12, 0.8, 1] }}>hey, let&apos;s build</motion.div>
          <img src="/character-replacement.png" alt="LUCIFER AI character" className="relative w-full max-w-full object-contain drop-shadow-2xl" />
        </motion.a>
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

  return (
    <main className="min-h-screen bg-background">
      <LuciferHero />

      <Footer />
    </main>
  )
}
