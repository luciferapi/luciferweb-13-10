import type { MetadataRoute } from "next"

const siteOrigin = "https://luciferapi.com"
const publicRoutes = [
  "/",
  "/about",
  "/contact",
  "/contact/process",
  "/privacy",
  "/process",
  "/pocket-money/tasks",
  "/pocket-money/watch-ads-tasks",
  "/support",
  "/terms",
]

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({ url: new URL(route, siteOrigin).toString() }))
}
