"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import Link from "next/link"

const links = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "AI Chat", href: "/chat" },
  { label: "API Explorer", href: "/api-explorer" },
  { label: "Contact", href: "/contact" },
]

export function Navigation() {
  const [open, setOpen] = useState(false)

  return (
    <motion.nav initial={{ y: -80 }} animate={{ y: 0 }} className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-[#08080b]/80 px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur-2xl sm:px-5">
        <Link href="/" className="group flex items-center gap-3 text-lg font-black tracking-[-0.06em] text-white sm:text-2xl"><span className="relative size-10 overflow-hidden rounded-xl border border-fuchsia-400/40 shadow-lg shadow-fuchsia-950/40 transition group-hover:rotate-3"><img src="/images/luciferai-brand-logo.jpg" alt="LUCIFER AI cat mascot logo" className="size-full object-cover" /></span><span>LUCIFER <span className="text-cyan-300">AI</span></span></Link>
        <button type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen(!open)} className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 transition hover:border-cyan-300/50 hover:bg-cyan-300/10">
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-white/45 sm:block">{open ? "Close" : "Menu"}</span>
          <span className="grid gap-1.5"><i className="block h-0.5 w-6 rounded-full bg-cyan-300 transition group-hover:w-8" /><i className="ml-2 block h-0.5 w-4 rounded-full bg-fuchsia-400 transition group-hover:ml-0 group-hover:w-6" /><i className="block h-0.5 w-6 rounded-full bg-white transition group-hover:w-4" /></span>
        </button>
      </div>
      <AnimatePresence>
        {open && <motion.div initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }} className="mx-auto mt-3 max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d12]/95 p-3 shadow-2xl shadow-cyan-950/30 backdrop-blur-2xl">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((link, index) => <motion.div key={link.href} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}><Link href={link.href} onClick={() => setOpen(false)} className="group flex items-center justify-between rounded-2xl border border-transparent px-5 py-4 text-white/70 transition hover:border-cyan-300/30 hover:bg-white/[0.06] hover:text-white"><span className="flex items-center gap-3"><span className="size-1.5 rounded-full bg-fuchsia-400 opacity-50 transition group-hover:bg-cyan-300 group-hover:opacity-100" />{link.label}</span><span className="font-mono text-xs text-white/25 transition group-hover:text-cyan-300">0{index + 1}</span></Link></motion.div>)}
          </div>
        </motion.div>}
      </AnimatePresence>
    </motion.nav>
  )
}
