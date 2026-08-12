import { NextRequest, NextResponse } from "next/server"
import {
  readAccessToken,
  readRefreshToken,
  setSessionCookies,
  type TokenPair,
} from "@/lib/auth-cookies"
import { API_BASE, apiPostPublic } from "@/lib/backend"

/**
 * Repassa /api/* para a API NestJS anexando o access token do cookie httpOnly.
 * Em caso de 401, tenta rotacionar o refresh token uma vez e refaz a chamada —
 * assim o cliente nunca precisa lidar com tokens.
 */
async function proxy(request: NextRequest, path: string[]) {
  const target = new URL(`${API_BASE}/${path.join("/")}`)
  target.search = request.nextUrl.search

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer()

  let accessToken = await readAccessToken()

  try {
    let upstream = await forward(target, request, body, accessToken)

    if (upstream.status === 401) {
      const refreshed = await refreshSession()
      if (refreshed) {
        accessToken = refreshed
        upstream = await forward(target, request, body, accessToken)
      }
    }

    return toNextResponse(upstream)
  } catch {
    // API fora do ar: responde no mesmo formato de erro que o cliente já trata.
    return NextResponse.json(
      { error: "Serviço indisponível no momento" },
      { status: 503 }
    )
  }
}

function forward(
  target: URL,
  request: NextRequest,
  body: ArrayBuffer | undefined,
  accessToken: string | null
) {
  const headers = new Headers()
  const contentType = request.headers.get("content-type")
  if (contentType) headers.set("content-type", contentType)
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`)

  return fetch(target, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
  })
}

async function refreshSession(): Promise<string | null> {
  const refreshToken = await readRefreshToken()
  if (!refreshToken) return null

  try {
    const tokens = await apiPostPublic<TokenPair>("/auth/refresh", { refreshToken })
    await setSessionCookies(tokens)
    return tokens.access_token
  } catch {
    return null
  }
}

async function toNextResponse(upstream: Response) {
  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 })
  }

  const headers = new Headers()
  const contentType = upstream.headers.get("content-type")
  const cacheControl = upstream.headers.get("cache-control")
  if (contentType) headers.set("content-type", contentType)
  if (cacheControl) headers.set("cache-control", cacheControl)

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers,
  })
}

type Ctx = { params: Promise<{ path: string[] }> }

export async function GET(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path)
}
export async function POST(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path)
}
export async function PATCH(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path)
}
export async function PUT(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path)
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path)
}
