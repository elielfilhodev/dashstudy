"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import useSWR from "swr"
import { toast } from "sonner"
import { AlertTriangle, CalendarClock, CalendarDays, ListTodo } from "lucide-react"
import { formatDate } from "@/lib/date-utils"
import type { AgendaItem, Task } from "@/types"

function storageKey(kind: string, day: string) {
  return `dash-study-alert-${kind}-${day}`
}

function wasShown(kind: string, day: string) {
  if (typeof window === "undefined") return true
  return sessionStorage.getItem(storageKey(kind, day)) === "1"
}

function markShown(kind: string, day: string) {
  try {
    sessionStorage.setItem(storageKey(kind, day), "1")
  } catch {
    /* private mode */
  }
}

function tomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return formatDate(d)
}

/**
 * Lembretes no canto (uma vez por dia por tipo): tarefas atrasadas, prazo hoje, agenda.
 */
export function StudyAlerts() {
  const { status } = useSession()

  const { data: tasks } = useSWR<Task[]>(status === "authenticated" ? "/api/tasks" : null)
  const { data: agenda } = useSWR<AgendaItem[]>(
    status === "authenticated" ? "/api/agenda" : null
  )

  useEffect(() => {
    if (status !== "authenticated") return
    if (!tasks || !agenda) return

    const today = formatDate(new Date())
    const tmr = tomorrowStr()

    const overdueTasks = tasks.filter((t) => !t.done && t.dueDate < today)
    const dueTodayTasks = tasks.filter((t) => !t.done && t.dueDate === today)
    const overdueAgenda = agenda.filter((i) => !i.done && i.date < today)
    const agendaToday = agenda.filter((i) => !i.done && i.date === today)
    const agendaTomorrow = agenda.filter((i) => !i.done && i.date === tmr)

    let delay = 0
    const schedule = (fn: () => void) => {
      window.setTimeout(fn, delay)
      delay += 500
    }

    if (overdueTasks.length > 0 && !wasShown("tasks-overdue", today)) {
      markShown("tasks-overdue", today)
      schedule(() =>
        toast.warning("Tarefas em atraso", {
          id: "tasks-overdue",
          description:
            overdueTasks.length === 1
              ? `“${overdueTasks[0]!.title}” passou do prazo.`
              : `Você tem ${overdueTasks.length} tarefas com prazo vencido.`,
          icon: <AlertTriangle className="size-4" />,
          duration: 8000,
        })
      )
    }

    if (dueTodayTasks.length > 0 && !wasShown("tasks-due-today", today)) {
      markShown("tasks-due-today", today)
      schedule(() =>
        toast.info("Prazo hoje", {
          id: "tasks-due-today",
          description:
            dueTodayTasks.length === 1
              ? `“${dueTodayTasks[0]!.title}” vence hoje.`
              : `${dueTodayTasks.length} tarefas com prazo para hoje.`,
          icon: <ListTodo className="size-4" />,
          duration: 6500,
        })
      )
    }

    if (overdueAgenda.length > 0 && !wasShown("agenda-overdue", today)) {
      markShown("agenda-overdue", today)
      schedule(() =>
        toast.warning("Atividades da agenda atrasadas", {
          id: "agenda-overdue",
          description:
            overdueAgenda.length === 1
              ? `“${overdueAgenda[0]!.title}” em data passada.`
              : `${overdueAgenda.length} itens de agenda não concluídos em datas passadas.`,
          icon: <CalendarDays className="size-4" />,
          duration: 8000,
        })
      )
    }

    if (agendaToday.length > 0 && !wasShown("agenda-today", today)) {
      markShown("agenda-today", today)
      schedule(() =>
        toast.info("Agenda de hoje", {
          id: "agenda-today",
          description:
            agendaToday.length === 1
              ? `“${agendaToday[0]!.title}” às ${agendaToday[0]!.time}.`
              : `${agendaToday.length} compromissos hoje — confira a agenda.`,
          icon: <CalendarClock className="size-4" />,
          duration: 6500,
        })
      )
    }

    if (agendaTomorrow.length > 0 && !wasShown("agenda-tomorrow", today)) {
      markShown("agenda-tomorrow", today)
      schedule(() =>
        toast.message("Lembrete", {
          id: "agenda-tomorrow",
          description:
            agendaTomorrow.length === 1
              ? `Amanhã: “${agendaTomorrow[0]!.title}” às ${agendaTomorrow[0]!.time}.`
              : `Amanhã você tem ${agendaTomorrow.length} compromissos na agenda.`,
          icon: <CalendarClock className="size-4 text-muted-foreground" />,
          duration: 5500,
        })
      )
    }
  }, [status, tasks, agenda])

  return null
}
