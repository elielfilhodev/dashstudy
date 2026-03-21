"use client"

import { useState } from "react"
import { BookOpen, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Subject } from "@/types"
import useSWR from "swr"
import { toast } from "sonner"

const SUBJECT_COLORS = [
  "#18181b", "#dc2626", "#2563eb", "#16a34a",
  "#ca8a04", "#7c3aed", "#db2777", "#0891b2",
]

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((j) => j.data)

export function SubjectsView({ initialSubjects }: { initialSubjects: Subject[] }) {
  const { data: subjects = initialSubjects, mutate: revalidate } = useSWR<Subject[]>(
    "/api/subjects",
    fetcher,
    { fallbackData: initialSubjects }
  )

  const [form, setForm] = useState({ name: "", workload: "", color: SUBJECT_COLORS[0] })
  const [saving, setSaving] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.workload) return
    setSaving(true)
    try {
      await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          workload: Number(form.workload),
          color: form.color,
        }),
      })
      toast.success("Matéria adicionada", { description: form.name.trim() })
      setForm({ name: "", workload: "", color: SUBJECT_COLORS[0] })
      revalidate()
    } finally {
      setSaving(false)
    }
  }

  async function handleProgressChange(id: string, progress: number, previousProgress: number) {
    await fetch(`/api/subjects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress }),
    })
    revalidate()
    if (progress >= 100 && previousProgress < 100) {
      const s = subjects.find((x) => x.id === id)
      toast.success("Matéria completa!", {
        description: s ? `${s.name} — 100% de progresso.` : "100% de progresso.",
        duration: 5500,
      })
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/subjects/${id}`, { method: "DELETE" })
    revalidate()
  }

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Matérias</h1>
        <p className="text-muted-foreground text-sm">Gerencie suas matérias e acompanhe o progresso</p>
      </div>

      {/* Add form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plus className="size-4" /> Nova matéria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="subject-name" className="text-xs">Nome</Label>
              <Input
                id="subject-name"
                placeholder="Ex: Matemática"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="w-full sm:w-32 space-y-1">
              <Label htmlFor="subject-workload" className="text-xs">Carga (h/sem)</Label>
              <Input
                id="subject-workload"
                type="number"
                min={1}
                max={200}
                placeholder="10"
                value={form.workload}
                onChange={(e) => setForm((p) => ({ ...p, workload: e.target.value }))}
                required
              />
            </div>
            <div className="w-full sm:w-20 space-y-1">
              <Label className="text-xs">Cor</Label>
              <div className="flex flex-wrap gap-1 pt-1">
                {SUBJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`size-5 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ background: c }}
                    onClick={() => setForm((p) => ({ ...p, color: c }))}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                Adicionar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      {subjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <BookOpen className="size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nenhuma matéria cadastrada ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((subject) => (
            <Card key={subject.id} className="group relative overflow-hidden">
              <div
                className="absolute top-0 left-0 w-1 h-full"
                style={{ background: subject.color }}
              />
              <CardHeader className="pb-2 pl-6">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-semibold">{subject.name}</CardTitle>
                  <button
                    onClick={() => handleDelete(subject.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <CardDescription className="text-xs">{subject.workload}h / semana</CardDescription>
              </CardHeader>
              <CardContent className="pl-6 space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progresso</span>
                    <Badge variant={subject.progress === 100 ? "default" : "secondary"} className="text-xs px-1.5">
                      {subject.progress}%
                    </Badge>
                  </div>
                  <Progress value={subject.progress} className="h-1.5" />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={subject.progress}
                  onChange={(e) =>
                    handleProgressChange(subject.id, Number(e.target.value), subject.progress)
                  }
                  className="w-full accent-foreground cursor-pointer"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
