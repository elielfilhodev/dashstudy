"use client"

import { useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { PresenceHeartbeat } from "@/components/layout/presence-heartbeat"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <PresenceHeartbeat />

      {/* Sidebar — desktop only */}
      <div className="hidden md:flex flex-col shrink-0">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>

      {/* Main content — extra bottom padding on mobile for the nav bar */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {children}
      </main>

      {/* Bottom nav — mobile only */}
      <MobileNav />
    </div>
  )
}
