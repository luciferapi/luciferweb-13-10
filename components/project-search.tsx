"use client"

import { useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { PROJECT_CATEGORIES, type Project } from "@/lib/projects"

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
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="relative block min-w-0 flex-1 sm:max-w-md">
          <span className="sr-only">Search {searchLabel}</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${searchLabel}`}
            className="h-11 w-full rounded-lg border border-border bg-card/70 pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
          />
        </label>
        {categoryOptions.length > 0 ? (
          <>
            <label className="sr-only" htmlFor="project-category">Filter {searchLabel} by category</label>
            <select id="project-category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-cyan-400 sm:w-48">
              <option value="All">All categories</option>
              {categoryOptions.map((projectCategory) => <option key={projectCategory} value={projectCategory}>{projectCategory}</option>)}
            </select>
          </>
        ) : null}
      </div>
      {filteredProjects.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
          {filteredProjects.map(({ code, title, description, imageUrl, category: projectCategory, technologies }) => (
            <Link key={code} href={`/projects/${code}`} className="group overflow-hidden rounded-lg border border-border bg-card/60 transition hover:border-cyan-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
              <div className="aspect-[16/10] overflow-hidden bg-muted">
                <img
                  src={imageUrl || "/images/luciferai-brand-logo.jpg"}
                  alt={`${title} project preview`}
                  loading="lazy"
                  className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <div className="px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-foreground">{title}</h2>
                  <span className="shrink-0 text-xs text-muted-foreground">{projectCategory}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{description}</p>
                {technologies.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`${title} technologies`}>
                    {technologies.slice(0, 3).map((technology) => (
                      <li key={technology} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{technology}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-border px-5 py-6 text-sm text-muted-foreground" role="status">
          {projects.length === 0 ? `No published ${searchLabel} yet.` : !hasProjectsInCategory ? `No ${searchLabel} in this category yet.` : `No ${searchLabel} match “${query}”.`}
        </p>
      )}
    </>
  )
}