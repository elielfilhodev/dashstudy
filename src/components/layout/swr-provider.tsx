"use client"

import { SWRConfig } from "swr"

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Fetch error")
    return r.json().then((j) => j.data ?? j)
  })

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        dedupingInterval: 5000,    // deduplica chamadas idênticas em 5s
        revalidateOnFocus: false,  // não revalida ao focar janela (reduz requests)
        revalidateOnReconnect: true,
        errorRetryCount: 2,
        keepPreviousData: true,    // mantém dados antigos durante revalidação (sem flash)
      }}
    >
      {children}
    </SWRConfig>
  )
}
