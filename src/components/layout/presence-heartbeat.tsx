"use client"

import { useEffect } from "react"

const INTERVAL_MS = 2 * 60 * 1000 // 2 minutos

/**
 * Envia POST /api/presence periodicamente para manter o usuário marcado como online.
 * Monta uma única vez no layout autenticado.
 * Pula o ping quando o documento está oculto (aba em background) para evitar
 * requests desnecessários.
 */
export function PresenceHeartbeat() {
  useEffect(() => {
    async function ping() {
      if (document.hidden) return
      try {
        await fetch("/api/presence", { method: "POST" })
      } catch {
        // silencioso — presença é best-effort
      }
    }

    ping()
    const timer = setInterval(ping, INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  return null
}
