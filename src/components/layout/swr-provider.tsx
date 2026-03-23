"use client"

import { SWRConfig } from "swr"

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Fetch error")
    return r.json().then((j: { data?: unknown }) => j.data ?? j)
  })

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        dedupingInterval: 10_000,       // 10s — evita disparar a mesma key duas vezes em rajada
        revalidateOnFocus: false,        // não revalida ao focar janela
        revalidateOnReconnect: true,     // revalida ao recuperar conexão
        focusThrottleInterval: 15_000,   // limita revalidações de foco a no máx 1 a cada 15s
        errorRetryCount: 2,              // máximo 2 tentativas em caso de erro
        errorRetryInterval: 3_000,
        keepPreviousData: true,          // sem flash de "loading" durante revalidação
      }}
    >
      {children}
    </SWRConfig>
  )
}
