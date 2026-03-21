export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function todayKey(): string {
  return formatDate(new Date())
}

export function startOfWeek(baseDate: Date): Date {
  const date = new Date(baseDate)
  const day = date.getDay() === 0 ? 7 : date.getDay()
  date.setDate(date.getDate() - (day - 1))
  date.setHours(0, 0, 0, 0)
  return date
}

export function weekRange(baseDate: Date): Date[] {
  const start = startOfWeek(baseDate)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function monthGrid(baseDate: Date): Date[] {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0)
  const firstDay = start.getDay() === 0 ? 7 : start.getDay()
  const cells: Date[] = []

  for (let i = firstDay - 1; i > 0; i--) {
    const d = new Date(start)
    d.setDate(start.getDate() - i)
    cells.push(d)
  }
  for (let d = 1; d <= end.getDate(); d++) {
    cells.push(new Date(baseDate.getFullYear(), baseDate.getMonth(), d))
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]
    const d = new Date(last)
    d.setDate(last.getDate() + 1)
    cells.push(d)
  }
  return cells
}

export function parseDateTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00`)
}

export const WEEK_DAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]
