import { NextRequest, NextResponse } from "next/server"
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth-cookies"

const AUTH_ROUTES = ["/login", "/register", "/reset-password", "/forgot-password"]

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Presença do cookie basta aqui; a validade do token é conferida pela API.
  const hasSession =
    request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE)

  if (AUTH_ROUTES.includes(pathname)) {
    return hasSession
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next()
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
