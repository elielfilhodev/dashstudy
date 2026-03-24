import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/session"

// GET /api/gifs?q=texto&limit=20
// Proxy para a API Tenor para não expor a chave ao cliente.
// Requer: TENOR_API_KEY no .env
export async function GET(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const apiKey = process.env.TENOR_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "TENOR_API_KEY não configurada" },
      { status: 503 }
    )
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim()
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50)

  if (!q) {
    return NextResponse.json({ data: [] })
  }

  try {
    const url = new URL("https://tenor.googleapis.com/v2/search")
    url.searchParams.set("q", q)
    url.searchParams.set("key", apiKey)
    url.searchParams.set("limit", String(limit))
    url.searchParams.set("media_filter", "gif,tinygif")
    url.searchParams.set("contentfilter", "medium")

    const res = await fetch(url.toString(), { next: { revalidate: 60 } })
    if (!res.ok) throw new Error(`Tenor API error: ${res.status}`)
    const json = await res.json() as {
      results: Array<{
        id: string
        title: string
        media_formats: {
          gif?: { url: string; dims: [number, number] }
          tinygif?: { url: string; dims: [number, number] }
        }
      }>
    }

    const gifs = json.results.map((r) => ({
      id: r.id,
      title: r.title,
      url: r.media_formats.gif?.url ?? "",
      previewUrl: r.media_formats.tinygif?.url ?? r.media_formats.gif?.url ?? "",
    })).filter((g) => g.url)

    return NextResponse.json({ data: gifs })
  } catch (err) {
    console.error("[/api/gifs]", err)
    return NextResponse.json({ data: [] })
  }
}
