import type { MetadataRoute } from "next"

const siteOrigin = "https://luciferapi.com"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/api-explorer",
        "/chat",
        "/no-internet",
        "/owner/",
        "/projects/",
        "/settings",
        "/sign-in",
        "/slow-internet",
        "/transactions",
        "/wallet/",
        "/pocket-money/referrals",
      ],
    },
    sitemap: `${siteOrigin}/sitemap.xml`,
  }
}
