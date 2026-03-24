"use client"

import useSWR from "swr"
import type { RankKey } from "@/types"

// 5 intensity levels (0 = empty, 1–4 = activity)
const RANK_PALETTES: Record<RankKey, [string, string, string, string, string]> = {
  bronze:       ["var(--color-cell-empty)", "#7c3517", "#b84a1a", "#e05a1c", "#f97316"],
  prata:        ["var(--color-cell-empty)", "#3f3f46", "#71717a", "#a1a1aa", "#d4d4d8"],
  ouro:         ["var(--color-cell-empty)", "#713f12", "#a16207", "#ca8a04", "#eab308"],
  platina:      ["var(--color-cell-empty)", "#3b0764", "#6d28d9", "#7c3aed", "#8b5cf6"],
  esmeralda:    ["var(--color-cell-empty)", "#064e3b", "#065f46", "#059669", "#10b981"],
  diamante:     ["var(--color-cell-empty)", "#0c4a6e", "#0369a1", "#0284c7", "#0ea5e9"],
  mestre:       ["var(--color-cell-empty)", "#7f1d1d", "#991b1b", "#dc2626", "#ef4444"],
  "grao-mestre":["var(--color-cell-empty)", "#3b0764", "#7e22ce", "#9333ea", "#a855f7"],
  genio:        ["var(--color-cell-empty)", "#4a044e", "#be185d", "#db2777", "#f472b6"],
}

function countToLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 6) return 3
  return 4
}

/** Build a 53-week × 7-day grid starting from exactly 52 weeks ago (Sunday) */
function buildGrid(counts: Record<string, number>) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Start on the most recent Sunday >= 52 weeks back
  const start = new Date(today)
  start.setDate(start.getDate() - 364 - start.getDay()) // go back 364 days then snap to Sunday

  const weeks: { date: Date; count: number }[][] = []
  const cursor = new Date(start)

  while (cursor <= today) {
    const week: { date: Date; count: number }[] = []
    for (let d = 0; d < 7; d++) {
      const key = cursor.toISOString().split("T")[0]
      const isFuture = cursor > today
      week.push({ date: new Date(cursor), count: isFuture ? -1 : (counts[key] ?? 0) })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

interface Props {
  rankKey: RankKey
}

export function ActivityHeatmap({ rankKey }: Props) {
  const { data: counts = {} } = useSWR<Record<string, number>>(
    "/api/profile/activity",
    { refreshInterval: 0 }
  )

  const palette = RANK_PALETTES[rankKey] ?? RANK_PALETTES.bronze
  const weeks = buildGrid(counts)

  const totalActivity = Object.values(counts).reduce((a, b) => a + b, 0)

  // Find month label positions (first week of each month)
  const monthLabels: { weekIdx: number; label: string }[] = []
  let lastMonth = -1
  weeks.forEach((week, i) => {
    const month = week[0].date.getMonth()
    if (month !== lastMonth) {
      monthLabels.push({ weekIdx: i, label: MONTH_NAMES[month] })
      lastMonth = month
    }
  })

  const cellSize = 12
  const cellGap = 3
  const labelWidth = 28
  const totalWidth = labelWidth + weeks.length * (cellSize + cellGap)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{totalActivity} tarefas concluídas no último ano</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card p-4">
        <div style={{ minWidth: totalWidth }}>
          {/* Month labels */}
          <div className="flex mb-1" style={{ paddingLeft: labelWidth }}>
            {weeks.map((week, i) => {
              const label = monthLabels.find((m) => m.weekIdx === i)
              return (
                <div
                  key={i}
                  className="text-[9px] text-muted-foreground shrink-0"
                  style={{ width: cellSize + cellGap }}
                >
                  {label?.label ?? ""}
                </div>
              )
            })}
          </div>

          {/* Grid rows (7 days) */}
          {[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => (
            <div key={dayOfWeek} className="flex items-center" style={{ marginBottom: cellGap }}>
              {/* Day label — only show Mon, Wed, Fri (indices 1, 3, 5) */}
              <div
                className="text-[9px] text-muted-foreground shrink-0 text-right pr-1.5"
                style={{ width: labelWidth }}
              >
                {[1, 3, 5].includes(dayOfWeek) ? DAY_LABELS[dayOfWeek] : ""}
              </div>

              {/* Cells */}
              {weeks.map((week, wi) => {
                const cell = week[dayOfWeek]
                if (!cell) return <div key={wi} style={{ width: cellSize + cellGap }} />

                const level = cell.count < 0 ? 0 : countToLevel(cell.count)
                const color = cell.count < 0
                  ? "transparent"
                  : level === 0
                    ? "hsl(var(--muted))"
                    : palette[level]

                const label = cell.date.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
                const tooltip = cell.count <= 0
                  ? `Nenhuma atividade em ${label}`
                  : `${cell.count} tarefa${cell.count > 1 ? "s" : ""} em ${label}`

                return (
                  <div
                    key={wi}
                    title={tooltip}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      marginRight: cellGap,
                      backgroundColor: color,
                      borderRadius: 3,
                      flexShrink: 0,
                      cursor: "default",
                      transition: "opacity 150ms",
                    }}
                    className="hover:opacity-75"
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-3 justify-end">
          <span className="text-[9px] text-muted-foreground">Menos</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              style={{
                width: cellSize,
                height: cellSize,
                borderRadius: 3,
                backgroundColor: level === 0 ? "hsl(var(--muted))" : palette[level as 0|1|2|3|4],
              }}
            />
          ))}
          <span className="text-[9px] text-muted-foreground">Mais</span>
        </div>
      </div>
    </div>
  )
}
