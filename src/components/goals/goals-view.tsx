"use client"

import { useState } from "react"
import { Plus, Target, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import type { Goal } from "@/types"
import useSWR from "swr"
import { toast } from "sonner"

export function GoalsView({ initialGoals }: { initialGoals: Goal[] }) {
  const { data: goals = initialGoals, mutate: revalidate } = useSWR<Goal[]>(
    "/api/goals",
    { fallbackData: initialGoals }
  )

  const [form, setForm] = useState({ title: "", target: "" })
  const [saving, setSaving] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.target) return
    setSaving(true)
    try {
      await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title.trim(), target: Number(form.target) }),
      })
      toast.success("Meta criada", { description: form.title.trim() })
      setForm({ title: "", target: "" })
      revalidate()
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateProgress(id: string, done: number) {
    const goal = goals.find((g) => g.id === id)
    const prev = goal?.done ?? 0
    const target = goal?.target ?? 0
    const capped = Math.max(0, Math.min(done, target))

    await fetch(`/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: capped }),
    })
    revalidate()

    if (goal && capped >= target && prev < target) {
      toast.success("Meta atingida!", {
        description: goal.title,
        duration: 6000,
      })
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/goals/${id}`, { method: "DELETE" })
    revalidate()
  }

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Metas</h1>
        <p className="text-muted-foreground text-sm">Defina e acompanhe suas metas de estudo</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plus className="size-4" /> Nova meta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="goal-title" className="text-xs">Título</Label>
              <Input
                id="goal-title"
                placeholder="Ex: Questões resolvidas"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                required
              />
            </div>
            <div className="w-full sm:w-32 space-y-1">
              <Label htmlFor="goal-target" className="text-xs">Meta</Label>
              <Input
                id="goal-target"
                type="number"
                min={1}
                placeholder="100"
                value={form.target}
                onChange={(e) => setForm((p) => ({ ...p, target: e.target.value }))}
                required
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                Adicionar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <Target className="size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nenhuma meta cadastrada ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const pct = Math.min(Math.round((goal.done / goal.target) * 100), 100)
            const completed = goal.done >= goal.target
            return (
              <Card key={goal.id} className="group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold leading-snug">{goal.title}</CardTitle>
                    <div className="flex items-center gap-1 shrink-0">
                      {completed && <Badge className="text-xs bg-green-500 text-white">Concluída</Badge>}
                      <button
                        onClick={() => handleDelete(goal.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <CardDescription className="text-xs">
                    {goal.done} / {goal.target} — {pct}%
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress value={pct} className="h-2" />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={goal.done <= 0}
                      onClick={() => handleUpdateProgress(goal.id, Math.max(0, goal.done - 1))}
                    >
                      −
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      max={goal.target}
                      value={goal.done}
                      onChange={(e) =>
                        handleUpdateProgress(goal.id, Math.min(Number(e.target.value), goal.target))
                      }
                      className="h-7 text-center text-xs w-16"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={goal.done >= goal.target}
                      onClick={() => handleUpdateProgress(goal.id, Math.min(goal.target, goal.done + 1))}
                    >
                      +
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
