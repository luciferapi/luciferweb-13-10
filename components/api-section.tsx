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
  const [hasPayload, setHasPayload] = useState(false)
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
      setHasPayload(true)
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
    <section id="api" className="py-16 text-foreground sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mb-12 max-w-2xl">
          <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300">LuciferAPI</p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Explore the API catalog</h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Browse API projects, test available GET endpoints, and inspect their JSON responses.
          </p>
        </div>

        {apiProjects.length > 0 ? (
          <div className="mb-12 border-y border-border py-8">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-2xl font-semibold tracking-tight">API projects</h3>
              <span className="text-sm text-muted-foreground">{apiProjects.length} published</span>
            </div>
            <ProjectSearch projects={apiProjects} searchLabel="APIs" categoryOptions={[]} />
          </div>
        ) : null}

        <div className="mb-5">
          <h3 className="text-2xl font-semibold tracking-tight">Available endpoints</h3>
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-card/40 p-3 sm:flex-row sm:items-center">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Search available APIs</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={apiQuery}
                onChange={(event) => {
                  setApiQuery(event.target.value)
                  setPayload(null)
                  setHasPayload(false)
                  setError("")
                }}
                placeholder="Search APIs"
                className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500/25"
              />
            </label>
            <label>
              <span className="sr-only">Filter APIs by category</span>
              <select
                value={category}
                onChange={(event) => {
                  const nextCategory = event.target.value
                  const firstApi = apis.find((api) => nextCategory === "All" || api.category === nextCategory)
                  setCategory(nextCategory)
                  if (firstApi) setActive(firstApi.id)
                  setPayload(null)
                  setHasPayload(false)
                  setError("")
                }}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500/25 sm:w-56"
              >
                {apiCategories.map((option) => <option key={option} value={option}>{option === "All" ? "All API categories" : option}</option>)}
              </select>
            </label>
          </div>
        </div>
        {catalogLoading ? <p role="status" className="py-6 text-sm text-muted-foreground">Loading available APIs...</p> : null}
        {catalogError ? <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{catalogError}</p> : null}
        {!catalogLoading && !catalogError ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="API catalog">
          {visibleApis.map((api) => (
            <button
              key={api.id}
              type="button"
              aria-pressed={selected?.id === api.id}
              onClick={() => { setActive(api.id); setPayload(null); setHasPayload(false); setError("") }}
              className={`group overflow-hidden rounded-2xl border text-left transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${selected?.id === api.id ? "border-cyan-500/60 bg-cyan-500/5" : "border-border bg-card hover:border-cyan-500/40"}`}
            >
              <div className="aspect-[16/10] overflow-hidden bg-muted">
                <img src={api.imageUrl || "/images/luciferai-brand-logo.jpg"} alt={`${api.name} API preview`} loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" />
              </div>
              <span className="block px-4 py-4 sm:px-5">
                <span className="block text-base font-semibold text-foreground">{api.name}</span>
                <span className="mt-1 block font-mono text-xs text-muted-foreground">Code: {api.id}</span>
              </span>
            </button>
          ))}
        </div> : null}
        {!catalogLoading && !catalogError && visibleApis.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-border bg-card/40 px-5 py-6 text-sm text-muted-foreground" role="status">
            No APIs match “{apiQuery}” in this category.
          </p>
        ) : null}

        {selected ? <div className="mt-8 min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-xs font-medium text-cyan-700 dark:text-cyan-300">GET /{selected.path}</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">{selected.name}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{selected.note}</p>
                <p className="mt-2 font-mono text-xs text-muted-foreground">API code: {selected.id}</p>
              </div>
              <span className="rounded-full border border-emerald-700/20 bg-emerald-700/5 px-3 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-300">No authentication</span>
            </div>
            {selected.linkUrl ? <a href={selected.linkUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 underline underline-offset-4 hover:text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-cyan-300 dark:hover:text-cyan-200">Documentation / related link <span aria-hidden="true">↗</span></a> : null}
            {selected.demoVideo ? <video controls playsInline preload="metadata" className="mt-5 max-h-[60vh] w-full rounded-xl border border-border bg-muted" aria-label={`${selected.name} API demo video`}><source src={selectedVideoSource} />Your browser does not support embedded video.</video> : null}
            <button type="button" onClick={() => void copyEndpoint()} aria-label={copied ? "Endpoint copied" : "Copy API endpoint"} className="mt-6 flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left font-mono text-xs text-muted-foreground transition hover:border-cyan-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"><span className="truncate select-all">{url}</span>{copied ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" /> : <Copy aria-hidden="true" className="h-4 w-4 shrink-0" />}</button>
            {copyError ? <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">{copyError}</p> : null}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" onClick={fetchResults} disabled={loading} className="inline-flex items-center gap-2 rounded-full bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-cyan-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200">{loading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <RefreshCw aria-hidden="true" className="h-4 w-4" />} Test endpoint</button>
              <span className="text-xs text-muted-foreground">GET request returning JSON</span>
            </div>
            <motion.pre key={`${selected.id}-${String(payload)}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`mt-6 min-h-48 max-h-72 overflow-auto rounded-xl border border-border p-4 font-mono text-xs leading-6 ${error ? "bg-rose-500/5 text-rose-800 dark:text-rose-200" : "bg-muted/60 text-foreground"}`} aria-live="polite">{error ? `Error: ${error}` : hasPayload ? JSON.stringify(payload, null, 2) : "// Response preview\n// Select an endpoint and test the connection."}</motion.pre>
            <p className="mt-4 text-xs text-muted-foreground">For result and history display only. No prediction or betting functionality.</p>
        </div> : null}
      </div>
    </section>
  )
}
