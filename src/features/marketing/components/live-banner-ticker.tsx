"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import Image from "next/image"

type LiveBanner = {
  id: string
  message: string
  linkUrl: string | null
  imageUrl: string | null
  isEnabled: boolean
  sortOrder: number
}

function isBanner(value: unknown): value is LiveBanner {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "string" &&
    "message" in value && typeof value.message === "string" &&
    "linkUrl" in value && (typeof value.linkUrl === "string" || value.linkUrl === null) &&
    "imageUrl" in value && (typeof value.imageUrl === "string" || value.imageUrl === null) &&
    "isEnabled" in value && value.isEnabled === true &&
    "sortOrder" in value && typeof value.sortOrder === "number"
}

function BannerImages({ banners }: { banners: LiveBanner[] }) {
  return banners.map((banner) => {
    if (!banner.imageUrl) return null
    return (
      <div className="live-image-banner-slide" key={banner.id}>
        {banner.linkUrl ? (
          <a href={banner.linkUrl} target={banner.linkUrl.startsWith("/") ? undefined : "_blank"} rel="noreferrer" aria-label={banner.message || "Live announcement"}>
            <Image src={banner.imageUrl} alt={banner.message || "Live announcement"} fill sizes="(max-width: 768px) 100vw, 72rem" unoptimized />
          </a>
        ) : (
          <Image src={banner.imageUrl} alt={banner.message || "Live announcement"} fill sizes="(max-width: 768px) 100vw, 72rem" unoptimized />
        )}
      </div>
    )
  })
}

function BannerItems({ banners }: { banners: LiveBanner[] }) {
  return banners.map((banner) => (
    <span className="live-banner-item" key={banner.id}>
      {banner.linkUrl ? (
        <a href={banner.linkUrl} target={banner.linkUrl.startsWith("/") ? undefined : "_blank"} rel="noreferrer">
          {banner.message}
        </a>
      ) : banner.message}
    </span>
  ))
}

export function LiveBannerTicker({
  placement = "hero",
}: {
  placement?: "hero" | "hero-flow" | "inline"
}) {
  const [banners, setBanners] = useState<LiveBanner[]>([])
  const [textLoop, setTextLoop] = useState({ copies: 2, distance: 0 })
  const textTickerRef = useRef<HTMLDivElement>(null)
  const textGroupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let disposed = false
    const timer = setInterval(() => void loadBanners(), 60_000)
    const controller = new AbortController()

    async function loadBanners() {
      try {
        const response = await fetch("/api/live-banners", { cache: "no-store", signal: controller.signal })
        const result: unknown = await response.json()
        if (!response.ok) {
          const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "Could not load homepage banners."
          throw new Error(message)
        }
        if (
          typeof result !== "object" || result === null || !("banners" in result) ||
          !Array.isArray(result.banners) || !result.banners.every(isBanner)
        ) throw new Error("The homepage banner response had an invalid format.")
        if (!disposed) setBanners(result.banners)
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
        console.error("Could not refresh homepage live banners.", error)
      }
    }

    void loadBanners()
    return () => {
      disposed = true
      controller.abort()
      clearInterval(timer)
    }
  }, [])

  const imageBanners = banners.filter((banner) => banner.imageUrl)
  const textBanners = banners.filter((banner) => !banner.imageUrl)

  useEffect(() => {
    const ticker = textTickerRef.current
    const group = textGroupRef.current
    if (!ticker || !group || textBanners.length === 0) return

    const updateLoop = () => {
      const groupWidth = group.getBoundingClientRect().width
      const tickerWidth = ticker.clientWidth
      if (groupWidth <= 0 || tickerWidth <= 0) return

      setTextLoop({
        copies: Math.max(2, Math.ceil((tickerWidth + groupWidth) / groupWidth)),
        distance: groupWidth,
      })
    }

    const observer = new ResizeObserver(updateLoop)
    observer.observe(ticker)
    observer.observe(group)
    updateLoop()
    return () => observer.disconnect()
  }, [textBanners.length])

  if (banners.length === 0) return null

  const textTrackStyle = {
    "--banner-loop-distance": `${textLoop.distance}px`,
    "--banner-loop-duration": `${Math.max(12, textLoop.distance / 40)}s`,
  } as CSSProperties

  return (
    <>
      {imageBanners.length > 0 ? (
        <section className="live-image-banner" aria-label="Live image banners">
          <div className="live-image-banner-track">
            <div className="live-image-banner-group"><BannerImages banners={imageBanners} /></div>
            <div className="live-image-banner-group" aria-hidden="true"><BannerImages banners={imageBanners} /></div>
          </div>
        </section>
      ) : null}
      {textBanners.length > 0 ? (
        <div
          ref={textTickerRef}
          className={`live-banner-ticker${placement === "inline" ? " live-banner-ticker-inline" : ""}${placement === "hero-flow" ? " live-banner-ticker-home" : ""}`}
          role="region"
          aria-label="Live announcements"
        >
          <div className="live-banner-track" style={textTrackStyle}>
            {Array.from({ length: textLoop.copies }, (_, index) => (
              <div
                className="live-banner-group"
                key={index}
                ref={index === 0 ? textGroupRef : undefined}
                aria-hidden={index === 0 ? undefined : true}
              >
                <BannerItems banners={textBanners} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}
