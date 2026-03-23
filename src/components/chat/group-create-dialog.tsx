"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import type { ChatGroup } from "@/types"

interface Props {
  onCreated: (group: ChatGroup) => void
}

export function GroupCreateDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/chat/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      })
      if (!res.ok) {
        const j = await res.json()
        toast.error(j.error ?? "Erro ao criar grupo")
        return
      }
      const { data } = await res.json()
      toast.success(`Grupo "${data.name}" criado!`)
      onCreated(data)
      setOpen(false)
      setName("")
      setDescription("")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
          <Plus className="size-3.5" />
          Novo grupo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar grupo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Nome do grupo</Label>
            <Input
              id="group-name"
              placeholder="Ex: Estudo de Cálculo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-desc">Descrição (opcional)</Label>
            <Textarea
              id="group-desc"
              placeholder="Sobre o que é este grupo?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={300}
              className="resize-none text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              Criar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
