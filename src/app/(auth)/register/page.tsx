"use client"

import { useState } from "react"
import { signIn } from "@/lib/session-client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Github, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ACADEMIC_LEVEL_LABELS, type AcademicLevel } from "@/lib/academic"

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    academicLevel: "GRADUACAO" as AcademicLevel,
    courseName: "",
    startDate: "",
    currentSemester: "1",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [githubLoading, setGithubLoading] = useState(false)

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  function handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
    // auto-lowercase and strip invalid chars
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "")
    setForm((prev) => ({ ...prev, username: value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (form.password !== form.confirmPassword) {
      setError("As senhas não conferem")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? "Erro ao criar conta")
        return
      }

      // A rota de registro já devolve a sessão pronta em cookie.
      router.push("/")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleGithubRegister() {
    setGithubLoading(true)
    await signIn("github", { callbackUrl: "/" })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Criar conta</CardTitle>
          <CardDescription>Comece a controlar seus estudos hoje</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGithubRegister}
            disabled={githubLoading}
          >
            {githubLoading ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <Github className="size-4 mr-2" />
            )}
            Registrar com GitHub
          </Button>

          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">ou</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleRegister} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                placeholder="Seu nome completo"
                value={form.name}
                onChange={update("name")}
                required
                minLength={2}
                autoComplete="name"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="username">
                Username
                <span className="text-[10px] text-muted-foreground ml-1">
                  (usado para adicionar amigos)
                </span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <Input
                  id="username"
                  placeholder="seuusername"
                  value={form.username}
                  onChange={handleUsernameChange}
                  required
                  minLength={3}
                  maxLength={30}
                  className="pl-7"
                  autoComplete="username"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Apenas letras minúsculas, números, . e _
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={update("email")}
                required
                autoComplete="email"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="academic-level">Nível acadêmico</Label>
                <Select
                  value={form.academicLevel}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, academicLevel: value as AcademicLevel }))
                  }
                >
                  <SelectTrigger id="academic-level" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACADEMIC_LEVEL_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="course-name">Curso</Label>
                <Input
                  id="course-name"
                  placeholder="Ex: Engenharia de Software"
                  value={form.courseName}
                  onChange={update("courseName")}
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="organization-title"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="start-date">Início</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={form.startDate}
                  onChange={update("startDate")}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="current-semester">Semestre atual</Label>
                <Input
                  id="current-semester"
                  type="number"
                  min={1}
                  max={30}
                  value={form.currentSemester}
                  onChange={update("currentSemester")}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={form.password}
                onChange={update("password")}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repita a senha"
                value={form.confirmPassword}
                onChange={update("confirmPassword")}
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Criar conta
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
