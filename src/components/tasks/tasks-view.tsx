"use client"

import { useState, useMemo } from "react"
import { CheckCircle2, Circle, Clock, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/date-utils"
import { ACHIEVEMENTS } from "@/lib/gamification"
import type { Task } from "@/types"
import useSWR from "swr"
import { toast } from "sonner"

type SubjectRef = { id: string; name: string }

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((j) => j.data)
const todayStr = formatDate(new Date())

function taskStatus(task: Task): "done" | "overdue" | "pending" {
  if (task.done) return "done"
  if (task.dueDate < todayStr) return "overdue"
  return "pending"
}

const STATUS_LABEL: Record<string, string> = {
  done: "Concluída",
  pending: "Pendente",
  overdue: "Atrasada",
}

const emptyForm = { title: "", details: "", dueDate: todayStr, scheduledTime: "", subjectId: "" as string | null }

export function TasksView({
  initialTasks,
  subjects,
}: {
  initialTasks: Task[]
  subjects: SubjectRef[]
}) {
  const { data: tasks = initialTasks, mutate: revalidate } = useSWR<Task[]>(
    "/api/tasks",
    fetcher,
    { fallbackData: initialTasks }
  )

  const [form, setForm] = useState(emptyForm)
  const [filterSubject, setFilterSubject] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    let list = [...tasks]
    if (filterSubject !== "all") list = list.filter((t) => t.subjectId === filterSubject)
    if (filterStatus !== "all") list = list.filter((t) => taskStatus(t) === filterStatus)
    return list
  }, [tasks, filterSubject, filterStatus])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.dueDate) return
    setSaving(true)
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          details: form.details,
          dueDate: form.dueDate,
          scheduledTime: form.scheduledTime || null,
          subjectId: form.subjectId || null,
        }),
      })
      toast.success("Tarefa criada", { description: form.title.trim() })
      setForm(emptyForm)
      revalidate()
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(task: Task) {
    const willComplete = !task.done

    if (willComplete) {
      // XP must be awarded BEFORE marking done — API checks task.done to prevent double rewards
      const gamRes = await fetch("/api/gamification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      })
      const gamJson = await gamRes.json()
      const payload = gamJson.data as
        | { skipped?: boolean; reward?: { xpEarned: number; leveledUp: boolean; newLevel: number }; newAchievementKeys?: string[] }
        | undefined

      if (payload && !payload.skipped) {
        toast.success("Tarefa concluída", {
          description: task.title,
        })
        if (payload.reward?.xpEarned != null && payload.reward.xpEarned > 0) {
          toast.message(`+${payload.reward.xpEarned} XP`, {
            id: `xp-${task.id}-${Date.now()}`,
          })
        }
        if (payload.reward?.leveledUp) {
          toast.success("Subiu de nível!", {
            description: `Agora você é nível ${payload.reward.newLevel}.`,
          })
        }
        const keys = payload.newAchievementKeys ?? []
        for (const key of keys) {
          const meta = ACHIEVEMENTS[key]
          toast.success(meta?.label ?? "Nova conquista", {
            description: meta?.description ?? key,
            duration: 6000,
          })
        }
      }
    }

    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: willComplete }),
    })

    revalidate()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" })
    revalidate()
  }

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Atividades</h1>
        <p className="text-muted-foreground text-sm">Tarefas, exercícios e atividades de estudo</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plus className="size-4" /> Nova atividade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <Label htmlFor="task-title" className="text-xs">Título</Label>
                <Input
                  id="task-title"
                  placeholder="Ex: Lista de exercícios"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  required
                />
              </div>
              <div className="w-full sm:w-40 space-y-1">
                <Label htmlFor="task-due" className="text-xs">Prazo</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                  required
                />
              </div>
              <div className="w-full sm:w-32 space-y-1">
                <Label htmlFor="task-time" className="text-xs">Horário (opcional)</Label>
                <Input
                  id="task-time"
                  type="time"
                  value={form.scheduledTime}
                  onChange={(e) => setForm((p) => ({ ...p, scheduledTime: e.target.value }))}
                />
              </div>
              <div className="w-full sm:w-36 space-y-1">
                <Label className="text-xs">Matéria</Label>
                <Select
                  value={form.subjectId ?? "none"}
                  onValueChange={(v) => setForm((p) => ({ ...p, subjectId: v === "none" ? null : v }))}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geral</SelectItem>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="task-details" className="text-xs">Detalhes (opcional)</Label>
              <Textarea
                id="task-details"
                placeholder="Descreva o que precisa ser feito..."
                rows={2}
                value={form.details}
                onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))}
                className="text-sm resize-none"
              />
            </div>
            <Button type="submit" disabled={saving}>Adicionar</Button>
          </form>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Matéria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as matérias</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="overdue">Atrasadas</SelectItem>
            <SelectItem value="done">Concluídas</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground self-center ml-auto">
          {filtered.length} tarefa{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Tasks list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <CheckCircle2 className="size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nenhuma atividade encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const status = taskStatus(task)
            return (
              <div
                key={task.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-border p-3 group transition-colors",
                  task.done && "opacity-60"
                )}
              >
                <button
                  onClick={() => handleToggle(task)}
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {task.done ? (
                    <CheckCircle2 className="size-5 text-green-500" />
                  ) : (
                    <Circle className="size-5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm font-medium", task.done && "line-through")}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          status === "done" && "border-green-500 text-green-600",
                          status === "overdue" && "border-red-500 text-red-600",
                          status === "pending" && "border-yellow-500 text-yellow-600"
                        )}
                      >
                        {STATUS_LABEL[status]}
                      </Badge>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  {task.details && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.details}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {task.subject && (
                      <span className="text-[10px] bg-muted rounded px-1.5 py-0.5">{task.subject.name}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">Prazo: {task.dueDate}</span>
                    {task.scheduledTime && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="size-2.5" />{task.scheduledTime}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
