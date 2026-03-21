"use client"

import { useEffect } from "react"

const INTERVAL_MS = 2 * 60 * 1000 // 2 minutes

/**
 * Sends a POST /api/presence heartbeat to keep the user marked as online.
 * Should be mounted once inside the authenticated layout.
 */
export function PresenceHeartbeat() {
  useEffect(() => {
    async function ping() {
      try {
        await fetch("/api/presence", { method: "POST" })
      } catch {
        // silent — presence is best-effort
      }
    }

    ping() // immediate on mount
    const timer = setInterval(ping, INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  return null
}
