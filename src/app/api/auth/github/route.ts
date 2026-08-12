import { NextResponse } from "next/server"
import { BACKEND_URL } from "@/lib/backend"

/** Entrada do login com GitHub: leva o navegador ao fluxo OAuth do backend. */
export async function GET() {
  return NextResponse.redirect(`${BACKEND_URL}/api/v1/auth/github`)
}
