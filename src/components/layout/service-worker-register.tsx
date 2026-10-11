"use client"

import { useEffect } from "react"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return

    navigator.serviceWorker.register("/service-worker.js").catch((error: unknown) => {
      console.error("Could not register the offline fallback service worker.", error)
    })
  }, [])

  return null
}
