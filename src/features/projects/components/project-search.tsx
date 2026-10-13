"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Search } from "lucide-react"
import { PROJECT_CATEGORIES, type Project } from "@/features/projects/server/projects"
import { parsePriceToPaise } from "@/features/projects/server/project-pricing"
import { ProjectCheckout } from "@/features/projects/components/project-checkout"

export function ProjectSearch({
  projects,
  searchLabel = "projects",
  categoryOptions = PROJECT_CATEGORIES.filter((projectCategory) => projectCategory !== "API"),
}: {
  projects: Project[]
  searchLabel?: string
  categoryOptions?: readonly string[]
}) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("All")
  const normalizedQuery = query.trim().toLowerCase()
  const filteredProjects = projects.filter(({ title, description, technologies }) =>
    `${title} ${description} ${technologies.join(" ")}`.toLowerCase().includes(normalizedQuery),
  ).filter((project) => category === "All" || project.category === category)

  const hasProjectsInCategory = category === "All" || projects.some((project) => project.category === category)

  return (
    <>
      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-card/40 p-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Search {searchLabel}</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${searchLabel}`}
            className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500/25"
          />
        </label>
        {categoryOptions.length > 0 ? (
          <>
            <label className="sr-only" htmlFor="project-category">Filter {searchLabel} by category</label>
            <select id="project-category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500/25 sm:w-52">
              <option value="All">All categories</option>
              {categoryOptions.map((projectCategory) => <option key={projectCategory} value={projectCategory}>{projectCategory}</option>)}
            </select>
          </>
        ) : null}
      </div>
      {filteredProjects.length > 0 ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
          {filteredProjects.map((project) => {
            const { code, title, description, imageUrl, category: projectCategory, technologies } = project
            const amountPaise = parsePriceToPaise(project.price)
            return (
            <article key={code} className="group overflow-hidden rounded-2xl border border-border bg-card transition duration-200 hover:-translate-y-0.5 hover:border-cyan-500/50">
              <Link href={`/projects/${code}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-inset">
              <div className="aspect-[16/10] overflow-hidden bg-muted">
                <img
                  src={imageUrl || "/images/luciferai-brand-logo.jpg"}
                  alt={`${title} project preview`}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
              <div className="px-4 py-4 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 truncate text-base font-semibold text-foreground">{title}</h2>
                  <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{projectCategory}</span>
                </div>
                <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-muted-foreground">{description}</p>
                {technologies.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`${title} technologies`}>
                    {technologies.slice(0, 2).map((technology) => (
                      <li key={technology} className="rounded-lg bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">{technology}</li>
                    ))}
                  </ul>
                ) : null}
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-700 transition-colors group-hover:text-cyan-600 dark:text-cyan-300 dark:group-hover:text-cyan-200">
                  View project <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </span>
              </div>
              </Link>
              {amountPaise ? (
                <div className="border-t border-border px-4 pb-4 sm:px-5">
                  <ProjectCheckout projectId={code} title={title} amountPaise={amountPaise} purchaseLabel={`Buy project · ${project.price}`} />
                </div>
              ) : null}
            </article>
            )
          })}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-border bg-card/40 px-5 py-6 text-sm text-muted-foreground" role="status">
          {projects.length === 0 ? `No published ${searchLabel} yet.` : !hasProjectsInCategory ? `No ${searchLabel} in this category yet.` : `No ${searchLabel} match “${query}”.`}
        </p>
      )}
    </>
  )
}
