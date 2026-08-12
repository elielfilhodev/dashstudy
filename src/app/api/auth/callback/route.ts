import { NextRequest, NextResponse } from "next/server"
import { setSessionCookies, type TokenPair } from "@/lib/auth-cookies"
import { apiPostPublic } from "@/lib/backend"

/**
 * Fim do fluxo OAuth: o backend redireciona para cá com um código de uso único,
 * que trocamos por tokens no servidor. O JWT nunca aparece na URL do navegador.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url))
  }

  try {
    const tokens = await apiPostPublic<TokenPair>("/auth/exchange", { code })
    await setSessionCookies(tokens)
    return NextResponse.redirect(new URL("/", request.url))
  } catch {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url))
  }
}
