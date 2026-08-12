import "server-only"

export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000"
export const API_BASE = `${BACKEND_URL}/api/v1`

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

type Envelope<T> = { data: T } | { error: string }

/** Chamada autenticada à API NestJS a partir do servidor Next. */
export async function apiFetch(
  path: string,
  accessToken: string | null,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers)
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`)

  return fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" })
}

export async function unwrap<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T

  const body = (await res.json().catch(() => null)) as Envelope<T> | null

  if (!res.ok) {
    const message =
      body && "error" in body ? body.error : "Não foi possível falar com o servidor"
    throw new ApiError(res.status, message)
  }

  return body && "data" in body ? body.data : (undefined as T)
}

/** POST sem sessão — usado pelas rotas-ponte de autenticação. */
export async function apiPostPublic<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  return unwrap<T>(res)
}
