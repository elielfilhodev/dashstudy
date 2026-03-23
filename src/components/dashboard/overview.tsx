"use client"

import { useMemo } from "react"
import { BookOpen, CalendarClock, CheckCircle2, Flame, Trophy } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { levelFromXp, rankFromLevel } from "@/lib/gamification"
import { todayKey } from "@/lib/date-utils"
import type { Subject, Task, AgendaItem, Gamification } from "@/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tomorrowKey(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

const CHART_PALETTE = ["#18181b", "#3f3f46", "#52525b", "#71717a", "#a1a1aa", "#d4d4d8"]

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
  iconClass?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {label}
        </CardDescription>
        <Icon className={cn("size-4 text-muted-foreground", iconClass)} />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Bar chart (SVG, no dependency)
// ---------------------------------------------------------------------------

function HorizontalBarChart({
  data,
}: {
  data: { label: string; value: number; max: number; color: string }[]
}) {
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="truncate max-w-[60%]">{item.label}</span>
            <span>{item.value}h / {item.max}h</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${item.max > 0 ? Math.min((item.value / item.max) * 100, 100) : 0}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pie chart (SVG)
// ---------------------------------------------------------------------------

function PieChart({
  slices,
}: {
  slices: { label: string; value: number; color: string }[]
}) {
  const total = slices.reduce((acc, s) => acc + s.value, 0)
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Sem dados
      </div>
    )
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180
  const cx = 50
  const cy = 50
  const r = 40

  type SlicePath = { d: string; color: string; label: string; value: number; pct: number }

  // Construção O(n) com push em vez de spread a cada iteração (spread seria O(n²))
  const paths: SlicePath[] = []
  let cumulative = -90
  for (const slice of slices.filter((s) => s.value > 0)) {
    const startAngle = cumulative
    const angle = (slice.value / total) * 360
    const endAngle = startAngle + angle

    const x1 = cx + r * Math.cos(toRad(startAngle))
    const y1 = cy + r * Math.sin(toRad(startAngle))
    const x2 = cx + r * Math.cos(toRad(endAngle))
    const y2 = cy + r * Math.sin(toRad(endAngle))
    const largeArc = angle > 180 ? 1 : 0

    paths.push({
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: slice.color,
      label: slice.label,
      value: slice.value,
      pct: Math.round((slice.value / total) * 100),
    })
    cumulative = endAngle
  }

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="size-28 shrink-0">
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} stroke="hsl(var(--background))" strokeWidth="1" />
        ))}
      </svg>
      <ul className="space-y-1.5">
        {paths.map((p, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className="inline-block size-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.label}</span>
            <span className="font-medium ml-auto pl-3">{p.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  subjects: Subject[]
  tasks: Task[]
  agendaItems: AgendaItem[]
  gamification: Gamification | null
}

export function DashboardOverview({ subjects, tasks, agendaItems, gamification }: Props) {
  const today = todayKey()
  const tomorrow = tomorrowKey()

  const xp = gamification?.xp ?? 0
  const streakDays = gamification?.streakDays ?? 0
  const levelInfo = levelFromXp(xp)
  const rank = rankFromLevel(levelInfo.level)

  const doneTasks = useMemo(() => tasks.filter((t) => t.done).length, [tasks])
  const pendingTasks = useMemo(() => tasks.filter((t) => !t.done).length, [tasks])
  const overdueTasks = useMemo(
    () => tasks.filter((t) => !t.done && t.dueDate < today).length,
    [tasks, today]
  )

  const alerts = useMemo(() => {
    const taskAlerts = tasks
      .filter((t) => !t.done && (t.dueDate === today || t.dueDate === tomorrow || t.dueDate < today))
      .map((t) => ({
        id: t.id,
        type: "task" as const,
        title: t.title,
        date: t.dueDate,
        overdue: t.dueDate < today,
      }))

    const agendaAlerts = agendaItems
      .filter((a) => !a.done && (a.date === today || a.date === tomorrow || a.date < today))
      .map((a) => ({
        id: a.id,
        type: "agenda" as const,
        title: a.title,
        date: `${a.date} ${a.time}`,
        overdue: a.date < today,
      }))

    return [...taskAlerts, ...agendaAlerts].sort((a, b) => a.date.localeCompare(b.date))
  }, [tasks, agendaItems, today, tomorrow])

  const barData = useMemo(
    () =>
      subjects.slice(0, 6).map((s, i) => ({
        label: s.name,
        value: Math.round((s.progress / 100) * s.workload),
        max: s.workload,
        color: CHART_PALETTE[i % CHART_PALETTE.length],
      })),
    [subjects]
  )

  const pieData = useMemo(
    () => [
      { label: "Concluídas", value: doneTasks, color: "#22c55e" },
      { label: "Pendentes", value: pendingTasks - overdueTasks, color: "#eab308" },
      { label: "Atrasadas", value: overdueTasks, color: "#ef4444" },
    ],
    [doneTasks, pendingTasks, overdueTasks]
  )

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral dos seus estudos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={BookOpen}
          label="Matérias"
          value={subjects.length}
          sub={`${subjects.filter((s) => s.progress === 100).length} concluídas`}
        />
        <StatCard
          icon={CheckCircle2}
          label="Tarefas concluídas"
          value={doneTasks}
          sub={`${pendingTasks} pendentes`}
        />
        <StatCard
          icon={CalendarClock}
          label="Agenda hoje"
          value={agendaItems.filter((a) => a.date === today).length}
          sub="compromissos"
        />
        <StatCard
          icon={Trophy}
          label="XP total"
          value={xp}
          sub={`Lv ${levelInfo.level} — ${rank.label}`}
          iconClass="text-yellow-500"
        />
      </div>

      {/* Level progress */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Nível {levelInfo.level}</CardTitle>
              <Badge className={cn("text-xs", rank.className)}>{rank.label}</Badge>
            </div>
            {streakDays > 0 && (
              <div className="flex items-center gap-1 text-orange-500 text-xs font-medium">
                <Flame className="size-3.5" />
                <span>{streakDays} {streakDays === 1 ? "dia" : "dias"}</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <Progress value={(levelInfo.currentXp / levelInfo.nextLevelXp) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {levelInfo.currentXp} / {levelInfo.nextLevelXp} XP
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              Pendências próximas
              {alerts.length > 0 && (
                <Badge variant="destructive" className="text-xs">{alerts.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma pendência no radar</p>
            ) : (
              <ul className="space-y-2">
                {alerts.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-1 size-2 rounded-full shrink-0",
                        a.overdue ? "bg-red-500" : "bg-yellow-500"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.type === "task" ? "Tarefa" : "Agenda"} · {a.date}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Task pie */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Status das tarefas</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart slices={pieData} />
          </CardContent>
        </Card>
      </div>

      {/* Subjects bar chart */}
      {subjects.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Dedicação por matéria</CardTitle>
            <CardDescription className="text-xs">Horas estudadas vs carga horária</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={barData} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
