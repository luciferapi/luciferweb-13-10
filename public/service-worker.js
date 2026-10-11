const CACHE_NAME = "luciferai-offline-v1"
const OFFLINE_PAGE = "/offline.html"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_PAGE)).then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("luciferai-offline-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET" || request.mode !== "navigate") return

  const requestUrl = new URL(request.url)
  if (requestUrl.origin !== self.location.origin) return

  if (requestUrl.pathname === OFFLINE_PAGE) {
    event.respondWith(
      caches
        .open(CACHE_NAME)
        .then((cache) => cache.match(OFFLINE_PAGE))
        .then((cachedPage) => cachedPage || fetch(request)),
    )
    return
  }

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME)
      const cachedPage = await cache.match(OFFLINE_PAGE)
      return cachedPage || Response.error()
    }),
  )
})
