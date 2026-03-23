"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Flame,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MoonStar,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  Library,
  Target,
  UserRound,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useTheme } from "@/components/layout/theme-provider"
import { cn } from "@/lib/utils"
import { levelFromXp, rankFromLevel } from "@/lib/gamification"
import { Badge } from "@/components/ui/badge"
import useSWR from "swr"
import type { Gamification } from "@/types"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/materias", label: "Matérias", icon: BookOpen },
  { href: "/agenda", label: "Agenda", icon: CalendarClock },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/atividades", label: "Atividades", icon: CheckCircle2 },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/livraria", label: "Livraria", icon: Library },
  { href: "/perfil", label: "Perfil", icon: UserRound },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { theme, toggle: toggleTheme } = useTheme()
  const { data: session } = useSession()
  // Usa o fetcher global do SWRProvider (já faz unwrap de .data e trata erros)
  const { data: gamification } = useSWR<Gamification>(
    session ? "/api/gamification" : null,
    { refreshInterval: 0 }
  )
  const xp = gamification?.xp ?? 0
  const streakDays = gamification?.streakDays ?? 0
  const levelInfo = levelFromXp(xp)
  const rank = rankFromLevel(levelInfo.level)
  const streakActive = streakDays > 0

  const user = session?.user
  const displayName = user?.name ?? "Usuário"
  const avatarFallback = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <aside
      className={cn(
        "h-full flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className={cn("flex items-center border-b border-border px-3 py-4", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <span className="font-semibold text-sm tracking-tight">Dash Estudos</span>
        )}
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={onToggle}>
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <Separator />

      {/* Footer */}
      <div className={cn("flex flex-col gap-2 p-2", collapsed && "items-center")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className={cn("w-full text-muted-foreground", collapsed && "size-8")}
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <MoonStar className="size-4" />}
          {!collapsed && (
            <span className="ml-2">{theme === "dark" ? "Claro" : "Escuro"}</span>
          )}
        </Button>

        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className={cn("w-full text-muted-foreground", collapsed && "size-8")}
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="size-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>

        {!collapsed && (
          <div className="flex items-center gap-2 px-1 py-1 mt-1">
            <Avatar className="size-8 shrink-0">
              {user?.image ? (
                <AvatarImage src={user.image} alt={displayName} />
              ) : null}
              <AvatarFallback className="text-xs">{avatarFallback}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-xs font-medium truncate">
                {displayName}
                {streakActive && <Flame className="size-3 text-orange-500 shrink-0" />}
              </p>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">
                  Lv {levelInfo.level}
                </span>
                <Badge className={cn("text-[9px] px-1 py-0 leading-tight", rank.className)}>
                  {rank.label}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
