"use client"

import { useState, useMemo } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  formatDate,
  weekRange,
  monthGrid,
  WEEK_DAYS_SHORT,
  MONTH_NAMES,
} from "@/lib/date-utils"
import type { AgendaItem } from "@/types"
import useSWR from "swr"
import { toast } from "sonner"

type SubjectRef = { id: string; name: string }
type Mode = "semana" | "mes"

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((j) => j.data)
const todayStr = formatDate(new Date())

const HOUR_SLOTS = Array.from({ length: 16 }, (_, i) => i + 7)

const emptyForm = {
  title: "",
  date: todayStr,
  time: "08:00",
  location: "",
  subjectId: "" as string | null,
  done: false,
}

export function AgendaView({
  initialItems,
  subjects,
}: {
  initialItems: AgendaItem[]
  subjects: SubjectRef[]
}) {
  const { data: items = initialItems, mutate: revalidate } = useSWR<AgendaItem[]>(
    "/api/agenda",
    fetcher,
    { fallbackData: initialItems }
  )

  const [mode, setMode] = useState<Mode>("semana")
  const [calDate, setCalDate] = useState(new Date())
  const [filterSubject, setFilterSubject] = useState<string>("all")
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const filteredItems = useMemo(

    () =>
      filterSubject === "all"
        ? items
        : items.filter((i) => i.subjectId === filterSubject),
    [items, filterSubject]
  )

  function itemsForDay(dateStr: string) {
    return filteredItems.filter((i) => i.date === dateStr)
  }

  function itemsForSlot(dateStr: string, hour: number) {
    return filteredItems.filter(
      (i) => i.date === dateStr && parseInt(i.time.split(":")[0]) === hour
    )
  }

  function openNewDialog(date?: string, time?: string) {
    setEditingId(null)
    setForm({ ...emptyForm, date: date ?? todayStr, time: time ?? "08:00" })
    setDialogOpen(true)
  }

  function openEditDialog(item: AgendaItem) {
    setEditingId(item.id)
    setForm({
      title: item.title,
      date: item.date,
      time: item.time,
      location: item.location,
      subjectId: item.subjectId,
      done: item.done,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const body = {
        title: form.title.trim(),
        date: form.date,
        time: form.time,
        location: form.location || "Não definido",
        subjectId: form.subjectId || null,
        ...(editingId ? { done: form.done } : {}),
      }

      if (editingId) {
        const prev = items.find((i) => i.id === editingId)
        await fetch(`/api/agenda/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (prev && form.done && !prev.done) {
          toast.success("Atividade concluída", {
            description: form.title.trim(),
          })
        }
      } else {
        await fetch("/api/agenda", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        toast.success("Compromisso adicionado", {
          description: `${form.title.trim()} · ${form.date} ${form.time}`,
        })
      }
      revalidate()
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/agenda/${id}`, { method: "DELETE" })
    revalidate()
  }

  function navigatePrev() {
    setCalDate((prev) => {
      const d = new Date(prev)
      if (mode === "semana") d.setDate(d.getDate() - 7)
      else d.setMonth(d.getMonth() - 1)
      return d
    })
  }

  function navigateNext() {
    setCalDate((prev) => {
      const d = new Date(prev)
      if (mode === "semana") d.setDate(d.getDate() + 7)
      else d.setMonth(d.getMonth() + 1)
      return d
    })
  }

  const weekDays = weekRange(calDate)
  const monthCells = monthGrid(calDate)

  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground text-sm">Seus compromissos e horários</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Matéria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-md border border-border overflow-hidden">
            {(["semana", "mes"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  mode === m
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-muted-foreground"
                )}
              >
                {m === "semana" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => openNewDialog()}>
            <Plus className="size-3.5 mr-1" /> Novo
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="size-8" onClick={navigatePrev}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium">
          {mode === "semana"
            ? `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${MONTH_NAMES[calDate.getMonth()]} ${calDate.getFullYear()}`
            : `${MONTH_NAMES[calDate.getMonth()]} ${calDate.getFullYear()}`}
        </span>
        <Button variant="ghost" size="icon" className="size-8" onClick={navigateNext}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Week view */}
      {mode === "semana" && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <div className="min-w-[640px]">
            {/* Day headers */}
            <div className="grid grid-cols-8 border-b border-border">
              <div className="p-2 text-xs text-muted-foreground" />
              {weekDays.map((day, i) => {
                const dayStr = formatDate(day)
                const isToday = dayStr === todayStr
                return (
                  <div
                    key={i}
                    className={cn(
                      "p-2 text-center border-l border-border cursor-pointer hover:bg-accent/50 transition-colors",
                      isToday && "bg-primary/5"
                    )}
                    onClick={() => openNewDialog(dayStr)}
                  >
                    <p className="text-[10px] text-muted-foreground uppercase">{WEEK_DAYS_SHORT[i]}</p>
                    <p className={cn("text-sm font-semibold", isToday && "text-primary")}>{day.getDate()}</p>
                  </div>
                )
              })}
            </div>
            {/* Hour rows */}
            {HOUR_SLOTS.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-border last:border-b-0 min-h-12">
                <div className="p-2 text-[10px] text-muted-foreground text-right pr-3 pt-2 border-r border-border">
                  {String(hour).padStart(2, "0")}:00
                </div>
                {weekDays.map((day, di) => {
                  const dayStr = formatDate(day)
                  const slotItems = itemsForSlot(dayStr, hour)
                  return (
                    <div
                      key={di}
                      className="border-l border-border p-1 cursor-pointer hover:bg-accent/30 transition-colors group"
                      onClick={() => openNewDialog(dayStr, `${String(hour).padStart(2, "0")}:00`)}
                    >
                      {slotItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={(ev) => { ev.stopPropagation(); openEditDialog(item) }}
                          className={cn(
                            "text-[10px] rounded px-1.5 py-0.5 mb-0.5 truncate cursor-pointer",
                            "font-medium leading-tight",
                            item.done
                              ? "bg-green-500/20 text-green-700 dark:text-green-400"
                              : item.date < todayStr
                              ? "bg-red-500/20 text-red-700 dark:text-red-400"
                              : "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
                          )}
                        >
                          {item.title}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Month view */}
      {mode === "mes" && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {WEEK_DAYS_SHORT.map((d) => (
              <div key={d} className="p-2 text-[10px] font-medium text-muted-foreground text-center uppercase">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((day, i) => {
              const dayStr = formatDate(day)
              const isCurrentMonth = day.getMonth() === calDate.getMonth()
              const isToday = dayStr === todayStr
              const dayItems = itemsForDay(dayStr)
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-20 p-1 border-b border-r border-border cursor-pointer",
                    "hover:bg-accent/30 transition-colors",
                    !isCurrentMonth && "opacity-40",
                    isToday && "bg-primary/5"
                  )}
                  onClick={() => openNewDialog(dayStr)}
                >
                  <p className={cn("text-xs font-medium mb-1", isToday && "text-primary")}>{day.getDate()}</p>
                  {dayItems.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      onClick={(e) => { e.stopPropagation(); openEditDialog(item) }}
                      className={cn(
                        "text-[9px] rounded px-1 py-0.5 mb-0.5 truncate font-medium cursor-pointer",
                        item.done
                          ? "bg-green-500/20 text-green-700 dark:text-green-400"
                          : item.date < todayStr
                          ? "bg-red-500/20 text-red-700 dark:text-red-400"
                          : "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
                      )}
                    >
                      {item.time} {item.title}
                    </div>
                  ))}
                  {dayItems.length > 3 && (
                    <p className="text-[9px] text-muted-foreground">+{dayItems.length - 3} mais</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar compromisso" : "Novo compromisso"}</DialogTitle>
            <DialogDescription className="text-xs">
              {editingId ? "Atualize os dados do compromisso" : "Adicione um novo compromisso na agenda"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Título</Label>
              <Input
                placeholder="Ex: Revisão de álgebra"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hora</Label>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Local</Label>
              <Input
                placeholder="Ex: Biblioteca"
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Matéria</Label>
              <Select
                value={form.subjectId ?? "none"}
                onValueChange={(v) => setForm((p) => ({ ...p, subjectId: v === "none" ? null : v }))}
              >
                <SelectTrigger className="text-xs">
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
            {editingId && (
              <div className="flex items-center gap-2">
                <input
                  id="done-check"
                  type="checkbox"
                  checked={form.done}
                  onChange={(e) => setForm((p) => ({ ...p, done: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="done-check" className="text-xs cursor-pointer">Marcar como concluído</Label>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 flex-row justify-end">
            {editingId && (
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await handleDelete(editingId)
                  setDialogOpen(false)
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {editingId ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
