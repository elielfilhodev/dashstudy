"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import {
  BookMarked,
  ImagePlus,
  Library,
  Loader2,
  MessageCircle,
  PencilLine,
  Plus,
  StickyNote,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"
import type { BookComment, BookListItem } from "@/types"
import { LibraryStarRating } from "@/components/library/library-star-rating"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface FriendUser {
  id: string
  name: string
  username: string | null
  displayId: string
  image: string | null
}

type DetailOwner = {
  role: "owner"
  book: BookListItem & {
    review: string | null
    notes: { id: string; body: string; createdAt: string }[]
    comments: BookComment[]
  }
}

type DetailFriend = {
  role: "friend"
  book: BookListItem & {
    review: string | null
    comments: BookComment[]
  }
}

type DetailPayload = DetailOwner | DetailFriend

function BookCover({
  href,
  title,
  className,
}: {
  href: string | null
  title: string
  className?: string
}) {
  if (!href) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted/80 text-muted-foreground",
          className
        )}
      >
        <BookMarked className="size-10 opacity-40" aria-hidden />
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URLs arbitrárias + rota /api/books/.../cover
    <img
      src={href}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn("h-full w-full object-cover", className)}
    />
  )
}

function BookCard({
  book,
  index,
  onOpen,
}: {
  book: BookListItem
  index: number
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group text-left rounded-xl border border-border bg-card overflow-hidden shadow-sm",
        "transition-all duration-200 ease-out",
        "hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms`, animationDuration: "320ms" }}
    >
      <div className="aspect-[3/4] relative overflow-hidden bg-muted">
        <BookCover href={book.coverImageHref} title={book.title} className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <div className="p-3 space-y-2">
        <div className="space-y-1 min-w-0">
          <p className="font-semibold text-sm leading-tight line-clamp-2">{book.title}</p>
          {book.author ? (
            <p className="text-xs text-muted-foreground line-clamp-1">{book.author}</p>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <LibraryStarRating value={book.rating} readOnly size="sm" />
          <div className="flex items-center gap-1">
            {book.notesCount > 0 ? (
              <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
                <StickyNote className="size-3" />
                {book.notesCount}
              </Badge>
            ) : null}
            {book.commentsCount > 0 ? (
              <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
                <MessageCircle className="size-3" />
                {book.commentsCount}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  )
}

export function LibraryView({ initialBooks }: { initialBooks: BookListItem[] }) {
  const [tab, setTab] = useState<"mine" | "friends">("mine")
  const [friendId, setFriendId] = useState<string>("")
  const [detailId, setDetailId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const { data: friendsPayload } = useSWR<{ friends: FriendUser[] }>("/api/friends", {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })
  const friends = friendsPayload?.friends ?? []

  const mineKey = tab === "mine" ? "/api/books" : null
  const friendBooksKey =
    tab === "friends" && friendId ? `/api/friends/profile/${friendId}/books` : null

  const {
    data: myBooks = initialBooks,
    mutate: mutateMine,
    isLoading: loadingMine,
  } = useSWR<BookListItem[]>(mineKey, {
    fallbackData: initialBooks,
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const {
    data: friendBooks = [],
    mutate: mutateFriendBooks,
    isLoading: loadingFriendBooks,
  } = useSWR<BookListItem[]>(friendBooksKey, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const list = tab === "mine" ? myBooks : friendBooks
  const loadingList = tab === "mine" ? loadingMine : loadingFriendBooks

  const detailKey = detailId ? `/api/books/${detailId}` : null
  const {
    data: detail,
    mutate: mutateDetail,
    isLoading: detailLoading,
  } = useSWR<DetailPayload>(detailKey, {
    revalidateOnFocus: false,
  })

  useEffect(() => {
    if (tab === "friends" && friends.length && !friendId) {
      setFriendId(friends[0].id)
    }
  }, [tab, friends, friendId])

  const refreshLists = useCallback(() => {
    void mutateMine()
    if (friendId) void mutateFriendBooks()
  }, [mutateMine, mutateFriendBooks, friendId])

  const [formNew, setFormNew] = useState({
    title: "",
    author: "",
    isbn: "",
    coverUrl: "",
  })

  async function handleCreateBook(e: React.FormEvent) {
    e.preventDefault()
    if (!formNew.title.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formNew.title.trim(),
          author: formNew.author.trim() || null,
          isbn: formNew.isbn.trim() || null,
          coverUrl: formNew.coverUrl.trim() || null,
        }),
      })
      const j = await res.json()
      if (!res.ok) {
        toast.error(j.error ?? "Não foi possível criar o livro")
        return
      }
      toast.success("Livro adicionado", { description: formNew.title.trim() })
      setFormNew({ title: "", author: "", isbn: "", coverUrl: "" })
      setNewOpen(false)
      await mutateMine()
    } finally {
      setSaving(false)
    }
  }

  const selectedFriendName = useMemo(() => {
    const f = friends.find((x) => x.id === friendId)
    return f?.name ?? "Amigo"
  }, [friends, friendId])

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Library className="size-7 shrink-0 text-primary" />
            Livraria
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cadastre livros, notas e avaliações. Amigos comentam e acompanham suas leituras.
          </p>
        </div>
        {tab === "mine" ? (
          <Button onClick={() => setNewOpen(true)} className="gap-2 shrink-0">
            <Plus className="size-4" />
            Novo livro
          </Button>
        ) : null}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "mine" | "friends")}>
        <TabsList className="grid w-full max-w-md grid-cols-2 h-10">
          <TabsTrigger value="mine" className="gap-2">
            <BookMarked className="size-4" />
            Minha livraria
          </TabsTrigger>
          <TabsTrigger value="friends" className="gap-2">
            <Users className="size-4" />
            De amigos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-4 space-y-4">
          {loadingList && !myBooks.length ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="size-8 animate-spin" />
            </div>
          ) : myBooks.length === 0 ? (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">Nenhum livro ainda</CardTitle>
                <CardDescription>
                  Adicione seu primeiro livro para guardar anotações, estrelas e receber comentários
                  dos amigos.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {myBooks.map((b, i) => (
                <BookCard key={b.id} book={b} index={i} onOpen={() => setDetailId(b.id)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="friends" className="mt-4 space-y-4">
          {friends.length === 0 ? (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">Sem amigos ainda</CardTitle>
                <CardDescription>
                  Aceite pedidos ou envie convites no perfil para ver a livraria de amigos.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center max-w-md">
                <Label className="text-xs text-muted-foreground shrink-0">Ver livraria de</Label>
                <Select value={friendId} onValueChange={setFriendId}>
                  <SelectTrigger className="w-full sm:flex-1">
                    <SelectValue placeholder="Escolha um amigo" />
                  </SelectTrigger>
                  <SelectContent>
                    {friends.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.username ? `${f.name} (@${f.username})` : f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!friendId || loadingFriendBooks ? (
                <div className="flex justify-center py-16 text-muted-foreground">
                  <Loader2 className="size-8 animate-spin" />
                </div>
              ) : friendBooks.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Livraria vazia</CardTitle>
                    <CardDescription>
                      {selectedFriendName} ainda não cadastrou livros públicos na livraria.
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {friendBooks.map((b, i) => (
                    <BookCard key={b.id} book={b} index={i} onOpen={() => setDetailId(b.id)} />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo livro</DialogTitle>
            <DialogDescription>Título obrigatório. Capa por URL ou envio depois no detalhe.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateBook} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="nb-title">Título</Label>
              <Input
                id="nb-title"
                value={formNew.title}
                onChange={(e) => setFormNew((p) => ({ ...p, title: e.target.value }))}
                required
                maxLength={300}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nb-author">Autor</Label>
              <Input
                id="nb-author"
                value={formNew.author}
                onChange={(e) => setFormNew((p) => ({ ...p, author: e.target.value }))}
                maxLength={200}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nb-isbn">ISBN (opcional)</Label>
              <Input
                id="nb-isbn"
                value={formNew.isbn}
                onChange={(e) => setFormNew((p) => ({ ...p, isbn: e.target.value }))}
                maxLength={32}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nb-cover">URL da capa (https…)</Label>
              <Input
                id="nb-cover"
                type="url"
                placeholder="https://..."
                value={formNew.coverUrl}
                onChange={(e) => setFormNew((p) => ({ ...p, coverUrl: e.target.value }))}
                maxLength={2048}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
        >
          {!detailId ? null : detailLoading && !detail ? (
            <div className="flex justify-center py-20">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <BookDetailPanel
              detail={detail}
              bookId={detailId}
              onClose={() => setDetailId(null)}
              onMutateDetail={() => void mutateDetail()}
              refreshLists={refreshLists}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BookDetailPanel({
  detail,
  bookId,
  onClose,
  onMutateDetail,
  refreshLists,
}: {
  detail: DetailPayload
  bookId: string
  onClose: () => void
  onMutateDetail: () => void
  refreshLists: () => void
}) {
  const coverFileRef = useRef<HTMLInputElement>(null)
  const { book, role } = detail
  const [editTitle, setEditTitle] = useState(book.title)
  const [editAuthor, setEditAuthor] = useState(book.author ?? "")
  const [editIsbn, setEditIsbn] = useState(book.isbn ?? "")
  const [editReview, setEditReview] = useState(book.review ?? "")
  const [editCoverUrl, setEditCoverUrl] = useState(book.coverUrl ?? "")
  const [noteBody, setNoteBody] = useState("")
  const [commentBody, setCommentBody] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setEditTitle(book.title)
    setEditAuthor(book.author ?? "")
    setEditIsbn(book.isbn ?? "")
    setEditReview(book.review ?? "")
    setEditCoverUrl(book.coverUrl ?? "")
  }, [book])

  async function patchBook(body: Record<string, unknown>) {
    const res = await fetch(`/api/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const j = await res.json()
    if (!res.ok) {
      toast.error(j.error ?? "Erro ao salvar")
      return false
    }
    toast.success("Guardado")
    onMutateDetail()
    refreshLists()
    return true
  }

  async function handleSaveMeta() {
    setBusy(true)
    try {
      await patchBook({
        title: editTitle.trim(),
        author: editAuthor.trim() || null,
        isbn: editIsbn.trim() || null,
        review: editReview.trim() || null,
        coverUrl: editCoverUrl.trim() || null,
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleRatingChange(v: number | null) {
    setBusy(true)
    try {
      await patchBook({ rating: v })
    } finally {
      setBusy(false)
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!noteBody.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/books/${bookId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody.trim() }),
      })
      const j = await res.json()
      if (!res.ok) {
        toast.error(j.error ?? "Erro")
        return
      }
      setNoteBody("")
      toast.success("Anotação adicionada")
      onMutateDetail()
      refreshLists()
    } finally {
      setBusy(false)
    }
  }

  async function deleteNote(id: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/books/${bookId}/notes/${id}`, { method: "DELETE" })
      if (!res.ok) {
        toast.error("Não foi possível remover")
        return
      }
      toast.success("Anotação removida")
      onMutateDetail()
      refreshLists()
    } finally {
      setBusy(false)
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentBody.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/books/${bookId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody.trim() }),
      })
      const j = await res.json()
      if (!res.ok) {
        toast.error(j.error ?? "Erro ao comentar")
        return
      }
      setCommentBody("")
      toast.success("Comentário publicado")
      onMutateDetail()
      refreshLists()
    } finally {
      setBusy(false)
    }
  }

  async function handleCoverFile(f: File | null) {
    if (!f) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      toast.error("Use JPEG, PNG ou WebP")
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set("file", f)
      const res = await fetch(`/api/books/${bookId}/cover`, { method: "POST", body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(j.error ?? "Falha no envio da capa")
        return
      }
      toast.success("Capa atualizada")
      setEditCoverUrl("")
      onMutateDetail()
      refreshLists()
    } finally {
      setBusy(false)
      if (coverFileRef.current) coverFileRef.current.value = ""
    }
  }

  async function removeCover() {
    setBusy(true)
    try {
      const res = await fetch(`/api/books/${bookId}/cover`, { method: "DELETE" })
      if (!res.ok) {
        toast.error("Erro ao remover capa")
        return
      }
      toast.success("Capa removida")
      onMutateDetail()
      refreshLists()
    } finally {
      setBusy(false)
    }
  }

  async function deleteBook() {
    if (!confirm("Remover este livro e todos os comentários/anotações?")) return
    setBusy(true)
    try {
      const res = await fetch(`/api/books/${bookId}`, { method: "DELETE" })
      if (!res.ok) {
        toast.error("Erro ao remover")
        return
      }
      toast.success("Livro removido")
      onClose()
      refreshLists()
    } finally {
      setBusy(false)
    }
  }

  const notes = role === "owner" ? detail.book.notes : []

  return (
    <>
      <div className="relative aspect-[16/10] sm:aspect-[2/1] bg-muted shrink-0">
        <BookCover href={book.coverImageHref} title={book.title} className="absolute inset-0 w-full h-full" />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 rounded-full shadow-md"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {role === "owner" ? (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <PencilLine className="size-3" /> Editar
              </Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={300} />
              <Input
                placeholder="Autor"
                value={editAuthor}
                onChange={(e) => setEditAuthor(e.target.value)}
                maxLength={200}
              />
              <Input
                placeholder="ISBN"
                value={editIsbn}
                onChange={(e) => setEditIsbn(e.target.value)}
                maxLength={32}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Sua avaliação</Label>
              <LibraryStarRating value={book.rating} onChange={handleRatingChange} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Resenha (visível para amigos)</Label>
              <Textarea
                value={editReview}
                onChange={(e) => setEditReview(e.target.value)}
                rows={3}
                maxLength={8000}
                className="resize-none min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">URL da capa</Label>
              <Input
                type="url"
                placeholder="https://..."
                value={editCoverUrl}
                onChange={(e) => setEditCoverUrl(e.target.value)}
                maxLength={2048}
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={coverFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(e) => void handleCoverFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1"
                  disabled={busy}
                  onClick={() => coverFileRef.current?.click()}
                >
                  <ImagePlus className="size-4" />
                  Enviar foto
                </Button>
                {book.hasCover ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => void removeCover()} disabled={busy}>
                    Remover capa
                  </Button>
                ) : null}
                <Button type="button" size="sm" onClick={() => void handleSaveMeta()} disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "Guardar texto / URL"}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <StickyNote className="size-3" /> Anotações (só você)
              </Label>
              <form onSubmit={handleAddNote} className="flex gap-2">
                <Textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Ideias, citações, página…"
                  rows={2}
                  className="flex-1 resize-none min-h-[60px]"
                  maxLength={8000}
                />
                <Button type="submit" disabled={busy} className="shrink-0 self-end">
                  Add
                </Button>
              </form>
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-lg border border-border p-2 text-sm relative group/note pr-10 animate-in fade-in duration-200"
                  >
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleString("pt-BR")}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 size-7 opacity-70 group-hover/note:opacity-100"
                      onClick={() => void deleteNote(n.id)}
                      disabled={busy}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-semibold leading-tight">{book.title}</h2>
              {book.author ? <p className="text-sm text-muted-foreground">{book.author}</p> : null}
              {book.isbn ? (
                <p className="text-xs text-muted-foreground font-mono mt-1">ISBN {book.isbn}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Avaliação dele(a)</Label>
              <LibraryStarRating value={book.rating} readOnly />
            </div>
            {book.review ? (
              <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">{book.review}</div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem resenha pública.</p>
            )}
          </>
        )}

        <Separator />

        <div className="space-y-3">
          <Label className="text-xs flex items-center gap-1">
            <MessageCircle className="size-3" /> Comentários ({book.comments.length})
          </Label>
          {role === "friend" ? (
            <form onSubmit={handleComment} className="flex flex-col gap-2">
              <Textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Deixe um comentário…"
                rows={2}
                maxLength={2000}
                className="resize-none"
              />
              <Button type="submit" size="sm" className="self-end" disabled={busy}>
                Publicar
              </Button>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">
              Amigos comentam aqui. Você responde pelas anotações privadas acima.
            </p>
          )}
          <ul className="space-y-3">
            {book.comments.map((c) => (
              <li
                key={c.id}
                className="flex gap-2 animate-in fade-in slide-in-from-left-1 duration-200"
              >
                <Avatar className="size-8 shrink-0">
                  {c.user.image ? <AvatarImage src={c.user.image} alt="" /> : null}
                  <AvatarFallback className="text-xs">
                    {c.user.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 rounded-lg border border-border p-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium">{c.user.name}</span>
                    {c.user.username ? (
                      <span className="text-[10px] text-muted-foreground">@{c.user.username}</span>
                    ) : null}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(c.createdAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {role === "owner" ? (
          <div className="pt-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => void deleteBook()}
              disabled={busy}
            >
              <Trash2 className="size-4" />
              Excluir livro
            </Button>
          </div>
        ) : null}
      </div>
    </>
  )
}
