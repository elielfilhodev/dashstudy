"use client"

import { useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Eye, EyeOff, Camera, AtSign, Lock, KeyRound, Loader2, CheckCircle2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Props {
  user: {
    name: string
    email: string
    image: string | null
    username: string | null
    provider: string
  }
}

export function SettingsView({ user }: Props) {
  const { update: updateSession } = useSession()
  const isCredentialUser = user.provider === "email"

  // --- Username ---
  const [username, setUsername] = useState(user.username ?? "")
  const [usernameLoading, setUsernameLoading] = useState(false)

  // --- Avatar ---
  const [avatarUrl, setAvatarUrl] = useState(user.image ?? "")
  const [avatarPreview, setAvatarPreview] = useState(user.image ?? "")
  const [avatarLoading, setAvatarLoading] = useState(false)

  // --- Change password ---
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPwd, setShowCurrentPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  // --- Forgot password ---
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  const avatarFallback = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  async function handleUsernameSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || username === user.username) return
    setUsernameLoading(true)
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "username", username: username.trim().toLowerCase() }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Erro ao atualizar username")
        return
      }
      toast.success("Username atualizado com sucesso!")
      await updateSession()
    } catch {
      toast.error("Erro de conexão")
    } finally {
      setUsernameLoading(false)
    }
  }

  async function handleAvatarSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!avatarUrl.trim()) return
    setAvatarLoading(true)
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "avatar", image: avatarUrl.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Erro ao atualizar avatar")
        return
      }
      setAvatarPreview(avatarUrl.trim())
      toast.success("Avatar atualizado com sucesso!")
      await updateSession()
    } catch {
      toast.error("Erro de conexão")
    } finally {
      setAvatarLoading(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não conferem")
      return
    }
    if (newPassword.length < 6) {
      toast.error("Nova senha deve ter pelo menos 6 caracteres")
      return
    }
    setPasswordLoading(true)
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Erro ao alterar senha")
        return
      }
      toast.success("Senha alterada com sucesso!")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch {
      toast.error("Erro de conexão")
    } finally {
      setPasswordLoading(false)
    }
  }

  async function handleForgotPassword() {
    setForgotLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Erro ao enviar e-mail")
        return
      }
      setForgotSent(true)
      toast.success("E-mail de recuperação enviado!")
      if (json.data?.devUrl) {
        toast.info(`[DEV] ${json.data.devUrl}`, { duration: 30000 })
      }
    } catch {
      toast.error("Erro de conexão")
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm">Gerencie seu perfil e segurança</p>
      </div>

      <Tabs defaultValue="perfil">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------------ */}
        {/* TAB: PERFIL                                                         */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="perfil" className="space-y-4 mt-4">
          {/* Avatar */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="size-4" /> Foto de perfil
              </CardTitle>
              <CardDescription>
                Cole a URL de uma imagem para usar como avatar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAvatarSubmit} className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="size-16 shrink-0">
                    {avatarPreview ? (
                      <AvatarImage src={avatarPreview} alt={user.name} />
                    ) : null}
                    <AvatarFallback className="text-lg">{avatarFallback}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="avatar-url">URL da imagem</Label>
                    <Input
                      id="avatar-url"
                      type="url"
                      placeholder="https://exemplo.com/foto.jpg"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={avatarLoading || !avatarUrl.trim() || avatarUrl === user.image}
                >
                  {avatarLoading ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : null}
                  Salvar avatar
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Username */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AtSign className="size-4" /> Username
              </CardTitle>
              <CardDescription>
                Seu identificador único. Somente letras minúsculas, números, <code>.</code> e <code>_</code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUsernameSubmit} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      @
                    </span>
                    <Input
                      id="username"
                      className="pl-7"
                      placeholder="seu_username"
                      value={username}
                      onChange={(e) =>
                        setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))
                      }
                      minLength={3}
                      maxLength={30}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {username.length}/30 caracteres
                  </p>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    usernameLoading ||
                    !username.trim() ||
                    username === user.username ||
                    username.length < 3
                  }
                >
                  {usernameLoading ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : null}
                  Salvar username
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* TAB: SEGURANÇA                                                      */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="seguranca" className="space-y-4 mt-4">
          {isCredentialUser ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="size-4" /> Alterar senha
                </CardTitle>
                <CardDescription>
                  Requer a senha atual para confirmar a alteração
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Senha atual</Label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showCurrentPwd ? "text" : "password"}
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPwd((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showCurrentPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova senha</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPwd ? "text" : "password"}
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPwd((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPwd ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPwd((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-destructive">As senhas não conferem</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      passwordLoading ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmPassword ||
                      newPassword !== confirmPassword
                    }
                  >
                    {passwordLoading ? (
                      <Loader2 className="size-4 animate-spin mr-2" />
                    ) : null}
                    Alterar senha
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Sua conta usa login via <strong>GitHub</strong>. A senha é gerenciada pelo provedor de
                  autenticação externo.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Forgot password */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="size-4" /> Esqueceu sua senha?
              </CardTitle>
              <CardDescription>
                Enviaremos um link de recuperação para <strong>{user.email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {forgotSent ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>
                    E-mail de recuperação enviado! Verifique sua caixa de entrada.
                  </span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleForgotPassword}
                  disabled={forgotLoading || !isCredentialUser}
                >
                  {forgotLoading ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : null}
                  Enviar e-mail de recuperação
                </Button>
              )}
              {!isCredentialUser && (
                <p className="text-xs text-muted-foreground mt-2">
                  Disponível apenas para contas com senha cadastrada.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
