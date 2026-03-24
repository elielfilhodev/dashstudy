import { NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { requireAuth } from "@/lib/session"
import { badRequest, serverError } from "@/lib/api-response"
import type { MessageAttachmentType } from "@/types"

const MAX_IMAGE_BYTES = 5 * 1024 * 1024  // 5 MB
const MAX_DOC_BYTES   = 20 * 1024 * 1024 // 20 MB

const IMAGE_MIMES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
])
const DOC_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
])

function detectType(mime: string): MessageAttachmentType | null {
  if (IMAGE_MIMES.has(mime)) return mime === "image/gif" ? "gif" : "image"
  if (DOC_MIMES.has(mime)) return "document"
  return null
}

// POST /api/chat/upload
// Content-Type: multipart/form-data
// Body: file (File)
// Returns: { url, type, name }
export async function POST(request: NextRequest) {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Armazenamento de arquivos não configurado (BLOB_READ_WRITE_TOKEN ausente)" },
        { status: 503 }
      )
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file || !file.name) return badRequest("Arquivo não enviado")

    const attachType = detectType(file.type)
    if (!attachType) return badRequest("Tipo de arquivo não suportado")

    const maxBytes = attachType === "document" ? MAX_DOC_BYTES : MAX_IMAGE_BYTES
    if (file.size > maxBytes) {
      return badRequest(
        `Arquivo muito grande (máx ${Math.round(maxBytes / 1024 / 1024)} MB)`
      )
    }

    const blob = await put(`chat/${userId}/${Date.now()}-${file.name}`, file, {
      access: "public",
      contentType: file.type,
    })

    return NextResponse.json({
      data: { url: blob.url, type: attachType, name: file.name },
    })
  } catch (err) {
    return serverError(err)
  }
}
