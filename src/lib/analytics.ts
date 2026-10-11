"use client"

import type { AnalyticsProps } from "@vercel/analytics/next"
import { hasAnalyticsConsent } from "@/lib/cookie-consent"

type AnalyticsEvent = Parameters<NonNullable<AnalyticsProps["beforeSend"]>>[0]
type ConversionEvent = "Project Request Submitted" | "Project Source Purchased" | "API Explorer Purchased"

const publicRoutes = new Set([
  "/",
  "/about",
  "/api-explorer",
  "/contact",
  "/contact/process",
  "/privacy",
  "/process",
  "/projects",
  "/skills",
  "/support",
  "/terms",
])

const trackedConversionAttempts = new WeakSet<object>()

export function sanitizeAnalyticsEvent(event: AnalyticsEvent): AnalyticsEvent | null {
  if (!hasAnalyticsConsent() || typeof window === "undefined") return null

  try {
    const url = new URL(event.url, window.location.origin)
    if (url.origin !== window.location.origin) return null

    let safePath = url.pathname.replace(/\/+$/, "") || "/"
    if (/^\/projects\/[^/]+$/.test(safePath)) {
      safePath = "/projects/:id"
    } else if (!publicRoutes.has(safePath)) {
      return null
    }

    return { ...event, url: new URL(safePath, window.location.origin).toString() }
  } catch {
    return null
  }
}

export async function trackConversion(name: ConversionEvent, attempt: object): Promise<void> {
  if (trackedConversionAttempts.has(attempt) || !hasAnalyticsConsent()) return

  try {
    const { track } = await import("@vercel/analytics")
    if (trackedConversionAttempts.has(attempt) || !hasAnalyticsConsent()) return
    trackedConversionAttempts.add(attempt)
    track(name)
  } catch (error) {
    console.error("Could not record an analytics conversion.", error)
  }
}
