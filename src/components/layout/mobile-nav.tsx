"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  LayoutDashboard,
  Library,
  Settings,
  Target,
  UserRound,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/materias", label: "Matérias", icon: BookOpen },
  { href: "/agenda", label: "Agenda", icon: CalendarClock },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/atividades", label: "Tarefas", icon: CheckCircle2 },
  { href: "/livraria", label: "Livros", icon: Library },
  { href: "/perfil", label: "Perfil", icon: UserRound },
  { href: "/configuracoes", label: "Config.", icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-0",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("size-5 shrink-0", active && "fill-primary/20")} />
              <span className="text-[9px] font-medium truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
