import { NextResponse } from "next/server"

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function created<T>(data: T) {
  return ok(data, 201)
}

export function noContent() {
  return new NextResponse(null, { status: 204 })
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function unauthorized() {
  return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
}

export function notFound(entity = "Recurso") {
  return NextResponse.json({ error: `${entity} não encontrado` }, { status: 404 })
}

export function serverError(err: unknown) {
  const message =
    process.env.NODE_ENV === "development" && err instanceof Error
      ? err.message
      : "Erro interno do servidor"
  return NextResponse.json({ error: message }, { status: 500 })
}
