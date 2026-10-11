"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useOffline } from "next/offline"
import { NetworkStatusScreen } from "@/features/network/components/network-status-screen"

type NetworkInformation = EventTarget & {
  effectiveType?: string
  downlink?: number
  rtt?: number
}

function useSlowConnection() {
  const [isSlow, setIsSlow] = useState(false)

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
    if (!connection) return

    const updateConnection = () => {
      const speedKbps = connection.downlink !== undefined ? connection.downlink * 1000 : 0
      const lowBandwidth = speedKbps > 0 && speedKbps < 60
      setIsSlow(lowBandwidth)
    }

    updateConnection()
    connection.addEventListener("change", updateConnection)
    return () => connection.removeEventListener("change", updateConnection)
  }, [])

  return isSlow
}

export function NetworkStatusGate({ children }: { children: React.ReactNode }) {
  const isOffline = useOffline()
  const isSlow = useSlowConnection()

  if (isOffline) {
    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-background">
        <NetworkStatusScreen status="offline" />
      </div>
    )
  }

  return (
    <>
      {isSlow ? (
        <div
          role="status"
          className="fixed left-1/2 top-20 z-[60] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full border border-amber-300/50 bg-transparent px-4 py-2 text-center text-sm text-amber-100 xl:top-4"
        >
          Slow internet connection.{" "}
          <Link
            href="/slow-internet"
            className="font-semibold text-amber-200 underline decoration-amber-200/50 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
          >
            View tips
          </Link>
        </div>
      ) : null}
      {children}
    </>
  )
}
