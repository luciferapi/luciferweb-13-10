"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Check, Copy, Loader2, RefreshCw, Search } from "lucide-react"
import { ProjectSearch } from "@/components/project-search"
import type { ApiEndpoint } from "@/lib/api-endpoint-types"
import type { Project } from "@/lib/projects"

export function ApiSection({ apiProjects }: { apiProjects: Project[] }) {
  const [apis, setApis] = useState<ApiEndpoint[]>([])
  const [active, setActive] = useState("")
  const [category, setCategory] = useState("All")
  const [apiQuery, setApiQuery] = useState("")
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState("")
  const [payload, setPayload] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/api-endpoints", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result: unknown = await response.json()
        if (!response.ok) throw new Error("Could not load available APIs.")
        if (
          typeof result !== "object" ||
          result === null ||
          !("endpoints" in result) ||
          !Array.isArray(result.endpoints)
        ) throw new Error("The API catalog response was invalid.")

        const endpoints = result.endpoints.filter((endpoint): endpoint is ApiEndpoint =>
          typeof endpoint === "object" &&
          endpoint !== null &&
          "id" in endpoint && typeof endpoint.id === "string" &&
          "name" in endpoint && typeof endpoint.name === "string" &&
          "path" in endpoint && typeof endpoint.path === "string" &&
          "note" in endpoint && typeof endpoint.note === "string" &&
          "category" in endpoint && typeof endpoint.category === "string" &&
          "isEnabled" in endpoint && endpoint.isEnabled === true,
        )
        setApis(endpoints)
        setActive(endpoints[0]?.id ?? "")
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === "AbortError") return
        console.error("Could not load the API endpoint catalog.", loadError)
        setCatalogError(loadError instanceof Error ? loadError.message : "Could not load available APIs.")
      })
      .finally(() => setCatalogLoading(false))
    return () => controller.abort()
  }, [])

  const apiCategories = ["All", ...new Set(apis.map((api) => api.category))]
  const normalizedQuery = apiQuery.trim().toLowerCase()
  const visibleApis = apis.filter((api) =>
    (category === "All" || api.category === category) &&
    `${api.name} ${api.path} ${api.note} ${api.category}`.toLowerCase().includes(normalizedQuery),
  )
  const selected = visibleApis.find((api) => api.id === active) ?? visibleApis[0]
  const url = selected ? `https://luciferapi.com/${selected.path}` : ""
  const selectedVideoSource = selected?.demoVideo && /^https?:\/\//i.test(selected.demoVideo)
    ? selected.demoVideo
    : selected?.demoVideo ? `/api/project-demo/${encodeURIComponent(selected.demoVideo)}` : ""

  async function fetchResults() {
    if (!selected) return
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/results?source=${selected.id}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Request failed")
      setPayload(result.data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Request failed")
    } finally {
      setLoading(false)
    }
  }

  async function copyEndpoint() {
    if (!url) return
    setCopyError("")
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch (copyFailure) {
      console.error("Could not copy the API endpoint.", copyFailure)
      setCopyError("Could not copy the endpoint. Select and copy the URL manually.")
    }
  }

  return (
    <section id="api" className="relative overflow-hidden bg-[#08080b] py-24 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.16),transparent_35%),radial-gradient(circle_at_10%_80%,rgba(34,211,238,0.08),transparent_30%)]" />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-fuchsia-400">{"// api section"}</span>
          <h2 className="mt-4 text-4xl font-black uppercase tracking-tight md:text-6xl">LUCIFERAPI SERVICES</h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/55">Explore LuciferAPI projects and data services. Test a public GET endpoint, inspect the JSON response, and connect it to your next application.</p>
        </div>

        {apiProjects.length > 0 ? (
          <div className="mb-12 border-y border-white/10 py-8">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-300">{"// owner projects"}</p>
                <h3 className="mt-2 text-2xl font-bold">API Projects</h3>
              </div>
              <span className="font-mono text-xs text-white/40">{apiProjects.length} published</span>
            </div>
            <ProjectSearch projects={apiProjects} searchLabel="APIs" categoryOptions={[]} />
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">{"// available endpoints"}</p>
            <h3 className="mt-2 text-2xl font-bold">Explore APIs</h3>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <label className="relative block min-w-0 flex-1 sm:w-64">
              <span className="sr-only">Search available APIs</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
              <input
                type="search"
                value={apiQuery}
                onChange={(event) => {
                  setApiQuery(event.target.value)
                  setPayload(null)
                  setError("")
                }}
                placeholder="Search APIs"
                className="h-10 w-full rounded-lg border border-white/10 bg-[#101016] pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-cyan-300/60"
              />
            </label>
            <label className="text-xs text-white/55">
              <span className="sr-only">Filter APIs by category</span>
              <select
                value={category}
                onChange={(event) => {
                  const nextCategory = event.target.value
                  const firstApi = apis.find((api) => nextCategory === "All" || api.category === nextCategory)
                  setCategory(nextCategory)
                  if (firstApi) setActive(firstApi.id)
                  setPayload(null)
                  setError("")
                }}
                className="h-10 min-w-44 rounded-lg border border-white/10 bg-[#101016] px-3 text-sm text-white outline-none focus:border-cyan-300/60"
              >
                {apiCategories.map((option) => <option key={option} value={option}>{option === "All" ? "All API categories" : option}</option>)}
              </select>
            </label>
          </div>
        </div>
        {catalogLoading ? <p role="status" className="py-6 text-sm text-white/60">Loading available APIs...</p> : null}
        {catalogError ? <p role="alert" className="py-6 text-sm text-rose-300">{catalogError}</p> : null}
        {!catalogLoading && !catalogError ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="API catalog">
          {visibleApis.map((api) => (
            <button
              key={api.id}
              type="button"
              aria-pressed={selected?.id === api.id}
              onClick={() => { setActive(api.id); setPayload(null); setError("") }}
              className={`group overflow-hidden rounded-lg border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${selected?.id === api.id ? "border-cyan-300/60 bg-white/[0.07]" : "border-white/10 bg-white/[0.035] hover:border-cyan-300/40"}`}
            >
              <div className="aspect-[16/10] overflow-hidden bg-white/5">
                <img src={api.imageUrl || "/images/luciferai-brand-logo.jpg"} alt={`${api.name} API preview`} loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" />
              </div>
              <span className="block px-4 py-4">
                <span className="block text-base font-bold text-white">{api.name}</span>
                <span className="mt-1 block font-mono text-[10px] text-white/40">Code: {api.id}</span>
              </span>
            </button>
          ))}
        </div> : null}
        {!catalogLoading && visibleApis.length === 0 ? (
          <p className="mt-4 rounded-lg border border-white/10 px-5 py-6 text-sm text-white/60" role="status">
            No APIs match “{apiQuery}” in this category.
          </p>
        ) : null}

        {selected ? <div className="mt-8 min-w-0 rounded-3xl border border-white/10 bg-[#101016] p-5 shadow-2xl shadow-fuchsia-950/20 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">GET / {selected.path}</p><h3 className="mt-2 text-2xl font-bold">{selected.name}</h3><p className="mt-1 text-sm text-white/50">{selected.note}</p><p className="mt-2 font-mono text-[10px] text-white/40">API code: {selected.id}</p></div><span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-emerald-300">no auth</span></div>
            {selected.linkUrl ? <a href={selected.linkUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 underline underline-offset-4 hover:text-cyan-200">Documentation / related link <span aria-hidden="true">↗</span></a> : null}
            {selected.demoVideo ? <video controls playsInline preload="metadata" className="mt-5 max-h-[60vh] w-full rounded-xl border border-white/10 bg-black" aria-label={`${selected.name} API demo video`}><source src={selectedVideoSource} />Your browser does not support embedded video.</video> : null}
            <button type="button" onClick={() => void copyEndpoint()} aria-label={copied ? "Endpoint copied" : "Copy API endpoint"} className="mt-6 flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left font-mono text-xs text-white/55 hover:border-cyan-300/40"><span className="truncate select-all">{url}</span>{copied ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-300" /> : <Copy aria-hidden="true" className="h-4 w-4 shrink-0" />}</button>
            {copyError ? <p role="alert" className="mt-2 text-sm text-rose-300">{copyError}</p> : null}
            <div className="mt-5 flex items-center gap-3"><button onClick={fetchResults} disabled={loading} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:bg-cyan-200 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Test endpoint</button><span className="font-mono text-xs text-white/35">GET · JSON / history</span></div>
            <motion.pre key={`${selected.id}-${String(payload)}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 min-h-48 max-h-72 overflow-auto rounded-2xl border border-white/10 bg-black/45 p-4 font-mono text-xs leading-6 text-cyan-100/75">{error ? `Error: ${error}` : payload ? JSON.stringify(payload, null, 2) : "// Response preview\n// Select an endpoint and test the connection."}</motion.pre>
            <p className="mt-4 text-xs text-white/35">For result/history display only. No prediction or betting functionality.</p>
        </div> : null}
      </div>
    </section>
  )
}
