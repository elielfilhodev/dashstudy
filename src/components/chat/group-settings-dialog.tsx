"use client"

import { useState } from "react"
import { Crown, Settings, Shield, UserMinus, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { ChatGroup, ChatUser } from "@/types"

interface Props {
  group: ChatGroup
  meId: string
  friends: ChatUser[]
  onUpdated: (group: ChatGroup) => void
  onLeft: () => void
}

export function GroupSettingsDialog({ group, meId, friends, onUpdated, onLeft }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? "")
  const [saving, setSaving] = useState(false)
  const [addingId, setAddingId] = useState<string>("")

  const isAdmin = group.adminId === meId
  const isCoAdmin = group.coAdminId === meId
  const canManage = isAdmin || isCoAdmin

  const memberIds = new Set(group.members.map((m) => m.userId))
  const addableFriends = friends.filter((f) => !memberIds.has(f.id))

  function initials(name: string) {
    return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!isAdmin) return
    setSaving(true)
    try {
      const res = await fetch(`/api/chat/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      })
      if (!res.ok) { toast.error("Erro ao salvar"); return }
      const { data } = await res.json()
      toast.success("Grupo atualizado")
      onUpdated(data)
    } finally {
      setSaving(false)
    }
  }

  async function handleSetCoAdmin(userId: string | null) {
    if (!isAdmin) return
    const res = await fetch(`/api/chat/groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coAdminId: userId }),
    })
    if (!res.ok) { toast.error("Erro ao definir co-admin"); return }
    const { data } = await res.json()
    toast.success(userId ? "Co-admin definido" : "Co-admin removido")
    onUpdated(data)
  }

  async function handleAddMember() {
    if (!addingId) return
    const res = await fetch(`/api/chat/groups/${group.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: addingId }),
    })
    if (!res.ok) { const j = await res.json(); toast.error(j.error ?? "Erro"); return }
    toast.success("Membro adicionado")
    setAddingId("")
    // refresh group
    const gr = await fetch(`/api/chat/groups/${group.id}`).then((r) => r.json())
    onUpdated(gr.data)
  }

  async function handleRemoveMember(uid: string) {
    const res = await fetch(`/api/chat/groups/${group.id}/members/${uid}`, { method: "DELETE" })
    if (!res.ok) { const j = await res.json(); toast.error(j.error ?? "Erro"); return }
    if (uid === meId) {
      toast.success("Você saiu do grupo")
      onLeft()
      setOpen(false)
    } else {
      toast.success("Membro removido")
      const gr = await fetch(`/api/chat/groups/${group.id}`).then((r) => r.json())
      onUpdated(gr.data)
    }
  }

  async function handleDeleteGroup() {
    if (!isAdmin) return
    if (!confirm(`Tem certeza que deseja excluir o grupo "${group.name}"?`)) return
    const res = await fetch(`/api/chat/groups/${group.id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Erro ao excluir grupo"); return }
    toast.success("Grupo excluído")
    onLeft()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <Settings className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações do grupo</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Name & description — admin only */}
          {isAdmin && (
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="gname">Nome</Label>
                <Input
                  id="gname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gdesc">Descrição</Label>
                <Textarea
                  id="gdesc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  maxLength={300}
                  className="resize-none text-sm"
                />
              </div>
              <Button type="submit" size="sm" disabled={saving}>Salvar</Button>
            </form>
          )}

          <Separator />

          {/* Members list */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Membros ({group.members.length})</p>
            <div className="space-y-1.5">
              {group.members.map((m) => (
                <div key={m.userId} className="flex items-center gap-2 py-1">
                  <Avatar className="size-7 shrink-0">
                    {m.user.image && <AvatarImage src={m.user.image} />}
                    <AvatarFallback className="text-[10px]">{initials(m.user.name ?? "?")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{m.user.name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {m.userId === group.adminId && (
                      <Badge variant="outline" className="text-[9px] px-1 gap-0.5 border-yellow-500 text-yellow-600">
                        <Crown className="size-2.5" /> Admin
                      </Badge>
                    )}
                    {m.userId === group.coAdminId && (
                      <Badge variant="outline" className="text-[9px] px-1 gap-0.5 border-blue-500 text-blue-600">
                        <Shield className="size-2.5" /> Co-admin
                      </Badge>
                    )}
                    {/* Admin can toggle co-admin for others */}
                    {isAdmin && m.userId !== meId && m.userId !== group.adminId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("size-6", group.coAdminId === m.userId ? "text-blue-500" : "text-muted-foreground")}
                        title={group.coAdminId === m.userId ? "Remover co-admin" : "Tornar co-admin"}
                        onClick={() => handleSetCoAdmin(group.coAdminId === m.userId ? null : m.userId)}
                      >
                        <Shield className="size-3" />
                      </Button>
                    )}
                    {/* Can remove: admin removes anyone (except self), co-admin can't remove, member can leave self */}
                    {(isAdmin && m.userId !== meId) || (m.userId === meId && !isAdmin) ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-destructive"
                        title={m.userId === meId ? "Sair do grupo" : "Remover membro"}
                        onClick={() => handleRemoveMember(m.userId)}
                      >
                        <UserMinus className="size-3" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add member — admin or co-admin */}
          {canManage && addableFriends.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5"><UserPlus className="size-3.5" />Adicionar membro</p>
                <div className="flex gap-2">
                  <Select value={addingId} onValueChange={setAddingId}>
                    <SelectTrigger className="flex-1 text-xs h-8">
                      <SelectValue placeholder="Selecionar amigo" />
                    </SelectTrigger>
                    <SelectContent>
                      {addableFriends.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleAddMember} disabled={!addingId} className="h-8">
                    Adicionar
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Non-admin member: leave group */}
          {!isAdmin && (
            <>
              <Separator />
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive w-full"
                onClick={() => handleRemoveMember(meId)}
              >
                Sair do grupo
              </Button>
            </>
          )}

          {/* Admin: delete group */}
          {isAdmin && (
            <>
              <Separator />
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive w-full"
                onClick={handleDeleteGroup}
              >
                Excluir grupo
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
